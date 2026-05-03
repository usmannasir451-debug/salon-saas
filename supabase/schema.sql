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
