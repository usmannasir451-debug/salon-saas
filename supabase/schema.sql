-- SalonPro Pakistan - Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  salon_name text,
  created_at timestamptz default now() not null
);

-- Services table
create table if not exists public.services (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  duration integer not null default 30,
  price numeric(10, 2) not null default 0,
  created_at timestamptz default now() not null
);

-- Staff table
create table if not exists public.staff (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  phone text not null,
  created_at timestamptz default now() not null
);

-- Appointments table
create table if not exists public.appointments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  client_name text not null,
  service_id uuid references public.services(id) on delete set null,
  staff_id uuid references public.staff(id) on delete set null,
  appointment_date date not null,
  appointment_time time not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz default now() not null
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.staff enable row level security;
alter table public.appointments enable row level security;

-- Profiles policies
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Services policies
create policy "Users can view own services" on public.services
  for select using (auth.uid() = user_id);

create policy "Users can insert own services" on public.services
  for insert with check (auth.uid() = user_id);

create policy "Users can update own services" on public.services
  for update using (auth.uid() = user_id);

create policy "Users can delete own services" on public.services
  for delete using (auth.uid() = user_id);

-- Staff policies
create policy "Users can view own staff" on public.staff
  for select using (auth.uid() = user_id);

create policy "Users can insert own staff" on public.staff
  for insert with check (auth.uid() = user_id);

create policy "Users can update own staff" on public.staff
  for update using (auth.uid() = user_id);

create policy "Users can delete own staff" on public.staff
  for delete using (auth.uid() = user_id);

-- Appointments policies
create policy "Users can view own appointments" on public.appointments
  for select using (auth.uid() = user_id);

create policy "Users can insert own appointments" on public.appointments
  for insert with check (auth.uid() = user_id);

create policy "Users can update own appointments" on public.appointments
  for update using (auth.uid() = user_id);

create policy "Users can delete own appointments" on public.appointments
  for delete using (auth.uid() = user_id);

-- Auto-create profile on signup trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- MIGRATION v2: branches, client_phone, branch_id
-- Run this block in Supabase SQL Editor after the initial setup
-- ============================================================

-- Add client WhatsApp phone to appointments
alter table public.appointments add column if not exists client_phone text;

-- Branches table (multi-location support)
create table if not exists public.branches (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  address text,
  phone text,
  created_at timestamptz default now() not null
);

alter table public.branches enable row level security;

create policy "Users can view own branches" on public.branches
  for select using (auth.uid() = user_id);

create policy "Users can insert own branches" on public.branches
  for insert with check (auth.uid() = user_id);

create policy "Users can update own branches" on public.branches
  for update using (auth.uid() = user_id);

create policy "Users can delete own branches" on public.branches
  for delete using (auth.uid() = user_id);

-- Link appointments to a branch (nullable — works for single-branch salons too)
alter table public.appointments add column if not exists branch_id uuid references public.branches(id) on delete set null;

-- ============================================================
-- MIGRATION v3: Role-Based Access Control (RBAC)
-- Run this block in Supabase SQL Editor after v2
-- ============================================================

-- Payment tracking on appointments
alter table public.appointments
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid'));

alter table public.appointments
  add column if not exists discount_amount numeric(10, 2) not null default 0;

alter table public.appointments
  add column if not exists feedback text;

-- Link a staff member's portal account to their staff record
alter table public.staff
  add column if not exists linked_user_id uuid references auth.users(id) on delete set null;

-- Salon team members (role-based portal access)
create table if not exists public.salon_members (
  id            uuid default uuid_generate_v4() primary key,
  owner_id      uuid references public.profiles(id) on delete cascade not null,
  member_user_id uuid references auth.users(id) on delete set null,
  email         text not null,
  role          text not null check (role in ('manager', 'receptionist', 'cashier', 'staff')),
  staff_id      uuid references public.staff(id) on delete set null,
  status        text not null default 'pending' check (status in ('pending', 'active')),
  invited_at    timestamptz default now() not null,
  joined_at     timestamptz,
  unique(owner_id, email)
);

