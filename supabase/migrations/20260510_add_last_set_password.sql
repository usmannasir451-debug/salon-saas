ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_set_password TEXT;
