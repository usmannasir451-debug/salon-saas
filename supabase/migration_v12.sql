-- Add pro-rata columns to payroll_entries
alter table public.payroll_entries
  add column if not exists prorata_pct numeric(5,1),
  add column if not exists prorata_detail text;