alter table public.salon_members enable row level security;

-- Owners can fully manage their team
create policy "Owners can manage their team" on public.salon_members
  for all using (auth.uid() = owner_id);

-- Members can see their own membership row
create policy "Members can view own membership" on public.salon_members
  for select using (auth.uid() = member_user_id);

-- ─── Helper: returns the effective salon owner id for the current user ─────────
-- For owners: returns their own auth.uid()
-- For team members: returns the owner's profile id they belong to
create or replace function public.get_effective_owner_id()
returns uuid
language sql security definer stable
as $$
  select coalesce(
    (
      select owner_id
      from public.salon_members
      where member_user_id = auth.uid()
        and status = 'active'
      limit 1
    ),
    auth.uid()
  )
$$;

-- ─── Update RLS: replace user-only policies with owner+member policies ─────────

-- APPOINTMENTS
drop policy if exists "Users can view own appointments"   on public.appointments;
drop policy if exists "Users can insert own appointments" on public.appointments;
drop policy if exists "Users can update own appointments" on public.appointments;
drop policy if exists "Users can delete own appointments" on public.appointments;

create policy "View salon appointments" on public.appointments
  for select using (user_id = get_effective_owner_id());

create policy "Insert salon appointments" on public.appointments
  for insert with check (user_id = get_effective_owner_id());

create policy "Update salon appointments" on public.appointments
  for update using (user_id = get_effective_owner_id());

create policy "Delete salon appointments" on public.appointments
  for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from public.salon_members
      where member_user_id = auth.uid()
        and owner_id = public.appointments.user_id
        and role = 'manager'
        and status = 'active'
    )
  );

-- SERVICES
drop policy if exists "Users can view own services"   on public.services;
drop policy if exists "Users can insert own services" on public.services;
drop policy if exists "Users can update own services" on public.services;
drop policy if exists "Users can delete own services" on public.services;

create policy "View salon services" on public.services
  for select using (user_id = get_effective_owner_id());

create policy "Insert salon services" on public.services
  for insert with check (user_id = get_effective_owner_id());

create policy "Update salon services" on public.services
  for update using (user_id = get_effective_owner_id());

create policy "Delete salon services" on public.services
  for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from public.salon_members
      where member_user_id = auth.uid()
        and owner_id = public.services.user_id
        and role = 'manager'
        and status = 'active'
    )
  );

-- STAFF
drop policy if exists "Users can view own staff"   on public.staff;
drop policy if exists "Users can insert own staff" on public.staff;
drop policy if exists "Users can update own staff" on public.staff;
drop policy if exists "Users can delete own staff" on public.staff;

create policy "View salon staff" on public.staff
  for select using (user_id = get_effective_owner_id());

create policy "Insert salon staff" on public.staff
  for insert with check (user_id = get_effective_owner_id());

create policy "Update salon staff" on public.staff
  for update using (user_id = get_effective_owner_id());

create policy "Delete salon staff" on public.staff
  for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from public.salon_members
      where member_user_id = auth.uid()
        and owner_id = public.staff.user_id
        and role = 'manager'
        and status = 'active'
    )
  );

-- BRANCHES
drop policy if exists "Users can view own branches"   on public.branches;
drop policy if exists "Users can insert own branches" on public.branches;
drop policy if exists "Users can update own branches" on public.branches;
drop policy if exists "Users can delete own branches" on public.branches;

create policy "View salon branches" on public.branches
  for select using (user_id = get_effective_owner_id());

create policy "Insert salon branches" on public.branches
  for insert with check (user_id = get_effective_owner_id());

create policy "Update salon branches" on public.branches
  for update using (user_id = get_effective_owner_id());

create policy "Delete salon branches" on public.branches
  for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from public.salon_members
      where member_user_id = auth.uid()
        and owner_id = public.branches.user_id
        and role = 'manager'
        and status = 'active'
    )
  );
