-- Migration v10: Sub-user system fixes
-- Run this in Supabase SQL Editor

-- ── 1. Allow 'inactive' status on salon_members ─────────────────────────────
alter table public.salon_members
  drop constraint if exists salon_members_status_check;

alter table public.salon_members
  add constraint salon_members_status_check
    check (status in ('pending', 'active', 'inactive'));

-- ── 2. Update get_effective_owner_id to only consider 'active' members ───────
-- (re-create to ensure the definition is correct)
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

-- ── 3. Fix DELETE policies to use get_effective_owner_id (not role-only) ─────

-- APPOINTMENTS
drop policy if exists "Delete salon appointments" on public.appointments;
create policy "Delete salon appointments" on public.appointments
  for delete using (user_id = get_effective_owner_id());

-- SERVICES
drop policy if exists "Delete salon services" on public.services;
create policy "Delete salon services" on public.services
  for delete using (user_id = get_effective_owner_id());

-- STAFF
drop policy if exists "Delete salon staff" on public.staff;
create policy "Delete salon staff" on public.staff
  for delete using (user_id = get_effective_owner_id());

-- BRANCHES
drop policy if exists "Delete salon branches" on public.branches;
create policy "Delete salon branches" on public.branches
  for delete using (user_id = get_effective_owner_id());

-- WALK_INS
drop policy if exists "Delete salon walk_ins" on public.walk_ins;
create policy "Delete salon walk_ins" on public.walk_ins
  for delete using (user_id = get_effective_owner_id());

-- ── 4. Ensure RLS policies exist for all data tables ─────────────────────────
-- (These may already exist from prior migrations, but we use IF NOT EXISTS
--  equivalents by dropping first)

-- CLIENTS (if table exists)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='clients') then
    drop policy if exists "View salon clients" on public.clients;
    drop policy if exists "Insert salon clients" on public.clients;
    drop policy if exists "Update salon clients" on public.clients;
    drop policy if exists "Delete salon clients" on public.clients;
    drop policy if exists "Users can view own clients" on public.clients;
    drop policy if exists "Users can insert own clients" on public.clients;
    drop policy if exists "Users can update own clients" on public.clients;
    drop policy if exists "Users can delete own clients" on public.clients;

    execute 'create policy "View salon clients" on public.clients
      for select using (user_id = get_effective_owner_id())';
    execute 'create policy "Insert salon clients" on public.clients
      for insert with check (user_id = get_effective_owner_id())';
    execute 'create policy "Update salon clients" on public.clients
      for update using (user_id = get_effective_owner_id())';
    execute 'create policy "Delete salon clients" on public.clients
      for delete using (user_id = get_effective_owner_id())';
  end if;
end $$;

-- EXPENSES (if table exists)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='expenses') then
    drop policy if exists "View salon expenses" on public.expenses;
    drop policy if exists "Insert salon expenses" on public.expenses;
    drop policy if exists "Update salon expenses" on public.expenses;
    drop policy if exists "Delete salon expenses" on public.expenses;
    drop policy if exists "Users can view own expenses" on public.expenses;
    drop policy if exists "Users can insert own expenses" on public.expenses;
    drop policy if exists "Users can update own expenses" on public.expenses;
    drop policy if exists "Users can delete own expenses" on public.expenses;

    execute 'create policy "View salon expenses" on public.expenses
      for select using (user_id = get_effective_owner_id())';
    execute 'create policy "Insert salon expenses" on public.expenses
      for insert with check (user_id = get_effective_owner_id())';
    execute 'create policy "Update salon expenses" on public.expenses
      for update using (user_id = get_effective_owner_id())';
    execute 'create policy "Delete salon expenses" on public.expenses
      for delete using (user_id = get_effective_owner_id())';
  end if;
end $$;

-- INVENTORY (if table exists)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='inventory') then
    drop policy if exists "View salon inventory" on public.inventory;
    drop policy if exists "Insert salon inventory" on public.inventory;
    drop policy if exists "Update salon inventory" on public.inventory;
    drop policy if exists "Delete salon inventory" on public.inventory;
    drop policy if exists "Users can view own inventory" on public.inventory;
    drop policy if exists "Users can insert own inventory" on public.inventory;
    drop policy if exists "Users can update own inventory" on public.inventory;
    drop policy if exists "Users can delete own inventory" on public.inventory;

    execute 'create policy "View salon inventory" on public.inventory
      for select using (user_id = get_effective_owner_id())';
    execute 'create policy "Insert salon inventory" on public.inventory
      for insert with check (user_id = get_effective_owner_id())';
    execute 'create policy "Update salon inventory" on public.inventory
      for update using (user_id = get_effective_owner_id())';
    execute 'create policy "Delete salon inventory" on public.inventory
      for delete using (user_id = get_effective_owner_id())';
  end if;
