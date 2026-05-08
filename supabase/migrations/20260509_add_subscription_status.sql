-- Add subscription_status column to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'suspended'));

-- Index for fast middleware lookup
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status
  ON profiles (subscription_status);
