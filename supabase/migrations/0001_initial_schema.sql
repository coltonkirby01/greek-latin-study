-- Greek & Latin Study: accounts, independent study modes, deck administration,
-- readings, and private audio. Run this once in a new Supabase project.

create extension if not exists pgcrypto;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to authenticated, anon;

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  subject text not null default '',
  language text not null default 'other' check (language in ('greek', 'latin', 'other')),
  supports_reverse boolean not null default true,
  staged_config jsonb,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deck_categories (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  position integer not null default 1,
  unique (deck_id, name)
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  stable_key text not null,
  front text not null check (length(trim(front)) > 0),
  back text not null check (length(trim(back)) > 0),
  reverse_prompt text,
  category text,
  rank numeric,
  source text,
  notes text,
  position integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deck_id, stable_key),
  unique (deck_id, position)
);

create index cards_deck_position_idx on public.cards(deck_id, position);
create index cards_deck_rank_idx on public.cards(deck_id, rank);

-- deck_id is text here because built-in, versioned source decks use stable text
-- identifiers while administrator-created decks use custom:<uuid>.
create table public.user_deck_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id text not null,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, deck_id)
);

create table public.review_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id text not null,
  study_key text not null,
  card_id text not null,
  result text not null check (result in ('right', 'wrong')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  response_time_ms integer not null check (response_time_ms >= 0),
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index review_events_user_deck_idx on public.review_events(user_id, deck_id, reviewed_at desc);

create table public.readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  language text not null check (language in ('greek', 'latin')),
  text text not null check (length(trim(text)) > 0),
  audio_path text,
  audio_provider text not null default 'none',
  pronunciation_system text not null default 'Not specified',
  word_timings jsonb not null default '[]'::jsonb,
  sentence_segments jsonb not null default '[]'::jsonb,
  playback_rate numeric not null default 1 check (playback_rate between 0.25 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index readings_user_updated_idx on public.readings(user_id, updated_at desc);

alter table public.admin_users enable row level security;
alter table public.decks enable row level security;
alter table public.deck_categories enable row level security;
alter table public.cards enable row level security;
alter table public.user_deck_states enable row level security;
alter table public.review_events enable row level security;
alter table public.readings enable row level security;

create policy "users can read their admin membership"
on public.admin_users for select to authenticated
using (user_id = auth.uid());

create policy "anyone can read published decks"
on public.decks for select to anon, authenticated
using (published or public.is_admin());
create policy "admins manage decks"
on public.decks for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "anyone can read categories for published decks"
on public.deck_categories for select to anon, authenticated
using (exists (select 1 from public.decks where decks.id = deck_id and (decks.published or public.is_admin())));
create policy "admins manage categories"
on public.deck_categories for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "anyone can read cards in published decks"
on public.cards for select to anon, authenticated
using (exists (select 1 from public.decks where decks.id = deck_id and (decks.published or public.is_admin())));
create policy "admins manage cards"
on public.cards for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "users read their own deck states"
on public.user_deck_states for select to authenticated
using (user_id = auth.uid());
create policy "users create their own deck states"
on public.user_deck_states for insert to authenticated
with check (user_id = auth.uid());
create policy "users update their own deck states"
on public.user_deck_states for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete their own deck states"
on public.user_deck_states for delete to authenticated
using (user_id = auth.uid());

create policy "users read their own reviews"
on public.review_events for select to authenticated
using (user_id = auth.uid());
create policy "users create their own reviews"
on public.review_events for insert to authenticated
with check (user_id = auth.uid());
create policy "users update their own reviews"
on public.review_events for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete their own reviews"
on public.review_events for delete to authenticated
using (user_id = auth.uid());

create policy "users read their own readings"
on public.readings for select to authenticated
using (user_id = auth.uid());
create policy "users create their own readings"
on public.readings for insert to authenticated
with check (user_id = auth.uid());
create policy "users update their own readings"
on public.readings for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete their own readings"
on public.readings for delete to authenticated
using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reading-audio',
  'reading-audio',
  false,
  52428800,
  array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/ogg', 'audio/webm']
)
on conflict (id) do nothing;

create policy "users read their own reading audio"
on storage.objects for select to authenticated
using (bucket_id = 'reading-audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users upload their own reading audio"
on storage.objects for insert to authenticated
with check (bucket_id = 'reading-audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update their own reading audio"
on storage.objects for update to authenticated
using (bucket_id = 'reading-audio' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'reading-audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete their own reading audio"
on storage.objects for delete to authenticated
using (bucket_id = 'reading-audio' and (storage.foldername(name))[1] = auth.uid()::text);

-- Bootstrap exactly one owner after creating their account:
-- insert into public.admin_users (user_id) values ('THE-AUTH-USER-UUID');
