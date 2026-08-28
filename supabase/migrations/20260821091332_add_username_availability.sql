-- Username availability check for sign-up.
--
-- The sign-up form needs to tell a visitor whether a username is usable BEFORE
-- it creates the account. Today it cannot, and neither can any other client
-- code: `public.profiles` has no `anon` grant and no `anon` policy at all, and
-- its only SELECT policy is `id = (select auth.uid())` for `authenticated`
-- (20260703204458). So a client-side lookup for somebody else's username either
--
--   * fails outright with "permission denied for table profiles" (anon key,
--     which is what the sign-up form runs on -- there is no session yet), or
--   * silently returns ZERO ROWS WITH NO ERROR (signed-in user), i.e. it would
--     report every taken name in the database as free.
--
-- The second failure mode is the dangerous one, so this is deliberately not left
-- to the client. Relaxing RLS is not an option either: profiles also holds
-- `is_admin` and `search_indexable`, and keeping the table unenumerable is the
-- whole point of 20260704053942 and 20260724191506.
--
-- So expose exactly one short text answer through a SECURITY DEFINER function,
-- following the established `get_public_page` pattern: the table stays
-- owner-only and the browser learns nothing except the reason a name is
-- unusable.
--
-- This deliberately does NOT reuse `get_public_page` for the job. That function
-- knows nothing about reserved words (it would happily report 'admin' as free),
-- returns a whole page payload, and is free to grow visibility filters later --
-- at which point availability would quietly start lying.
--
-- Two invariants are load-bearing:
--   * format/length/reserved rules are delegated to the existing
--     public.username_problem() (20260728184431), so this advisory answer can
--     never drift from what set_username() and the handle_new_user() sign-up
--     trigger actually enforce;
--   * taken-ness is tested as `lower(username) = lower(...)`, which is exactly
--     the expression behind the `profiles_username_lower_key` UNIQUE INDEX
--     (20260703204458) whose unique_violation is the real authority. So the
--     pre-check and the claim agree, and the test is an index lookup.
--
-- Returns the human-readable reason the name is unusable, or NULL when it is
-- usable -- the same "problem string or null" contract as username_problem() and
-- as usernameError() in src/lib/profiles.ts, so the UI can show one precise
-- reason instead of inferring it from a bare boolean. The message strings are
-- kept identical to the ones set_username() raises, so the advisory pre-check
-- and the authoritative claim can never word the same failure differently.

-- Reserve 'contact' as well.
--
-- `src/app/contact/` is a real static route, and a static segment always wins
-- over the dynamic `[username]` one, so a user who claimed "contact" would get a
-- page at /contact that is permanently shadowed by the contact form -- silently,
-- with no error at claim time. It was missing from the reserved list in
-- 20260728184431.
--
-- Replacing username_problem() rather than special-casing it in the availability
-- check keeps ALL THREE callers in agreement automatically: the handle_new_user
-- sign-up trigger, set_username(), and username_unavailable_reason() below. The
-- body is otherwise identical to 20260728184431.
--
-- The matching list in src/lib/profiles.ts (RESERVED_USERNAMES) is hand-synced;
-- the source of truth for both is the set of top-level folders in src/app.
create or replace function public.username_problem(name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if name is null or length(name) < 3 then
    return 'Username must be at least 3 characters.';
  end if;
  if length(name) > 30 then
    return 'Username must be at most 30 characters.';
  end if;
  if name !~ '^[A-Za-z0-9_]{3,30}$' then
    return 'Use only letters, numbers, and underscores.';
  end if;
  if lower(name) = any (array[
    'my-page','settings','login','signup','logout','api','admin','about',
    'help','support','terms','privacy','pricing','explore','dashboard',
    'account','auth','new','contact'
  ]) then
    return 'That username is reserved.';
  end if;
  return null;
end;
$$;

create or replace function public.username_unavailable_reason(candidate text)
returns text
language sql
security definer
-- STABLE, not IMMUTABLE: the answer depends on the contents of profiles, and
-- claiming immutability would license the planner to cache a stale answer. Not
-- left VOLATILE either -- it only reads, so STABLE lets the planner evaluate it
-- once per statement (the same choice get_public_page makes).
stable
set search_path = ''
as $$
  -- Format/length/reserved rules first, so 'admin' reports as reserved rather
  -- than as free. Then case-insensitive taken-ness. COALESCE yields the first
  -- non-null reason; the CASE has no ELSE, so it is NULL when the name is free
  -- and NULL overall means "usable".
  --
  -- Profiles whose username is still NULL (a profile row is created at sign-up
  -- before a name is claimed) can never match, because `lower(null) = lower(x)`
  -- is NULL rather than true.
  select coalesce(
    public.username_problem(btrim(candidate)),
    case
      when exists (
        select 1
        from public.profiles
        where lower(username) = lower(btrim(candidate))
      )
      then 'That username is already taken.'
    end
  );
$$;

-- `anon` is REQUIRED here: the sign-up form has no session at the moment it
-- needs the answer. `authenticated` so the same helper can back the Settings
-- username field. Nothing else is granted -- the definer body is the only route
-- to profiles.
revoke all on function public.username_unavailable_reason(text) from public;
grant execute on function public.username_unavailable_reason(text) to anon, authenticated;
