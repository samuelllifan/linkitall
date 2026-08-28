-- Reserve the username "edit".
--
-- The editor now lives at the static route /edit, and a static segment always
-- wins over the dynamic [username] segment. Without this, a user who claimed
-- "edit" would keep the name but their page would be permanently unreachable --
-- every visit to /edit would render the editor instead. Same failure mode the
-- reserved list was introduced for.
--
-- Rolls forward by replacing username_problem() rather than editing the earlier
-- migration. The reserved array here must stay in sync with RESERVED_USERNAMES
-- in src/lib/profiles.ts; the source of truth for both is the set of top-level
-- folders in src/app.
--
-- NOTE: reserving a name only blocks NEW claims. If an account already holds
-- "edit" in production, this migration leaves it in place -- check before
-- deploying:
--   select username from profiles where lower(username) = 'edit';
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
    'account','auth','new','contact','edit'
  ]) then
    return 'That username is reserved.';
  end if;
  return null;
end;
$$;
