-- Add enabled_modules column to profiles table
-- This enables feature-based module access control at the salon account level

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS enabled_modules JSONB;

-- Set all existing accounts to have all modules enabled (backward compatibility)
UPDATE public.profiles
SET enabled_modules = '["dashboard","appointments","calendar","walkin","services","staff","clients","inventory","expenses","payroll","attendance","reports_pnl","reviews","performance","branches","team_members","settings"]'::jsonb
WHERE enabled_modules IS NULL;

-- Set default for all future accounts
ALTER TABLE public.profiles
  ALTER COLUMN enabled_modules
  SET DEFAULT '["dashboard","appointments","calendar","walkin","services","staff","clients","inventory","expenses","payroll","attendance","reports_pnl","reviews","performance","branches","team_members","settings"]'::jsonb;

-- Ensure grants are still in place for profiles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;
GRANT SELECT ON public.profiles TO anon;
