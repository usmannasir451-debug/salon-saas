-- Add branch_id to salon_members for sub-user branch assignment
ALTER TABLE public.salon_members
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- Add index for branch lookups
CREATE INDEX IF NOT EXISTS salon_members_branch_id_idx ON public.salon_members(branch_id);

-- Ensure appointment statuses include no_show
-- (no_show is stored as a text value, no enum constraint needed)

grant select, insert, update, delete on public.salon_members to authenticated;
grant select, insert, update, delete on public.salon_members to service_role;
grant select on public.salon_members to anon;
