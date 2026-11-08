create or replace function public.reset_project_data(
  p_project_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_project_id is null or not exists (
    select 1
    from public.projects
    where projects.id = p_project_id
  ) then
    raise exception 'Project does not exist';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_project_id::text, 0)
  );

  delete from public.block_variables
  using public.estimation_blocks
  where estimation_blocks.id = block_variables.block_id
    and estimation_blocks.project_id = p_project_id;

  delete from public.estimation_blocks
  where estimation_blocks.project_id = p_project_id;

  delete from public.drillholes
  where drillholes.project_id = p_project_id;

  delete from public.project_files
  where project_files.project_id = p_project_id;

  if exists (
    select 1
    from public.estimation_blocks
    where estimation_blocks.project_id = p_project_id
  ) or exists (
    select 1
    from public.drillholes
    where drillholes.project_id = p_project_id
  ) or exists (
    select 1
    from public.project_files
    where project_files.project_id = p_project_id
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

revoke all on function public.reset_project_data(uuid) from public;
grant execute on function public.reset_project_data(uuid)
  to anon, authenticated;

notify pgrst, 'reload schema';
