-- SalonPro Migration v8
-- Adds: payment_method on appointments, payment_methods config on profiles
-- Run in Supabase SQL Editor

-- ═══════════════════════════════════════════════════════
-- PART 1: PAYMENT METHOD ON APPOINTMENTS TABLE
-- ═══════════════════════════════════════════════════════

alter table public.appointments
  add column if not exists payment_method text default 'cash';

-- ═══════════════════════════════════════════════════════
-- PART 2: CUSTOM PAYMENT METHODS CONFIG IN PROFILES
-- (JSON array: [{value, label, enabled}])
-- ═══════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists payment_methods jsonb;

-- ═══════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════

create index if not exists idx_appointments_payment_method on public.appointments(user_id, payment_method);
create index if not exists idx_walk_ins_payment_method on public.walk_ins(user_id, payment_method);
