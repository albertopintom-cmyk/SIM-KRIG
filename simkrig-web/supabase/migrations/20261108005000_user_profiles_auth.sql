create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_]{3,64}$'),
  role text not null default 'student_group'
    check (role in ('admin', 'student_group')),
  created_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

grant select on public.user_profiles to authenticated;

drop policy if exists user_profiles_select_self
  on public.user_profiles;
create policy user_profiles_select_self
  on public.user_profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create or replace function public.create_user_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_username text;
begin
  new_username := lower(
    split_part(coalesce(new.email, ''), '@', 1)
  );

  insert into public.user_profiles (id, username, role)
  values (new.id, new_username, 'student_group')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_user_profile_after_auth_signup
  on auth.users;
create trigger create_user_profile_after_auth_signup
  after insert on auth.users
  for each row execute function public.create_user_profile_for_auth_user();

insert into public.user_profiles (id, username, role)
select
  users.id,
  lower(split_part(coalesce(users.email, ''), '@', 1)),
  'student_group'
from auth.users as users
where split_part(coalesce(users.email, ''), '@', 1) ~ '^[a-zA-Z0-9_]{3,64}$'
on conflict (id) do nothing;

revoke all on function public.create_user_profile_for_auth_user()
  from public, anon, authenticated;

-- Promote the instructor profile to admin explicitly from the trusted SQL editor.
