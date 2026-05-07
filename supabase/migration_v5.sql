-- SalonPro Migration v5
-- Parts 8-12: Expenses, Inventory, Payroll
-- Run in Supabase SQL Editor

-- ═══════════════════════════════════════════════════════
-- PART 8: EXPENSES
-- ═══════════════════════════════════════════════════════

create table if not exists public.expenses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  category text not null check (category in (
    'staff_refreshments', 'salon_materials', 'inventory',
    'utilities', 'rent', 'marketing', 'miscellaneous'
  )),
  description text not null,
  amount numeric(12, 2) not null default 0,
  expense_date date not null,
  paid_by text,
  notes text,
  is_recurring boolean not null default false,
  created_at timestamptz default now() not null
);

alter table public.expenses enable row level security;

create policy "expenses_select" on public.expenses
  for select using (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
    )
  );

create policy "expenses_insert" on public.expenses
  for insert with check (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
        and role in ('manager')
    )
  );

create policy "expenses_update" on public.expenses
  for update using (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
        and role in ('manager')
    )
  );

create policy "expenses_delete" on public.expenses
  for delete using (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
        and role in ('manager')
    )
  );

-- ═══════════════════════════════════════════════════════
-- PART 9: INVENTORY
-- ═══════════════════════════════════════════════════════

create table if not exists public.inventory_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  category text not null check (category in (
    'hair_products', 'skin_products', 'tools', 'equipment', 'consumables'
  )),
  quantity numeric(12, 2) not null default 0,
  unit text not null default 'pcs',
  reorder_level numeric(12, 2) not null default 0,
  cost_price numeric(12, 2) not null default 0,
  supplier text,
  created_at timestamptz default now() not null
);

create table if not exists public.stock_adjustments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  item_id uuid references public.inventory_items(id) on delete cascade not null,
  adjustment numeric(12, 2) not null,
  reason text not null,
  adjusted_by text,
  created_at timestamptz default now() not null
);

alter table public.inventory_items enable row level security;
alter table public.stock_adjustments enable row level security;

-- inventory_items policies
create policy "inventory_items_select" on public.inventory_items
  for select using (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
    )
  );

create policy "inventory_items_insert" on public.inventory_items
  for insert with check (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
        and role in ('manager')
    )
  );

create policy "inventory_items_update" on public.inventory_items
  for update using (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
        and role in ('manager')
    )
  );

create policy "inventory_items_delete" on public.inventory_items
  for delete using (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
        and role in ('manager')
    )
  );

-- stock_adjustments policies
create policy "stock_adj_select" on public.stock_adjustments
  for select using (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
    )
  );

create policy "stock_adj_insert" on public.stock_adjustments
  for insert with check (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
        and role in ('manager')
    )
  );

-- ═══════════════════════════════════════════════════════
-- PART 10: PAYROLL
-- ═══════════════════════════════════════════════════════

create table if not exists public.staff_salaries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  staff_id uuid references public.staff(id) on delete cascade not null,
  salary_type text not null default 'fixed' check (salary_type in ('fixed', 'commission', 'both')),
  fixed_amount numeric(12, 2) not null default 0,
  commission_pct numeric(5, 2) not null default 0,
  created_at timestamptz default now() not null,
  unique(user_id, staff_id)
);

create table if not exists public.payroll_entries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  staff_id uuid references public.staff(id) on delete cascade not null,
  month date not null,
  fixed_salary numeric(12, 2) not null default 0,
  revenue_generated numeric(12, 2) not null default 0,
  commission_earned numeric(12, 2) not null default 0,
  total_payable numeric(12, 2) not null default 0,
  is_paid boolean not null default false,
  paid_date date,
  paid_method text,
  notes text,
  created_at timestamptz default now() not null,
  unique(user_id, staff_id, month)
);

alter table public.staff_salaries enable row level security;
alter table public.payroll_entries enable row level security;

-- staff_salaries policies
create policy "staff_salaries_select" on public.staff_salaries
  for select using (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
        and role in ('manager')
    )
  );

create policy "staff_salaries_insert" on public.staff_salaries
  for insert with check (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
        and role in ('manager')
    )
  );

create policy "staff_salaries_update" on public.staff_salaries
  for update using (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
        and role in ('manager')
    )
  );

-- payroll_entries policies
create policy "payroll_select" on public.payroll_entries
  for select using (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
        and role in ('manager')
    )
  );

create policy "payroll_insert" on public.payroll_entries
  for insert with check (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
        and role in ('manager')
    )
  );

create policy "payroll_update" on public.payroll_entries
  for update using (
    auth.uid() = user_id
    or auth.uid() in (
      select member_user_id from public.salon_members
      where owner_id = user_id and status = 'active'
        and role in ('manager')
    )
  );

-- ═══════════════════════════════════════════════════════
-- INDEXES for performance
-- ═══════════════════════════════════════════════════════

create index if not exists idx_expenses_user_date on public.expenses(user_id, expense_date);
create index if not exists idx_inventory_items_user on public.inventory_items(user_id);
create index if not exists idx_stock_adj_user_item on public.stock_adjustments(user_id, item_id);
create index if not exists idx_staff_salaries_user on public.staff_salaries(user_id);
create index if not exists idx_payroll_entries_user_month on public.payroll_entries(user_id, month);
