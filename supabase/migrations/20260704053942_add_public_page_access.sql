-- Public pages live at /<username>. Rather than opening RLS for public read on
-- `pages`/`profiles` (which would let anyone enumerate every row and any future
-- private columns), expose exactly the public page fields through a single
-- SECURITY DEFINER function keyed by username. Visitors can fetch a page by
-- username and nothing else; the tables stay owner-only for direct access.

create or replace function public.get_public_page(page_username text)
returns table (
  username text,
  name text,
  bio text,
  links jsonb,
  styles jsonb,
  avatar text
)
language sql
security definer
set search_path = ''
stable
as $$
  -- LEFT JOIN so a claimed username with no saved page still resolves (the
  -- page columns come back null), letting the app tell "no such user" (no row)
  -- apart from "user exists, empty page" (row with null page fields).
  select pr.username, p.name, p.bio, p.links, p.styles, p.avatar
  from public.profiles pr
  left join public.pages p on p.user_id = pr.id
  where lower(pr.username) = lower(page_username)
  limit 1;
$$;

-- Anyone (signed in or not) may resolve a public page by username.
grant execute on function public.get_public_page(text) to anon, authenticated;
