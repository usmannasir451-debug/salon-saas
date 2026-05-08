-- SalonPro Migration v6
-- Parts 13-20: Performance, Reviews, Clients, Onboarding, Invoices, Notifications, Audit Log, Export
-- Run in Supabase SQL Editor

-- ═══════════════════════════════════════════════════════
-- NEW COLUMNS ON EXISTING TABLES
-- ═══════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists tax_percentage numeric(5,2) not null default 0,
  add column if not exists onboarding_completed boolean not null default false;

alter table public.staff
  add column if not exists birthday date,
  add column if not exists commission_rate numeric(5,2) not null default 0;

-- ═══════════════════════════════════════════════════════
-- PART 14: REVIEWS
-- ═══════════════════════════════════════════════════════

create table if not exists public.reviews (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  staff_id uuid references public.staff(id) on delete cascade not null,
  appointment_id uuid references public.appointments(id) on delete set null,
  walk_in_id uuid references public.walk_ins(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  client_name text,
  created_at timestamptz default now() not null
);

alter table public.reviews enable row level security;

create policy "reviews_select" on public.reviews
  for select using (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
    )
  );

create policy "reviews_insert" on public.reviews
  for insert with check (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
        and role in ('owner', 'manager', 'receptionist', 'cashier')
    )
  );

create policy "reviews_update" on public.reviews
  for update using (auth.uid() = user_id);

create policy "reviews_delete" on public.reviews
  for delete using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════
-- PART 15: CLIENTS TABLE (extended client data)
-- ═══════════════════════════════════════════════════════

create table if not exists public.clients (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  phone text,
  email text,
  birthday date,
  notes text,
  created_at timestamptz default now() not null,
  unique (user_id, name)
);

alter table public.clients enable row level security;

create policy "clients_select" on public.clients
  for select using (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
    )
  );

create policy "clients_insert" on public.clients
  for insert with check (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
        and role in ('owner', 'manager', 'receptionist')
    )
  );

create policy "clients_update" on public.clients
  for update using (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
        and role in ('owner', 'manager', 'receptionist')
    )
  );

create policy "clients_delete" on public.clients
  for delete using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════
-- PART 18: NOTIFICATIONS
-- ═══════════════════════════════════════════════════════

create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in (
    'new_appointment', 'payment_received', 'new_review',
    'low_inventory', 'staff_birthday'
  )),
  title text not null,
  message text not null,
  read boolean not null default false,
  link text,
  created_at timestamptz default now() not null
);

alter table public.notifications enable row level security;

create policy "notifications_select" on public.notifications
  for select using (auth.uid() = user_id);

create policy "notifications_insert" on public.notifications
  for insert with check (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
    )
  );

create policy "notifications_update" on public.notifications
  for update using (auth.uid() = user_id);

create policy "notifications_delete" on public.notifications
  for delete using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════
-- PART 19: AUDIT LOG
-- ═══════════════════════════════════════════════════════

create table if not exists public.audit_log (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz default now() not null
);

alter table public.audit_log enable row level security;

create policy "audit_log_select" on public.audit_log
  for select using (auth.uid() = user_id);

create policy "audit_log_insert" on public.audit_log
  for insert with check (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
    )
  );

-- ═══════════════════════════════════════════════════════
-- INDEXES for performance
-- ═══════════════════════════════════════════════════════

create index if not exists reviews_user_id_idx on public.reviews(user_id);
create index if not exists reviews_staff_id_idx on public.reviews(staff_id);
create index if not exists reviews_created_at_idx on public.reviews(created_at desc);

create index if not exists clients_user_id_idx on public.clients(user_id);
create index if not exists clients_name_idx on public.clients(user_id, name);

create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_read_idx on public.notifications(user_id, read);

create index if not exists audit_log_user_id_idx on public.audit_log(user_id);
create index if not exists audit_log_created_at_idx on public.audit_log(created_at desc);
