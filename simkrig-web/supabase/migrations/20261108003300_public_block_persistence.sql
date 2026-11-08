create index if not exists block_variables_variable_name_idx
  on public.block_variables (variable_name);

alter table public.estimation_blocks enable row level security;
alter table public.block_variables enable row level security;

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
set search_path = public, pg_temp
as $$
declare
  saved_count integer;
begin
  if p_blocks is null or jsonb_typeof(p_blocks) <> 'array' then
    raise exception 'p_blocks must be a JSON array';
  end if;

  if not exists (
    select 1 from public.projects where projects.id = p_project_id
  ) then
    raise exception 'Project does not exist';
  end if;

  if jsonb_array_length(p_blocks) = 0 then
    raise exception 'At least one block is required';
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
    value,
    unit,
    calculation_method
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

grant execute on function public.save_estimation_blocks(uuid, jsonb)
  to anon, authenticated;
