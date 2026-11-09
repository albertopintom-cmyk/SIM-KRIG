alter table public.user_profiles
  add column if not exists display_name text,
  add column if not exists is_active boolean not null default true;

create table if not exists public.project_members (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  assigned_at timestamptz not null default now()
);

alter table public.projects
  add column if not exists project_type text not null default 'teacher',
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists last_activity_at timestamptz;

alter table public.projects
  add constraint projects_project_type_check
  check (project_type in ('teacher', 'group'));

update public.projects
set project_type = 'group'
where exists (
  select 1
  from public.project_members
  where project_members.project_id = projects.id
);

update public.projects
set owner_id = (
  select user_profiles.id
  from public.user_profiles
  where user_profiles.role = 'admin'
  order by user_profiles.created_at
  limit 1
)
where owner_id is null;

create table if not exists public.cutoff_runs (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  cutoff_grade numeric not null check (cutoff_grade >= 0),
  recoverable_tonnage numeric not null,
  average_grade numeric,
  fine_metal numeric not null,
  mineral_block_count integer not null check (mineral_block_count >= 0),
  waste_block_count integer not null check (waste_block_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists cutoff_runs_project_time_idx
  on public.cutoff_runs(project_id, created_at desc);

update public.projects
set last_activity_at = (
  select max(historical_activity.occurred_at)
  from (
    select project_files.uploaded_at as occurred_at
    from public.project_files
    where project_files.project_id = projects.id
    union all
    select estimation_blocks.created_at
    from public.estimation_blocks
    where estimation_blocks.project_id = projects.id
  ) as historical_activity
)
where last_activity_at is null;

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = (select auth.uid())
      and role = 'admin'
      and is_active
  );
$$;

create or replace function public.can_access_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (select auth.role()) = 'service_role'
    or public.is_active_admin()
    or exists (
      select 1
      from public.project_members
      join public.user_profiles
        on user_profiles.id = project_members.user_id
      where project_members.project_id = p_project_id
        and project_members.user_id = (select auth.uid())
        and user_profiles.role = 'student_group'
        and user_profiles.is_active
    );
$$;

revoke all on function public.is_active_admin() from public, anon;
revoke all on function public.can_access_project(uuid) from public, anon;
grant execute on function public.is_active_admin() to authenticated;
grant execute on function public.can_access_project(uuid) to authenticated;

do $$
declare
  target_table text;
  policy_record record;
begin
  foreach target_table in array array[
    'projects',
    'project_files',
    'drillholes',
    'estimation_blocks',
    'block_variables',
    'project_members',
    'cutoff_runs'
  ]
  loop
    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = target_table
    loop
      execute format(
        'drop policy %I on public.%I',
        policy_record.policyname,
        target_table
      );
    end loop;

    execute format('alter table public.%I enable row level security', target_table);
    execute format('revoke all on public.%I from anon', target_table);
  end loop;
end;
$$;

grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete
  on public.project_files, public.drillholes,
     public.estimation_blocks, public.block_variables
  to authenticated;
grant select on public.project_members to authenticated;
grant select, insert on public.cutoff_runs to authenticated;
grant usage, select on sequence public.cutoff_runs_id_seq to authenticated;

create policy projects_select_accessible
  on public.projects
  for select to authenticated
  using (public.can_access_project(id));

create policy projects_insert_teacher_owned
  on public.projects
  for insert to authenticated
  with check (
    public.is_active_admin()
    and project_type = 'teacher'
    and owner_id = (select auth.uid())
  );

create policy projects_update_teacher_owned
  on public.projects
  for update to authenticated
  using (
    public.is_active_admin()
    and project_type = 'teacher'
    and owner_id = (select auth.uid())
  )
  with check (
    public.is_active_admin()
    and project_type = 'teacher'
    and owner_id = (select auth.uid())
  );

create policy projects_delete_teacher_owned
  on public.projects
  for delete to authenticated
  using (
    public.is_active_admin()
    and project_type = 'teacher'
    and owner_id = (select auth.uid())
  );

create policy project_members_select_self_or_admin
  on public.project_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_active_admin()
  );

create policy project_files_access
  on public.project_files
  for all to authenticated
  using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));

create policy drillholes_access
  on public.drillholes
  for all to authenticated
  using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));

create policy estimation_blocks_access
  on public.estimation_blocks
  for all to authenticated
  using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));

create policy block_variables_access
  on public.block_variables
  for all to authenticated
  using (
    exists (
      select 1
      from public.estimation_blocks
      where estimation_blocks.id = block_variables.block_id
        and public.can_access_project(estimation_blocks.project_id)
    )
  )
  with check (
    exists (
      select 1
      from public.estimation_blocks
      where estimation_blocks.id = block_variables.block_id
        and public.can_access_project(estimation_blocks.project_id)
    )
  );

