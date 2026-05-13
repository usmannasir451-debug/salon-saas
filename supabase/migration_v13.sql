-- Migration v13: Attendance system + subscription limits
-- Run this in Supabase SQL Editor

-- ── 1. Add leave_allowance to staff ─────────────────────────────────────────
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS leave_allowance INTEGER DEFAULT 2;

-- ── 2. Add max_branches and max_staff to profiles ────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS max_branches INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_staff INTEGER DEFAULT 10;

-- Update existing accounts to have defaults
UPDATE public.profiles
SET max_branches = 1 WHERE max_branches IS NULL;

UPDATE public.profiles
SET max_staff = 10 WHERE max_staff IS NULL;

-- ── 3. Add attendance columns to payroll_entries ─────────────────────────────
ALTER TABLE public.payroll_entries
  ADD COLUMN IF NOT EXISTS attendance_present_days INTEGER,
  ADD COLUMN IF NOT EXISTS attendance_working_days INTEGER,
  ADD COLUMN IF NOT EXISTS attendance_deduction NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attendance_detail TEXT;

-- ── 4. Create attendance table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  staff_id      UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('present', 'half_day', 'absent', 'leave', 'holiday')),
  branch_id     UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, staff_id, date)
);

-- ── 5. Enable RLS on attendance ──────────────────────────────────────────────
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Select policy: owner or sub-user of owner
CREATE POLICY "attendance_select" ON public.attendance
  FOR SELECT USING (owner_id = get_effective_owner_id());

-- Insert policy
CREATE POLICY "attendance_insert" ON public.attendance
  FOR INSERT WITH CHECK (owner_id = get_effective_owner_id());

-- Update policy
CREATE POLICY "attendance_update" ON public.attendance
  FOR UPDATE USING (owner_id = get_effective_owner_id());

-- Delete policy
CREATE POLICY "attendance_delete" ON public.attendance
  FOR DELETE USING (owner_id = get_effective_owner_id());

-- Grants
grant select, insert, update, delete on public.attendance to authenticated;
grant select, insert, update, delete on public.attendance to service_role;
grant select on public.attendance to anon;

-- ── 6. Indexes for performance ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS attendance_owner_date_idx ON public.attendance(owner_id, date);
CREATE INDEX IF NOT EXISTS attendance_staff_date_idx ON public.attendance(staff_id, date);
CREATE INDEX IF NOT EXISTS attendance_owner_month_idx ON public.attendance(owner_id, date, staff_id);
