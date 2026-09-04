-- Run this in Supabase SQL Editor.
create table if not exists public.user_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id text not null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, deck_id)
);

alter table public.user_progress enable row level security;

drop policy if exists "Users read own progress" on public.user_progress;
create policy "Users read own progress" on public.user_progress
for select using (auth.uid() = user_id);

drop policy if exists "Users insert own progress" on public.user_progress;
create policy "Users insert own progress" on public.user_progress
for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own progress" on public.user_progress;
create policy "Users update own progress" on public.user_progress
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users delete own progress" on public.user_progress;
create policy "Users delete own progress" on public.user_progress
for delete using (auth.uid() = user_id);
