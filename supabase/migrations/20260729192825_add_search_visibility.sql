-- Search-engine visibility: let an owner keep their public /<username> page out
-- of search indexes. Adds `profiles.search_indexable` (default true, i.e. every
-- existing page stays discoverable), re-grants the authenticated role write
-- access to just that one new column (the admin migration revoked the blanket
-- update grant), and republishes `get_public_page` so the public render can
-- read the flag and emit a `noindex` tag for opted-out pages.

alter table public.profiles
  add column if not exists search_indexable boolean not null default true;

-- The admin migration narrowed the authenticated update grant to
-- (username, updated_at); add the new column so owners can toggle it from the
-- app. `is_admin` deliberately stays ungranted (no privilege escalation).
grant update (search_indexable) on public.profiles to authenticated;

-- Republish the public-page function with an extra `indexable` output column.
-- A RETURNS TABLE signature can't gain columns via CREATE OR REPLACE, so the
-- old function is dropped first, then recreated. Behaviour is otherwise
-- identical to the original (see 20260704053942_add_public_page_access).
drop function if exists public.get_public_page(text);

create function public.get_public_page(page_username text)
returns table (
  username text,
  name text,
  bio text,
  links jsonb,
  styles jsonb,
  avatar text,
  indexable boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  -- LEFT JOIN so a claimed username with no saved page still resolves (page
  -- columns come back null). `search_indexable` lives on the profile, so it is
  -- present even for an empty page.
  select pr.username, p.name, p.bio, p.links, p.styles, p.avatar, pr.search_indexable
  from public.profiles pr
  left join public.pages p on p.user_id = pr.id
  where lower(pr.username) = lower(page_username)
  limit 1;
$$;

-- Anyone (signed in or not) may resolve a public page by username.
grant execute on function public.get_public_page(text) to anon, authenticated;
