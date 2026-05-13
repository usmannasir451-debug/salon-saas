-- ============================================================
-- ONE-TIME GRANTS SCRIPT — Supabase Data API Compliance
-- Required before October 30, 2026 per Supabase security policy.
-- Run this once in your Supabase SQL Editor.
-- ============================================================

-- NOTE: Table 'audit_log' is used below (the migration creates it as audit_log, not audit_logs).
-- If your database uses 'audit_logs' instead, swap the name accordingly.

-- profiles
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;
grant select on public.profiles to anon;

-- appointments
grant select, insert, update, delete on public.appointments to authenticated;
grant select, insert, update, delete on public.appointments to service_role;
grant select on public.appointments to anon;

-- walk_ins
grant select, insert, update, delete on public.walk_ins to authenticated;
grant select, insert, update, delete on public.walk_ins to service_role;
grant select on public.walk_ins to anon;

-- staff
grant select, insert, update, delete on public.staff to authenticated;
grant select, insert, update, delete on public.staff to service_role;
grant select on public.staff to anon;

-- services
grant select, insert, update, delete on public.services to authenticated;
grant select, insert, update, delete on public.services to service_role;
grant select on public.services to anon;

-- clients
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.clients to service_role;
grant select on public.clients to anon;

-- expenses
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.expenses to service_role;
grant select on public.expenses to anon;

-- inventory (include if this table exists in your DB)
grant select, insert, update, delete on public.inventory to authenticated;
grant select, insert, update, delete on public.inventory to service_role;
grant select on public.inventory to anon;

-- inventory_items
grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert, update, delete on public.inventory_items to service_role;
grant select on public.inventory_items to anon;

-- stock_adjustments
grant select, insert, update, delete on public.stock_adjustments to authenticated;
grant select, insert, update, delete on public.stock_adjustments to service_role;
grant select on public.stock_adjustments to anon;

-- staff_salaries
grant select, insert, update, delete on public.staff_salaries to authenticated;
grant select, insert, update, delete on public.staff_salaries to service_role;
grant select on public.staff_salaries to anon;

-- payroll_entries
grant select, insert, update, delete on public.payroll_entries to authenticated;
grant select, insert, update, delete on public.payroll_entries to service_role;
grant select on public.payroll_entries to anon;

-- reviews
grant select, insert, update, delete on public.reviews to authenticated;
grant select, insert, update, delete on public.reviews to service_role;
grant select on public.reviews to anon;

-- deals
grant select, insert, update, delete on public.deals to authenticated;
grant select, insert, update, delete on public.deals to service_role;
grant select on public.deals to anon;

-- deal_services
grant select, insert, update, delete on public.deal_services to authenticated;
grant select, insert, update, delete on public.deal_services to service_role;
grant select on public.deal_services to anon;

-- branches
grant select, insert, update, delete on public.branches to authenticated;
grant select, insert, update, delete on public.branches to service_role;
grant select on public.branches to anon;

-- salon_members
grant select, insert, update, delete on public.salon_members to authenticated;
grant select, insert, update, delete on public.salon_members to service_role;
grant select on public.salon_members to anon;

-- leads
grant select, insert, update, delete on public.leads to authenticated;
grant select, insert, update, delete on public.leads to service_role;
grant select on public.leads to anon;

-- notifications
grant select, insert, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.notifications to service_role;
grant select on public.notifications to anon;

-- audit_log (created as 'audit_log' in migration_v6 — prompt listed 'audit_logs')
grant select, insert, update, delete on public.audit_log to authenticated;
grant select, insert, update, delete on public.audit_log to service_role;
grant select on public.audit_log to anon;

-- loyalty_transactions
grant select, insert, update, delete on public.loyalty_transactions to authenticated;
grant select, insert, update, delete on public.loyalty_transactions to service_role;
grant select on public.loyalty_transactions to anon;

-- Additional tables present in migrations (not in original list but exist in DB)

-- appointment_services
grant select, insert, update, delete on public.appointment_services to authenticated;
grant select, insert, update, delete on public.appointment_services to service_role;
grant select on public.appointment_services to anon;

-- walk_in_services
grant select, insert, update, delete on public.walk_in_services to authenticated;
grant select, insert, update, delete on public.walk_in_services to service_role;
grant select on public.walk_in_services to anon;

-- custom_inventory_categories
grant select, insert, update, delete on public.custom_inventory_categories to authenticated;
grant select, insert, update, delete on public.custom_inventory_categories to service_role;
grant select on public.custom_inventory_categories to anon;

-- attendance
grant select, insert, update, delete on public.attendance to authenticated;
grant select, insert, update, delete on public.attendance to service_role;
grant select on public.attendance to anon;
