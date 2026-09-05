-- Allow 1- and 2-character usernames.
--
-- Short handles are desirable on a link-in-bio product (they are the shortest
-- possible URL), and nothing about /<username> routing requires three
-- characters. The minimum drops from 3 to 1; the 30-character maximum, the
-- letters/numbers/underscore character set, and the reserved-word list are all
-- unchanged.
--
-- Two places enforce length and BOTH have to move, or the relaxation is a
-- no-op that fails confusingly:
--
--   1. public.username_problem() -- the shared validator behind set_username(),
--      the handle_new_user() sign-up trigger, and username_unavailable_reason().
--      Replaced wholesale (roll forward, never edit an applied migration); the
--      body is identical to 20260824073243 apart from the two length rules, so
--      the reserved list below must stay in sync with RESERVED_USERNAMES in
--      src/lib/profiles.ts.
--   2. The profiles_username_format CHECK constraint from 20260703204458. This
--      is the real gate: without widening it, a 1-character name would pass
--      every validator and then be rejected by the table with an opaque
--      constraint error at INSERT time.
--
-- Widening a CHECK is safe on existing rows -- every value that satisfied
-- ^[A-Za-z0-9_]{3,30}$ also satisfies ^[A-Za-z0-9_]{1,30}$ -- so the drop and
-- re-add cannot fail on production data. Postgres still scans the table to
-- validate the new constraint; profiles is small and this is a brief lock.
create or replace function public.username_problem(name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if name is null or length(name) < 1 then
    return 'Username must be at least 1 character.';
  end if;
  if length(name) > 30 then
    return 'Username must be at most 30 characters.';
  end if;
  if name !~ '^[A-Za-z0-9_]{1,30}$' then
    return 'Use only letters, numbers, and underscores.';
  end if;
  if lower(name) = any (array[
    'my-page','settings','login','signup','logout','api','admin','about',
    'help','support','terms','privacy','pricing','explore','dashboard',
    'account','auth','new','contact','edit'
  ]) then
    return 'That username is reserved.';
  end if;
  return null;
end;
$$;

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format
    check (username is null or username ~ '^[A-Za-z0-9_]{1,30}$');
