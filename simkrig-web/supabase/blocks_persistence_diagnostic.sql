-- Run in the Supabase SQL Editor for the same project used by the app.
-- Run these statements separately, in order, and inspect any error immediately.
-- public.projects must already exist because estimation_blocks has a foreign key to it.

create table public.estimation_blocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  block_name text not null,
  area numeric not null check (area >= 0),
  geometry jsonb not null,
  created_at timestamptz not null default now(),
  constraint estimation_blocks_project_block_name_key
    unique (project_id, block_name)
);

select to_regclass('public.estimation_blocks');

create table public.block_variables (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null
    references public.estimation_blocks (id) on delete cascade,
  variable_name text not null check (length(trim(variable_name)) > 0),
  variation_type text not null default 'continuous',
  value numeric,
  unit text not null,
  calculation_method text not null,
  created_at timestamptz not null default now(),
  constraint block_variables_block_variable_name_key
    unique (block_id, variable_name)
);

select
  to_regclass('public.estimation_blocks') as estimation_blocks,
  to_regclass('public.block_variables') as block_variables;
