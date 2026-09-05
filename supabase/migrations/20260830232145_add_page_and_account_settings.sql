-- Page and account settings.
--
-- Adds the profile-level switches behind the settings page's Privacy,
-- Preferences and Notifications groups, and republishes `get_public_page` so
-- the public route can honour the page-level ones.
--
--   page_live              take the page offline without deleting it or giving
--                          up the username; visitors get a plain "not
--                          available" screen, the owner still sees their page
--   sensitive_content      show a "sensitive content" interstitial first
--   count_own_visits       whether the owner's OWN views/clicks are recorded.
--                          Default false, which is what the app already did
--                          unconditionally — this migration only makes the
--                          existing behaviour something the owner can change
--   page_password_hash     bcrypt hash of the page's visitor password (null =
--                          no password). Written only by set_page_password()
--                          in the next migration, and NEVER returned by any
--                          function granted to anon
--   timezone               IANA zone for the dashboard's owner-local charts
--   email_product_updates  release notes / What's New by email
--   email_tips             occasional tips for growing a page
--
-- Every default is chosen so existing rows keep behaving exactly as they do
-- today: pages stay live, unprotected, non-sensitive, and owner visits stay
-- uncounted.

alter table public.profiles
  add column if not exists page_live boolean not null default true,
  add column if not exists sensitive_content boolean not null default false,
  add column if not exists count_own_visits boolean not null default false,
  add column if not exists page_password_hash text,
  add column if not exists timezone text,
  add column if not exists email_product_updates boolean not null default true,
  add column if not exists email_tips boolean not null default true;

-- IANA zone names top out well under this; the bound is here to stop the column
-- being used as free storage.
alter table public.profiles
  drop constraint if exists profiles_timezone_len;
alter table public.profiles
  add constraint profiles_timezone_len
    check (timezone is null or char_length(timezone) between 1 and 64);

-- The admin migration (20260724191506) narrowed the authenticated UPDATE grant
-- to an explicit column list, so every new owner-editable column has to be
-- named here or the owner cannot write it.
--
-- `page_password_hash` is deliberately absent: it is only ever written by
-- public.set_page_password(), which does the hashing. Granting it directly
-- would let a client store an arbitrary string as the "hash" — including a
-- known one.
grant update (
  page_live,
  sensitive_content,
  count_own_visits,
  timezone,
  email_product_updates,
  email_tips
) on public.profiles to authenticated;

-- Republish the public-page function with the page-level flags.
--
-- A RETURNS TABLE signature can't gain columns via CREATE OR REPLACE, so the
-- old function is dropped first, then recreated. Behaviour is otherwise
-- identical to 20260729192825 with two additions:
--
--   * the three new page-level flags are returned, and
--   * when the page is WITHHELD, every CONTENT column comes back NULL.
--
-- Withheld means either "the owner set a password" or "the owner took the page
-- offline". Both are enforced HERE rather than in the app, and that is the whole
-- point: this function is granted to `anon`, so it is directly callable from any
-- browser holding the public anon key. Gating in the app would be a gate on the
-- front door of a house with no walls — and it would still leave the three OTHER
-- server-side readers of this function (the page's generateMetadata, the
-- opengraph-image route, and the landing page's featured wall) each having to
-- remember the rule separately. One CASE here covers all of them.
--
-- The flags themselves are still returned, so the app can tell the two apart and
-- render the right screen. Content behind a password is reachable through
-- get_public_page_unlocked(), which takes the password; content of an offline
-- page is not reachable at all, which is what "offline" means.
drop function if exists public.get_public_page(text);

create function public.get_public_page(page_username text)
returns table (
  username text,
  name text,
  bio text,
  links jsonb,
  styles jsonb,
  avatar text,
  indexable boolean,
  live boolean,
  sensitive boolean,
  count_own_visits boolean,
  password_protected boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  -- LEFT JOIN so a claimed username with no saved page still resolves (page
  -- columns come back null). The flags live on the profile, so they are present
  -- even for an empty page.
  -- `withheld` is computed once in a lateral join so the rule lives in exactly
  -- one place; repeating the condition in six CASE arms is how one of them ends
  -- up different from the other five.
  select
    pr.username,
    case when w.withheld then null else p.name end,
    case when w.withheld then null else p.bio end,
    case when w.withheld then null else p.links end,
    case when w.withheld then null else p.styles end,
    case when w.withheld then null else p.avatar end,
    pr.search_indexable,
    pr.page_live,
    pr.sensitive_content,
    pr.count_own_visits,
    pr.page_password_hash is not null
  from public.profiles pr
  left join public.pages p on p.user_id = pr.id
  cross join lateral (
    select (pr.page_password_hash is not null or not pr.page_live) as withheld
  ) w
  where lower(pr.username) = lower(page_username)
  limit 1;
$$;

-- Anyone (signed in or not) may resolve a public page by username. `revoke from
-- public` first, matching delete_own_account and username_unavailable_reason:
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, so without this the
-- explicit grant below is decoration and every future role gets it too.
revoke all on function public.get_public_page(text) from public;
grant execute on function public.get_public_page(text) to anon, authenticated;
