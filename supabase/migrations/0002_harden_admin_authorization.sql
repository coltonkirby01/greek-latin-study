-- Keep administrator membership private and avoid an externally callable
-- SECURITY DEFINER function. Users can see only their own membership row;
-- RLS policies check that row directly for privileged operations.

drop policy if exists "anyone can read published decks" on public.decks;
drop policy if exists "admins manage decks" on public.decks;
drop policy if exists "anyone can read categories for published decks" on public.deck_categories;
drop policy if exists "admins manage categories" on public.deck_categories;
drop policy if exists "anyone can read cards in published decks" on public.cards;
drop policy if exists "admins manage cards" on public.cards;

create policy "anyone can read published decks"
on public.decks for select to anon, authenticated
using (
  published
  or exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

create policy "admins manage decks"
on public.decks for all to authenticated
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

create policy "anyone can read categories for published decks"
on public.deck_categories for select to anon, authenticated
using (
  exists (
    select 1 from public.decks
    where decks.id = deck_id
      and (
        decks.published
        or exists (
          select 1 from public.admin_users
          where admin_users.user_id = (select auth.uid())
        )
      )
  )
);

create policy "admins manage categories"
on public.deck_categories for all to authenticated
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

create policy "anyone can read cards in published decks"
on public.cards for select to anon, authenticated
using (
  exists (
    select 1 from public.decks
    where decks.id = deck_id
      and (
        decks.published
        or exists (
          select 1 from public.admin_users
          where admin_users.user_id = (select auth.uid())
        )
      )
  )
);

create policy "admins manage cards"
on public.cards for all to authenticated
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

revoke execute on function public.is_admin() from anon, authenticated, public;
drop function public.is_admin();
