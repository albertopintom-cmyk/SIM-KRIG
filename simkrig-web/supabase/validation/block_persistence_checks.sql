-- Inspect the policies SIM-KRIG currently uses for its public project data.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'projects',
    'project_files',
    'drillholes',
    'estimation_blocks',
    'block_variables'
  )
order by tablename, policyname;

-- Confirm row-level security is enabled for both block tables.
select
  relname as table_name,
  relrowsecurity as rls_enabled
from pg_class
where oid in (
  'public.estimation_blocks'::regclass,
  'public.block_variables'::regclass
)
order by relname;

-- Check the required columns and database types.
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('estimation_blocks', 'block_variables')
order by table_name, ordinal_position;

-- Check stored block and variable counts for each project.
select
  project_id,
  count(*) as block_count,
  coalesce(sum(area), 0) as total_area
from public.estimation_blocks
group by project_id
order by project_id;

-- A complete 5x5 drillhole grid should produce 16 blocks.
select
  projects.id as project_id,
  drillhole_counts.drillhole_count,
  block_counts.block_count,
  case
    when drillhole_counts.drillhole_count = 25
      and block_counts.block_count = 16
    then 'OK: malla 5x5 persistida'
    else 'Revisar: se esperan 25 sondajes y 16 bloques'
  end as validation
from public.projects
join lateral (
  select count(*) as drillhole_count
  from public.drillholes
  where drillholes.project_id = projects.id
) as drillhole_counts on true
join lateral (
  select count(*) as block_count
  from public.estimation_blocks
  where estimation_blocks.project_id = projects.id
) as block_counts on true
where drillhole_counts.drillhole_count = 25
order by projects.id;

select
  estimation_blocks.project_id,
  block_variables.variable_name,
  block_variables.variation_type,
  count(*) as variable_count,
  count(block_variables.value) as non_null_value_count
from public.block_variables
join public.estimation_blocks
  on estimation_blocks.id = block_variables.block_id
group by
  estimation_blocks.project_id,
  block_variables.variable_name,
  block_variables.variation_type
order by estimation_blocks.project_id, block_variables.variable_name;

-- Confirm there are no orphan variables and no blocks with a missing project.
select
  (select count(*)
   from public.block_variables
   left join public.estimation_blocks
     on estimation_blocks.id = block_variables.block_id
   where estimation_blocks.id is null) as orphan_variables,
  (select count(*)
   from public.estimation_blocks
   left join public.projects on projects.id = estimation_blocks.project_id
   where projects.id is null) as blocks_without_project;

-- Run separately in the Supabase SQL editor to verify anon CRUD policies.
-- All changes are rolled back at the end of the transaction.
begin;
set local role anon;
do $$
declare
  test_project_id uuid;
  test_block_id uuid;
begin
  select projects.id
  into test_project_id
  from public.projects
  order by projects.id
  limit 1;

  if test_project_id is null then
    raise exception 'Create a project before running the anon RLS CRUD check';
  end if;

  insert into public.estimation_blocks (
    project_id,
    block_name,
    area,
    geometry
  )
  values (
    test_project_id,
    '__rls_validation__',
    1,
    '[{"easting":0,"northing":0},{"easting":1,"northing":0},{"easting":1,"northing":1},{"easting":0,"northing":1}]'::jsonb
  )
  returning id into test_block_id;

  insert into public.block_variables (
    block_id,
    variable_name,
    variation_type,
    value,
    unit,
    calculation_method
  )
  values (
    test_block_id,
    '__rls_validation__',
    'continuous',
    1,
    'test',
    'temporary RLS validation'
  );

  update public.block_variables
  set value = 2
  where block_id = test_block_id
    and variable_name = '__rls_validation__';

  delete from public.block_variables
  where block_id = test_block_id;

  delete from public.estimation_blocks
  where id = test_block_id;
end;
$$;
reset role;
rollback;
