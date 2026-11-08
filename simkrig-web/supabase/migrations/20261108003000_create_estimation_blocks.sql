create table if not exists public.estimation_blocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  block_name text not null,
  area numeric not null check (area >= 0),
  geometry jsonb not null,
  created_at timestamptz not null default now(),
  constraint estimation_blocks_project_block_name_key
    unique (project_id, block_name)
);

create table if not exists public.block_variables (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.estimation_blocks (id) on delete cascade,
  variable_name text not null check (length(trim(variable_name)) > 0),
  value numeric,
  unit text not null,
  calculation_method text not null,
  created_at timestamptz not null default now(),
  constraint block_variables_block_variable_name_key
    unique (block_id, variable_name)
);

create index if not exists estimation_blocks_project_id_idx
  on public.estimation_blocks (project_id);

create index if not exists block_variables_block_id_idx
  on public.block_variables (block_id);

create or replace function public.save_estimation_blocks(
  p_project_id uuid,
  p_blocks jsonb
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  saved_count integer;
begin
  if p_blocks is null or jsonb_typeof(p_blocks) <> 'array' then
    raise exception 'p_blocks must be a JSON array';
  end if;

  delete from public.estimation_blocks
  where project_id = p_project_id;

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
