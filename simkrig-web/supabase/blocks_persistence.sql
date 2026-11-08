-- SIM-KRIG block persistence setup.
-- Run this entire script in the Supabase SQL Editor for the project used by the app.

begin;

create table if not exists public.estimation_blocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.projects (id) on delete cascade,
  block_name text not null,
  area numeric not null
    constraint estimation_blocks_area_nonnegative check (area >= 0),
  geometry jsonb not null,
  created_at timestamptz not null default now(),
  constraint estimation_blocks_project_block_name_key
    unique (project_id, block_name)
);

create table if not exists public.block_variables (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null
    references public.estimation_blocks (id) on delete cascade,
  variable_name text not null
    constraint block_variables_variable_name_nonempty
    check (length(trim(variable_name)) > 0),
  variation_type text not null default 'continuous',
  value numeric,
  unit text not null,
  calculation_method text not null,
  created_at timestamptz not null default now(),
  constraint block_variables_block_variable_name_key
    unique (block_id, variable_name)
);

alter table public.block_variables
  add column if not exists variation_type text not null default 'continuous';

create index if not exists estimation_blocks_project_id_idx
  on public.estimation_blocks (project_id);

create index if not exists block_variables_block_id_idx
  on public.block_variables (block_id);

create index if not exists block_variables_variable_name_idx
  on public.block_variables (variable_name);

alter table public.estimation_blocks enable row level security;
alter table public.block_variables enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete
  on public.estimation_blocks, public.block_variables
  to anon, authenticated;

drop policy if exists estimation_blocks_select_existing_projects
  on public.estimation_blocks;
create policy estimation_blocks_select_existing_projects
  on public.estimation_blocks
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.projects
      where projects.id = estimation_blocks.project_id
    )
  );

drop policy if exists estimation_blocks_insert_existing_projects
  on public.estimation_blocks;
create policy estimation_blocks_insert_existing_projects
  on public.estimation_blocks
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1
      from public.projects
      where projects.id = estimation_blocks.project_id
    )
  );

drop policy if exists estimation_blocks_update_existing_projects
  on public.estimation_blocks;
create policy estimation_blocks_update_existing_projects
  on public.estimation_blocks
  for update
  to anon, authenticated
  using (
    exists (
      select 1
      from public.projects
      where projects.id = estimation_blocks.project_id
    )
  )
  with check (
    exists (
      select 1
      from public.projects
      where projects.id = estimation_blocks.project_id
    )
  );

drop policy if exists estimation_blocks_delete_existing_projects
  on public.estimation_blocks;
create policy estimation_blocks_delete_existing_projects
  on public.estimation_blocks
  for delete
  to anon, authenticated
  using (
    exists (
      select 1
      from public.projects
      where projects.id = estimation_blocks.project_id
    )
  );

drop policy if exists block_variables_select_existing_projects
  on public.block_variables;
create policy block_variables_select_existing_projects
  on public.block_variables
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.estimation_blocks
      join public.projects on projects.id = estimation_blocks.project_id
      where estimation_blocks.id = block_variables.block_id
    )
  );

drop policy if exists block_variables_insert_existing_projects
  on public.block_variables;
create policy block_variables_insert_existing_projects
  on public.block_variables
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1
      from public.estimation_blocks
      join public.projects on projects.id = estimation_blocks.project_id
      where estimation_blocks.id = block_variables.block_id
    )
  );

drop policy if exists block_variables_update_existing_projects
  on public.block_variables;
create policy block_variables_update_existing_projects
  on public.block_variables
  for update
  to anon, authenticated
  using (
    exists (
      select 1
      from public.estimation_blocks
      join public.projects on projects.id = estimation_blocks.project_id
      where estimation_blocks.id = block_variables.block_id
    )
  )
  with check (
    exists (
      select 1
      from public.estimation_blocks
      join public.projects on projects.id = estimation_blocks.project_id
      where estimation_blocks.id = block_variables.block_id
    )
  );

drop policy if exists block_variables_delete_existing_projects
  on public.block_variables;
create policy block_variables_delete_existing_projects
  on public.block_variables
  for delete
  to anon, authenticated
  using (
    exists (
      select 1
      from public.estimation_blocks
      join public.projects on projects.id = estimation_blocks.project_id
      where estimation_blocks.id = block_variables.block_id
    )
  );

create or replace function public.save_estimation_blocks(
  p_project_id uuid,
  p_blocks jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  saved_count integer;
begin
  if p_blocks is null or jsonb_typeof(p_blocks) <> 'array' then
    raise exception 'p_blocks must be a JSON array';
  end if;

  if jsonb_array_length(p_blocks) = 0 then
    raise exception 'At least one block is required';
  end if;

  if not exists (
    select 1
    from public.projects
    where projects.id = p_project_id
  ) then
    raise exception 'Project does not exist';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_project_id::text, 0)
  );

  delete from public.estimation_blocks
  where estimation_blocks.project_id = p_project_id;

  insert into public.estimation_blocks (
    project_id,
    block_name,
    area,
    geometry
  )
  select
    p_project_id,
    block_data.block_name,
    block_data.area,
    block_data.geometry
  from jsonb_to_recordset(p_blocks) as block_data(
    block_name text,
    area numeric,
    geometry jsonb,
    variables jsonb
  );

  get diagnostics saved_count = row_count;

  insert into public.block_variables (
    block_id,
    variable_name,
    variation_type,
    value,
    unit,
    calculation_method
  )
  select
    estimation_blocks.id,
    variable_data.variable_name,
    variable_data.variation_type,
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
    variation_type text,
    value numeric,
    unit text,
    calculation_method text
  );

  return saved_count;
end;
$$;

revoke all on function public.save_estimation_blocks(uuid, jsonb) from public;
grant execute on function public.save_estimation_blocks(uuid, jsonb)
  to anon, authenticated;

commit;

-- Post-creation validation. Run after the transaction above completes.
select to_regclass('public.estimation_blocks');

select to_regclass('public.block_variables');

select *
from pg_policies
where tablename in (
  'estimation_blocks',
  'block_variables'
);

notify pgrst, 'reload schema';
