create table if not exists public.project_members (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  assigned_at timestamptz not null default now()
);

revoke all on public.project_members from anon, authenticated;
grant all on public.project_members to service_role;

create sequence if not exists public.student_group_username_seq;

do $$
declare
  highest_group_number bigint;
begin
  select coalesce(
    max(substring(username from '^es2_g([0-9]+)$')::bigint),
    0
  )
  into highest_group_number
  from public.user_profiles
  where username ~ '^es2_g[0-9]+$';

  if highest_group_number = 0 then
    perform setval('public.student_group_username_seq', 1, false);
  else
    perform setval(
      'public.student_group_username_seq',
      highest_group_number,
      true
    );
  end if;
end;
$$;

create or replace function public.reserve_next_group_username()
returns text
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  select 'es2_g' || lpad(
    nextval('public.student_group_username_seq')::text,
    2,
    '0'
  );
$$;

revoke all on function public.reserve_next_group_username()
  from public, anon, authenticated;
grant execute on function public.reserve_next_group_username()
  to service_role;
