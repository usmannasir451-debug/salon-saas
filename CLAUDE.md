@AGENTS.md

# Supabase Migrations — Required Grants

Every migration file that creates a new table MUST include these three GRANT statements immediately after the table's RLS policies:

```sql
grant select, insert, update, delete on public.TABLE_NAME to authenticated;
grant select, insert, update, delete on public.TABLE_NAME to service_role;
grant select on public.TABLE_NAME to anon;
```

This is required for Supabase Data API compliance (policy effective October 30, 2026).
All existing tables are covered by `supabase/grant_all_tables.sql` (run once).
Every new table created after that must include its own grants in the same migration file.