create policy cutoff_runs_select_accessible
  on public.cutoff_runs
  for select to authenticated
  using (public.can_access_project(project_id));

create policy cutoff_runs_insert_accessible
  on public.cutoff_runs
  for insert to authenticated
  with check (
    public.can_access_project(project_id)
    and created_by = (select auth.uid())
  );

create or replace function public.touch_project_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected_project_id uuid;
begin
  if tg_op = 'DELETE' then
    affected_project_id := old.project_id;
  else
    affected_project_id := new.project_id;
  end if;
  update public.projects
  set last_activity_at = now()
  where id = affected_project_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists project_files_touch_activity on public.project_files;
create trigger project_files_touch_activity
  after insert or update or delete on public.project_files
  for each row execute function public.touch_project_activity();

drop trigger if exists drillholes_touch_activity on public.drillholes;
create trigger drillholes_touch_activity
  after insert or update or delete on public.drillholes
  for each row execute function public.touch_project_activity();

drop trigger if exists estimation_blocks_touch_activity
  on public.estimation_blocks;
create trigger estimation_blocks_touch_activity
  after insert or update or delete on public.estimation_blocks
  for each row execute function public.touch_project_activity();

drop trigger if exists cutoff_runs_touch_activity on public.cutoff_runs;
create trigger cutoff_runs_touch_activity
  after insert on public.cutoff_runs
  for each row execute function public.touch_project_activity();

create or replace function public.reset_project_data(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_project_id is null or not public.can_access_project(p_project_id) then
    raise exception 'Not authorized to reset this project';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_project_id::text, 0)
  );

  delete from public.block_variables
  using public.estimation_blocks
  where estimation_blocks.id = block_variables.block_id
    and estimation_blocks.project_id = p_project_id;

  delete from public.estimation_blocks
  where project_id = p_project_id;
  delete from public.drillholes
  where project_id = p_project_id;
  delete from public.project_files
  where project_id = p_project_id;
  delete from public.cutoff_runs
  where project_id = p_project_id;

  if exists (
    select 1 from public.estimation_blocks where project_id = p_project_id
  ) or exists (
    select 1 from public.drillholes where project_id = p_project_id
  ) or exists (
    select 1 from public.project_files where project_id = p_project_id
  ) or exists (
    select 1 from public.cutoff_runs where project_id = p_project_id
  ) or exists (
    select 1
    from public.block_variables
    join public.estimation_blocks
      on estimation_blocks.id = block_variables.block_id
    where estimation_blocks.project_id = p_project_id
  ) then
    raise exception 'Project data reset was incomplete';
  end if;
end;
$$;

revoke all on function public.reset_project_data(uuid) from public, anon;
grant execute on function public.reset_project_data(uuid) to authenticated, service_role;

create or replace function public.save_estimation_blocks(
  p_project_id uuid,
  p_blocks jsonb
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  saved_count integer;
begin
  if p_project_id is null or not public.can_access_project(p_project_id) then
    raise exception 'Not authorized to save blocks for this project';
  end if;
  if p_blocks is null or jsonb_typeof(p_blocks) <> 'array' then
    raise exception 'p_blocks must be a JSON array';
  end if;
  if jsonb_array_length(p_blocks) = 0 then
    raise exception 'At least one block is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_project_id::text, 0)
  );

  delete from public.estimation_blocks where project_id = p_project_id;

  insert into public.estimation_blocks (project_id, block_name, area, geometry)
  select p_project_id, block_data.block_name, block_data.area, block_data.geometry
  from jsonb_to_recordset(p_blocks) as block_data(
    block_name text,
    area numeric,
    geometry jsonb,
    variables jsonb
  );
  get diagnostics saved_count = row_count;

  insert into public.block_variables (
    block_id, variable_name, value, unit, calculation_method
  )
  select
    estimation_blocks.id,
    variable_data.variable_name,
    variable_data.value,
    variable_data.unit,
    variable_data.calculation_method
  from jsonb_to_recordset(p_blocks) as block_data(
    block_name text,
    area numeric,
    geometry jsonb,
    variables jsonb
  )
  join public.estimation_blocks
    on estimation_blocks.project_id = p_project_id
    and estimation_blocks.block_name = block_data.block_name
  cross join lateral jsonb_to_recordset(block_data.variables) as variable_data(
    variable_name text,
    value numeric,
    unit text,
    calculation_method text
  );

  return saved_count;
end;
$$;

revoke all on function public.save_estimation_blocks(uuid, jsonb)
  from public, anon;
grant execute on function public.save_estimation_blocks(uuid, jsonb)
  to authenticated;

notify pgrst, 'reload schema';
