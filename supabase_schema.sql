-- StayFlow Pro V4 Cloud schema
-- Run this entire script in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.planner_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.planner_data enable row level security;

drop policy if exists "Users can read their own planner data" on public.planner_data;
create policy "Users can read their own planner data"
on public.planner_data for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own planner data" on public.planner_data;
create policy "Users can insert their own planner data"
on public.planner_data for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own planner data" on public.planner_data;
create policy "Users can update their own planner data"
on public.planner_data for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own planner data" on public.planner_data;
create policy "Users can delete their own planner data"
on public.planner_data for delete
to authenticated
using (auth.uid() = user_id);

-- Enable realtime updates so another signed-in device can receive changes.
do $$
begin
  alter publication supabase_realtime add table public.planner_data;
exception
  when duplicate_object then null;
end $$;
