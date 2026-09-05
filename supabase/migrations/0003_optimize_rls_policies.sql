-- Cache auth.uid() once per query and avoid overlapping permissive SELECT
-- policies. This keeps the same authorization model while removing the
-- Supabase performance advisor warnings.

drop policy if exists "users can read their admin membership" on public.admin_users;
create policy "users can read their admin membership"
on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "users read their own deck states" on public.user_deck_states;
drop policy if exists "users create their own deck states" on public.user_deck_states;
drop policy if exists "users update their own deck states" on public.user_deck_states;
drop policy if exists "users delete their own deck states" on public.user_deck_states;

create policy "users read their own deck states"
on public.user_deck_states for select to authenticated
using (user_id = (select auth.uid()));
create policy "users create their own deck states"
on public.user_deck_states for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "users update their own deck states"
on public.user_deck_states for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy "users delete their own deck states"
on public.user_deck_states for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "users read their own reviews" on public.review_events;
drop policy if exists "users create their own reviews" on public.review_events;
drop policy if exists "users update their own reviews" on public.review_events;
drop policy if exists "users delete their own reviews" on public.review_events;

create policy "users read their own reviews"
on public.review_events for select to authenticated
using (user_id = (select auth.uid()));
create policy "users create their own reviews"
on public.review_events for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "users update their own reviews"
on public.review_events for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy "users delete their own reviews"
on public.review_events for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "users read their own readings" on public.readings;
drop policy if exists "users create their own readings" on public.readings;
drop policy if exists "users update their own readings" on public.readings;
drop policy if exists "users delete their own readings" on public.readings;

create policy "users read their own readings"
on public.readings for select to authenticated
using (user_id = (select auth.uid()));
create policy "users create their own readings"
on public.readings for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "users update their own readings"
on public.readings for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy "users delete their own readings"
on public.readings for delete to authenticated
using (user_id = (select auth.uid()));

-- The public SELECT policies already include administrator visibility. Split
-- administrator writes by command so authenticated SELECT has one policy.
drop policy if exists "admins manage decks" on public.decks;
drop policy if exists "admins create decks" on public.decks;
drop policy if exists "admins update decks" on public.decks;
drop policy if exists "admins delete decks" on public.decks;
create policy "admins create decks"
on public.decks for insert to authenticated
with check (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);
create policy "admins update decks"
on public.decks for update to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);
create policy "admins delete decks"
on public.decks for delete to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

drop policy if exists "admins manage categories" on public.deck_categories;
drop policy if exists "admins create categories" on public.deck_categories;
drop policy if exists "admins update categories" on public.deck_categories;
drop policy if exists "admins delete categories" on public.deck_categories;
create policy "admins create categories"
on public.deck_categories for insert to authenticated
with check (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);
create policy "admins update categories"
on public.deck_categories for update to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);
create policy "admins delete categories"
on public.deck_categories for delete to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

drop policy if exists "admins manage cards" on public.cards;
drop policy if exists "admins create cards" on public.cards;
drop policy if exists "admins update cards" on public.cards;
drop policy if exists "admins delete cards" on public.cards;
create policy "admins create cards"
on public.cards for insert to authenticated
with check (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);
create policy "admins update cards"
on public.cards for update to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);
create policy "admins delete cards"
on public.cards for delete to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

drop policy if exists "users read their own reading audio" on storage.objects;
drop policy if exists "users upload their own reading audio" on storage.objects;
drop policy if exists "users update their own reading audio" on storage.objects;
drop policy if exists "users delete their own reading audio" on storage.objects;

create policy "users read their own reading audio"
on storage.objects for select to authenticated
using (
  bucket_id = 'reading-audio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "users upload their own reading audio"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'reading-audio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "users update their own reading audio"
on storage.objects for update to authenticated
using (
  bucket_id = 'reading-audio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'reading-audio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "users delete their own reading audio"
on storage.objects for delete to authenticated
using (
  bucket_id = 'reading-audio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
