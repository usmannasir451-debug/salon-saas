-- Migration v9: Leads table + salon_members custom permissions
-- Run this in Supabase SQL Editor BEFORE deploying the updated code

-- ── LEADS TABLE ────────────────────────────────────────────────────────────

create table if not exists public.leads (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  phone text not null,
  salon_name text not null,
  branches text not null,
  city text not null,
  source text not null,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'converted', 'lost')),
  notes text,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null
);

alter table public.leads enable row level security;

-- Public (landing page visitors) can submit leads
create policy "Anyone can submit a lead" on public.leads
  for insert with check (true);

-- Only service role (admin) can read/update/delete via admin client (bypasses RLS)

-- Grants
grant select, insert, update, delete on public.leads to authenticated;
grant select, insert, update, delete on public.leads to service_role;
grant select on public.leads to anon;

create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_created_at on public.leads(created_at desc);

-- ── SALON_MEMBERS ENHANCEMENTS ─────────────────────────────────────────────

-- display_name: custom label like "Front Desk", "Cashier" etc.
alter table public.salon_members
  add column if not exists display_name text;

-- permissions: array of page keys e.g. ['dashboard','appointments','walkin']
-- null = use legacy role-based access (ROLE_NAV[role])
alter table public.salon_members
  add column if not exists permissions jsonb;

-- last_set_password: stored by owner when creating/resetting team member password
alter table public.salon_members
  add column if not exists last_set_password text;
