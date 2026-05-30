-- Memberships & Packages System for Snipforce
-- Creates: membership_plans, client_memberships, membership_transactions, packages, client_packages

-- ─── membership_plans ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('service_based', 'balance_based')),
  price numeric NOT NULL DEFAULT 0,
  billing_period text NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'quarterly', 'yearly')),
  services_included jsonb NOT NULL DEFAULT '[]'::jsonb,
  discount_percentage numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membership_plans_owner_all" ON public.membership_plans
  USING (owner_id = get_effective_owner_id())
  WITH CHECK (owner_id = get_effective_owner_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.membership_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.membership_plans TO service_role;
GRANT SELECT ON public.membership_plans TO anon;

-- ─── client_memberships ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_phone text NOT NULL,
  client_name text,
  plan_id uuid NOT NULL REFERENCES public.membership_plans(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  next_billing_date date,
  balance numeric NOT NULL DEFAULT 0,
  services_remaining jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_memberships_owner_all" ON public.client_memberships
  USING (owner_id = get_effective_owner_id())
  WITH CHECK (owner_id = get_effective_owner_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_memberships TO service_role;
GRANT SELECT ON public.client_memberships TO anon;

-- ─── membership_transactions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.membership_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.client_memberships(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('payment', 'service_redemption', 'balance_credit')),
  amount numeric NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.membership_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membership_transactions_owner_all" ON public.membership_transactions
  USING (owner_id = get_effective_owner_id())
  WITH CHECK (owner_id = get_effective_owner_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.membership_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.membership_transactions TO service_role;
GRANT SELECT ON public.membership_transactions TO anon;

-- ─── packages ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  services_included jsonb NOT NULL DEFAULT '[]'::jsonb,
  price numeric NOT NULL DEFAULT 0,
  validity_days integer NOT NULL DEFAULT 365,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "packages_owner_all" ON public.packages
  USING (owner_id = get_effective_owner_id())
  WITH CHECK (owner_id = get_effective_owner_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO service_role;
GRANT SELECT ON public.packages TO anon;

-- ─── client_packages ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_phone text NOT NULL,
  client_name text,
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,
  services_remaining jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'used')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_packages_owner_all" ON public.client_packages
  USING (owner_id = get_effective_owner_id())
  WITH CHECK (owner_id = get_effective_owner_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_packages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_packages TO service_role;
GRANT SELECT ON public.client_packages TO anon;

-- ─── Add memberships to default enabled_modules for new accounts ──────────────
-- Update the default to include 'memberships' for new accounts
ALTER TABLE public.profiles
  ALTER COLUMN enabled_modules
  SET DEFAULT '["dashboard","appointments","calendar","walkin","services","staff","clients","inventory","expenses","payroll","attendance","reports_pnl","reviews","performance","branches","team_members","settings","memberships"]'::jsonb;

-- Note: memberships is NOT added to existing accounts — admin must enable per salon
