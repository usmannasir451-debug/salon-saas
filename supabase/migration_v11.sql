-- Snipforce Migration v11
-- Part 1: Expenses branch support, receipts, approval
-- Part 2: Profiles custom expense categories & budgets
-- Part 3: Staff salary consolidation (replaces basic_salary + staff_salaries lookup)

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. EXPENSES TABLE
-- ───────────────────────────────────────────────────────────────────────────────

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS branch_id      UUID        REFERENCES branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS receipt_url    TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT       NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved'));

CREATE INDEX IF NOT EXISTS idx_expenses_branch_id ON expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_month ON expenses(user_id, expense_date);

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. PROFILES TABLE
-- ───────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS expense_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS expense_budgets    JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ───────────────────────────────────────────────────────────────────────────────
-- 3. STAFF TABLE — salary consolidation
-- ───────────────────────────────────────────────────────────────────────────────

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS salary_type           TEXT DEFAULT 'fixed'
    CHECK (salary_type IN ('fixed', 'commission', 'both')),
  ADD COLUMN IF NOT EXISTS fixed_amount          NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5,2)  DEFAULT 0;

-- Migrate existing basic_salary → fixed_amount
UPDATE staff
SET
  fixed_amount = COALESCE(basic_salary, 0),
  salary_type  = CASE WHEN COALESCE(basic_salary, 0) > 0 THEN 'fixed' ELSE 'fixed' END
WHERE basic_salary IS NOT NULL;

-- Migrate from staff_salaries table (prefer staff_salaries data as it's more structured)
UPDATE staff s
SET
  salary_type           = ss.salary_type,
  fixed_amount          = ss.fixed_amount,
  commission_percentage = ss.commission_pct
FROM staff_salaries ss
WHERE ss.staff_id = s.id
  AND ss.user_id  = s.user_id;

-- Drop basic_salary after migration (comment out if you want to keep it as backup)
-- ALTER TABLE staff DROP COLUMN IF EXISTS basic_salary;

-- ───────────────────────────────────────────────────────────────────────────────
-- 4. RLS POLICIES
-- ───────────────────────────────────────────────────────────────────────────────

-- Expenses: existing user_id = auth.uid() policy covers new columns automatically.
-- No additional RLS needed for branch_id, receipt_url, approval_status.

-- Profiles: existing self-read/write policy covers new columns automatically.

-- Staff: existing user_id = auth.uid() policy covers new salary columns automatically.

-- ───────────────────────────────────────────────────────────────────────────────
-- 5. STORAGE BUCKET (run in Supabase Dashboard → Storage)
-- ───────────────────────────────────────────────────────────────────────────────
-- Create a private bucket named "expense-receipts"
-- Add INSERT policy: auth.uid()::text = (storage.foldername(name))[1]
-- Add SELECT policy: auth.uid()::text = (storage.foldername(name))[1]
--
-- Or via SQL (requires storage extension enabled):
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('expense-receipts', 'expense-receipts', false)
-- ON CONFLICT DO NOTHING;
--
-- CREATE POLICY "Users upload own receipts"
-- ON storage.objects FOR INSERT TO authenticated
-- WITH CHECK (bucket_id = 'expense-receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
--
-- CREATE POLICY "Users view own receipts"
-- ON storage.objects FOR SELECT TO authenticated
-- USING (bucket_id = 'expense-receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
