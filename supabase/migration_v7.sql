-- SalonPro Migration v7
-- Parts: Multi-service, Deals, Staff Extras, Loyalty, Custom Inventory, Payroll Pro-Rata
-- Run in Supabase SQL Editor

-- ═══════════════════════════════════════════════════════
-- PART 1: STAFF EXTRA FIELDS (joining date, gender, designation, etc.)
-- ═══════════════════════════════════════════════════════

alter table public.staff
  add column if not exists joining_date       date,
  add column if not exists gender             text check (gender in ('male', 'female', 'other')),
  add column if not exists designation        text,
  add column if not exists emergency_contact_name  text,
  add column if not exists emergency_contact_phone text,
  add column if not exists cnic               text,
  add column if not exists basic_salary       numeric(12, 2) default 0,
  add column if not exists is_active          boolean not null default true;

-- ═══════════════════════════════════════════════════════
-- PART 2: LOYALTY SYSTEM - Profile settings
-- ═══════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists loyalty_enabled       boolean not null default false,
  add column if not exists loyalty_earn_pct      numeric(5, 2) not null default 10,
  add column if not exists loyalty_expiry_days   integer,
  add column if not exists tax_percentage        numeric(5, 2) not null default 0;

-- Add loyalty balance and unique phone to clients
alter table public.clients
  add column if not exists loyalty_balance numeric(12, 2) not null default 0;

-- Unique constraint on (user_id, phone) for client phone as identifier
-- Drop old constraint if exists, then create clean one
alter table public.clients
  drop constraint if exists clients_user_id_phone_key;

alter table public.clients
  add constraint clients_user_id_phone_key unique (user_id, phone);

-- ═══════════════════════════════════════════════════════
-- PART 3: LOYALTY TRANSACTIONS TABLE
-- ═══════════════════════════════════════════════════════

create table if not exists public.loyalty_transactions (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  client_phone    text not null,
  client_name     text,
  transaction_type text not null check (transaction_type in ('earned', 'redeemed')),
  amount          numeric(12, 2) not null default 0,
  reference_id    uuid,
  reference_type  text check (reference_type in ('appointment', 'walk_in')),
  notes           text,
  created_at      timestamptz default now() not null
);

alter table public.loyalty_transactions enable row level security;

create policy "loyalty_select" on public.loyalty_transactions
  for select using (user_id = get_effective_owner_id());

create policy "loyalty_insert" on public.loyalty_transactions
  for insert with check (user_id = get_effective_owner_id());

create policy "loyalty_update" on public.loyalty_transactions
  for update using (user_id = get_effective_owner_id());

create policy "loyalty_delete" on public.loyalty_transactions
  for delete using (user_id = get_effective_owner_id());

-- ═══════════════════════════════════════════════════════
-- PART 4: MULTI-SERVICE SUPPORT
-- ═══════════════════════════════════════════════════════

-- Junction table: appointment ↔ services
create table if not exists public.appointment_services (
  id              uuid default uuid_generate_v4() primary key,
  appointment_id  uuid references public.appointments(id) on delete cascade not null,
  service_id      uuid references public.services(id) on delete cascade not null,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  created_at      timestamptz default now() not null,
  unique(appointment_id, service_id)
);

alter table public.appointment_services enable row level security;

create policy "appt_svc_select" on public.appointment_services
  for select using (user_id = get_effective_owner_id());

create policy "appt_svc_insert" on public.appointment_services
  for insert with check (user_id = get_effective_owner_id());

create policy "appt_svc_delete" on public.appointment_services
  for delete using (user_id = get_effective_owner_id());

-- Junction table: walk_in ↔ services
create table if not exists public.walk_in_services (
  id          uuid default uuid_generate_v4() primary key,
  walk_in_id  uuid references public.walk_ins(id) on delete cascade not null,
  service_id  uuid references public.services(id) on delete cascade not null,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  created_at  timestamptz default now() not null,
  unique(walk_in_id, service_id)
);

alter table public.walk_in_services enable row level security;

create policy "walkin_svc_select" on public.walk_in_services
  for select using (user_id = get_effective_owner_id());

create policy "walkin_svc_insert" on public.walk_in_services
  for insert with check (user_id = get_effective_owner_id());

create policy "walkin_svc_delete" on public.walk_in_services
  for delete using (user_id = get_effective_owner_id());

-- ═══════════════════════════════════════════════════════
-- PART 5: DEALS & PACKAGES
-- ═══════════════════════════════════════════════════════

create table if not exists public.deals (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  name            text not null,
  description     text,
  price           numeric(12, 2) not null default 0,
  validity_days   integer,
  is_active       boolean not null default true,
  created_at      timestamptz default now() not null
);

create table if not exists public.deal_services (
  id          uuid default uuid_generate_v4() primary key,
  deal_id     uuid references public.deals(id) on delete cascade not null,
  service_id  uuid references public.services(id) on delete cascade not null,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  created_at  timestamptz default now() not null,
  unique(deal_id, service_id)
);

alter table public.deals enable row level security;
alter table public.deal_services enable row level security;

create policy "deals_select" on public.deals
  for select using (user_id = get_effective_owner_id());

create policy "deals_insert" on public.deals
  for insert with check (user_id = get_effective_owner_id());

create policy "deals_update" on public.deals
  for update using (user_id = get_effective_owner_id());

create policy "deals_delete" on public.deals
  for delete using (user_id = get_effective_owner_id());

create policy "deal_svc_select" on public.deal_services
  for select using (user_id = get_effective_owner_id());

create policy "deal_svc_insert" on public.deal_services
  for insert with check (user_id = get_effective_owner_id());

create policy "deal_svc_delete" on public.deal_services
  for delete using (user_id = get_effective_owner_id());

-- Add deal_id to appointments and walk_ins
alter table public.appointments
  add column if not exists deal_id uuid references public.deals(id) on delete set null;

alter table public.walk_ins
  add column if not exists deal_id uuid references public.deals(id) on delete set null;

-- ═══════════════════════════════════════════════════════
-- PART 6: CUSTOM INVENTORY CATEGORIES
-- ═══════════════════════════════════════════════════════

create table if not exists public.custom_inventory_categories (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  name        text not null,
  created_at  timestamptz default now() not null,
  unique(user_id, name)
);

alter table public.custom_inventory_categories enable row level security;

create policy "custom_cats_select" on public.custom_inventory_categories
  for select using (user_id = get_effective_owner_id());

create policy "custom_cats_insert" on public.custom_inventory_categories
  for insert with check (user_id = get_effective_owner_id());

create policy "custom_cats_delete" on public.custom_inventory_categories
  for delete using (user_id = get_effective_owner_id());

-- Remove check constraint on inventory_items.category to allow custom categories
alter table public.inventory_items
  drop constraint if exists inventory_items_category_check;

-- ═══════════════════════════════════════════════════════
-- PERFORMANCE INDEXES
-- ═══════════════════════════════════════════════════════

create index if not exists idx_appointment_services_appt on public.appointment_services(appointment_id);
create index if not exists idx_walk_in_services_walkin on public.walk_in_services(walk_in_id);
create index if not exists idx_loyalty_transactions_user_phone on public.loyalty_transactions(user_id, client_phone);
create index if not exists idx_deals_user on public.deals(user_id);
create index if not exists idx_deal_services_deal on public.deal_services(deal_id);
create index if not exists idx_custom_cats_user on public.custom_inventory_categories(user_id);
create index if not exists idx_staff_active on public.staff(user_id, is_active);
