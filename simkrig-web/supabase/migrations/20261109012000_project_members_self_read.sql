alter table public.project_members enable row level security;

grant select on public.project_members to authenticated;

drop policy if exists project_members_select_self_or_admin
  on public.project_members;

create policy project_members_select_self_or_admin
  on public.project_members
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_active_admin()
  );