end $$;

-- NOTIFICATIONS (if table exists)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='notifications') then
    drop policy if exists "View salon notifications" on public.notifications;
    drop policy if exists "Insert salon notifications" on public.notifications;
    drop policy if exists "Update salon notifications" on public.notifications;
    drop policy if exists "Users can view own notifications" on public.notifications;
    drop policy if exists "Users can insert own notifications" on public.notifications;
    drop policy if exists "Users can update own notifications" on public.notifications;

    execute 'create policy "View salon notifications" on public.notifications
      for select using (user_id = get_effective_owner_id())';
    execute 'create policy "Insert salon notifications" on public.notifications
      for insert with check (user_id = get_effective_owner_id())';
    execute 'create policy "Update salon notifications" on public.notifications
      for update using (user_id = get_effective_owner_id())';
  end if;
end $$;

-- DEALS (if table exists)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='deals') then
    drop policy if exists "View salon deals" on public.deals;
    drop policy if exists "Insert salon deals" on public.deals;
    drop policy if exists "Update salon deals" on public.deals;
    drop policy if exists "Delete salon deals" on public.deals;
    drop policy if exists "Users can view own deals" on public.deals;
    drop policy if exists "Users can insert own deals" on public.deals;
    drop policy if exists "Users can update own deals" on public.deals;
    drop policy if exists "Users can delete own deals" on public.deals;

    execute 'create policy "View salon deals" on public.deals
      for select using (user_id = get_effective_owner_id())';
    execute 'create policy "Insert salon deals" on public.deals
      for insert with check (user_id = get_effective_owner_id())';
    execute 'create policy "Update salon deals" on public.deals
      for update using (user_id = get_effective_owner_id())';
    execute 'create policy "Delete salon deals" on public.deals
      for delete using (user_id = get_effective_owner_id())';
  end if;
end $$;

-- AUDIT_LOG (if table exists)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='audit_log') then
    drop policy if exists "View salon audit_log" on public.audit_log;
    drop policy if exists "Insert salon audit_log" on public.audit_log;
    drop policy if exists "Users can view own audit_log" on public.audit_log;
    drop policy if exists "Users can insert own audit_log" on public.audit_log;

    execute 'create policy "View salon audit_log" on public.audit_log
      for select using (user_id = get_effective_owner_id())';
    execute 'create policy "Insert salon audit_log" on public.audit_log
      for insert with check (user_id = get_effective_owner_id())';
  end if;
end $$;

-- WALK_IN_SERVICES junction table (if table exists)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='walk_in_services') then
    -- walk_in_services links to walk_ins, allow access if linked walk_in is accessible
    drop policy if exists "View salon walk_in_services" on public.walk_in_services;
    drop policy if exists "Insert salon walk_in_services" on public.walk_in_services;
    drop policy if exists "Users can view own walk_in_services" on public.walk_in_services;
    drop policy if exists "Users can insert own walk_in_services" on public.walk_in_services;

    execute 'create policy "View salon walk_in_services" on public.walk_in_services
      for select using (
        exists (
          select 1 from public.walk_ins w
          where w.id = walk_in_id and w.user_id = get_effective_owner_id()
        )
      )';
    execute 'create policy "Insert salon walk_in_services" on public.walk_in_services
      for insert with check (
        exists (
          select 1 from public.walk_ins w
          where w.id = walk_in_id and w.user_id = get_effective_owner_id()
        )
      )';
  end if;
end $$;

-- LOYALTY_TRANSACTIONS (if table exists)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='loyalty_transactions') then
    drop policy if exists "View salon loyalty_transactions" on public.loyalty_transactions;
    drop policy if exists "Insert salon loyalty_transactions" on public.loyalty_transactions;
    drop policy if exists "Users can view own loyalty_transactions" on public.loyalty_transactions;
    drop policy if exists "Users can insert own loyalty_transactions" on public.loyalty_transactions;

    execute 'create policy "View salon loyalty_transactions" on public.loyalty_transactions
      for select using (user_id = get_effective_owner_id())';
    execute 'create policy "Insert salon loyalty_transactions" on public.loyalty_transactions
      for insert with check (user_id = get_effective_owner_id())';
  end if;
end $$;

-- ── 5. Allow sub-users to read owner's profile (for salon settings like currency) ──
drop policy if exists "Members can view owner profile" on public.profiles;
create policy "Members can view owner profile" on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.salon_members
      where member_user_id = auth.uid()
        and owner_id = profiles.id
        and status = 'active'
    )
  );
