-- Fix account creation soft-lock around usernames.
--
-- Two changes:
--  1. handle_new_user() now sets the profile username at sign-up from the
--     `username` stored in the new auth user's metadata (passed by the sign-up
--     form). Because the trigger runs SECURITY DEFINER during sign-up, the
--     username is claimed server-side and atomically — no client session or
--     RLS write is involved — so a confirmed account already has its username
--     and lands straight on its page instead of being sent to Settings.
--  2. A SECURITY DEFINER set_username() RPC becomes the single, reliable way to
--     set/change a username (used by Settings and the sign-up fallback). It
--     validates server-side and raises clear, typed errors, replacing a direct
--     client upsert whose failures surfaced only as "Couldn't save changes."
--
-- Shared validation lives in username_problem() so the trigger, the RPC, and
-- the table CHECK constraint agree on what a valid username is.

-- Returns a human-readable reason the username is unusable, or null if it's OK.
-- Mirrors the client-side check in src/lib/profiles.ts (kept in sync by hand).
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
    'account','auth','new'
  ]) then
    return 'That username is reserved.';
  end if;
  return null;
end;
$$;

-- Claim `new_username` for the signed-in caller. Raises a friendly exception on
-- any problem so the UI can show it directly. SECURITY DEFINER so the write is
-- not subject to table RLS timing; it still authorizes on auth.uid().
create or replace function public.set_username(new_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  trimmed text := btrim(new_username);
  problem text;
begin
  if caller is null then
    raise exception 'You must be signed in to set a username.';
  end if;

  problem := public.username_problem(trimmed);
  if problem is not null then
    raise exception '%', problem;
  end if;

  insert into public.profiles (id, username, updated_at)
  values (caller, trimmed, now())
  on conflict (id) do update
    set username = excluded.username, updated_at = excluded.updated_at;
exception
  -- Unique violation on the case-insensitive username index → already taken.
  when unique_violation then
    raise exception 'That username is already taken.';
end;
$$;

grant execute on function public.set_username(text) to authenticated;

-- Auto-create a profile on sign-up, now also claiming the username from the
-- new user's metadata when one was supplied and is valid + available. Invalid
-- or taken names are simply left null (the user picks one in Settings), so a
-- bad metadata value can never block account creation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  desired text := btrim(coalesce(new.raw_user_meta_data ->> 'username', ''));
begin
  if desired <> ''
     and public.username_problem(desired) is null
     and not exists (
       select 1 from public.profiles where lower(username) = lower(desired)
     )
  then
    insert into public.profiles (id, username)
    values (new.id, desired)
    on conflict (id) do nothing;
  else
    insert into public.profiles (id)
    values (new.id)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;
