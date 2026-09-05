-- Page passwords: an owner can put their public page behind a shared password.
--
-- Two functions, and the split between them is the whole security model:
--
--   set_page_password(text)                  owner-only, hashes and stores
--   get_public_page_unlocked(text, text)     anon-callable, takes the password
--                                            and returns the page only if it
--                                            matches
--
-- The hash itself is never returned by anything. `get_public_page` (previous
-- migration) reports only the BOOLEAN `password_protected` and withholds the
-- page's content, so the unlock screen can be rendered without the content ever
-- leaving the database.
--
-- On brute force: bcrypt's cost factor is the throttle, and it has to be set
-- EXPLICITLY to be one. pgcrypto's `gen_salt('bf')` defaults to cost 6 — 64
-- rounds, roughly a millisecond a hash — which against an anon-callable
-- verifier is no throttle at all. Cost 10 below is the standard modern floor
-- (~100ms), which also bounds how fast this can be used to burn database CPU.
--
-- That plus a 6-character minimum is proportionate to what this is: a SHARED
-- page password, the kind an owner puts in a Discord announcement, not an
-- account credential. Account access is governed by Supabase Auth and, where
-- enrolled, TOTP.

-- pgcrypto supplies crypt()/gen_salt(). Supabase keeps extensions out of
-- `public` and ships pgcrypto in `extensions` already, which is why both
-- functions below reference `extensions.crypt` schema-qualified (they run with
-- an empty search_path, so an unqualified call would not resolve).
--
-- Note that `IF NOT EXISTS` does NOT relocate an extension that is already
-- installed somewhere else — it skips with a notice. So this line creates
-- pgcrypto on a database that lacks it, and is a no-op (not a guarantee) on one
-- that already has it. The assert below turns that silent assumption into a
-- loud failure at migration time rather than a runtime error later.
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if to_regprocedure('extensions.gen_salt(text)') is null then
    raise exception
      'pgcrypto is not available as extensions.gen_salt — page passwords need it there';
  end if;
end
$$;

/**
 * Set — or, with null/empty, clear — the caller's page password.
 *
 * SECURITY DEFINER because `profiles.page_password_hash` is deliberately NOT in
 * the authenticated UPDATE grant: hashing has to happen server-side, or a
 * client could store a hash whose plaintext it chose.
 */
create or replace function public.set_page_password(new_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  -- Clearing the password is the same call with nothing in it.
  if new_password is null or char_length(new_password) = 0 then
    update public.profiles
      set page_password_hash = null, updated_at = now()
    where id = uid;
    return;
  end if;

  if char_length(new_password) < 6 or char_length(new_password) > 128 then
    raise exception 'Page password must be between 6 and 128 characters.';
  end if;

  update public.profiles
    set page_password_hash =
          extensions.crypt(new_password, extensions.gen_salt('bf', 10)),
        updated_at = now()
  where id = uid;
end;
$$;

revoke all on function public.set_page_password(text) from public;
grant execute on function public.set_page_password(text) to authenticated;

/**
 * The page, but only for a caller who knows its password.
 *
 * Same output shape as get_public_page so one mapper reads both. Returns no
 * rows for a wrong password, an unprotected page, or an unknown username —
 * three failures that are indistinguishable to the caller on purpose.
 */
create or replace function public.get_public_page_unlocked(
  page_username text,
  page_password text
)
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
  select
    pr.username,
    p.name,
    p.bio,
    p.links,
    p.styles,
    p.avatar,
    pr.search_indexable,
    pr.page_live,
    pr.sensitive_content,
    pr.count_own_visits,
    true
  from public.profiles pr
  left join public.pages p on p.user_id = pr.id
  where lower(pr.username) = lower(page_username)
    -- Offline outranks the password: knowing the password must not resurrect a
    -- page the owner has taken down.
    and pr.page_live
    and pr.page_password_hash is not null
    -- crypt(candidate, stored_hash) re-derives with the stored salt and cost,
    -- so this comparison IS the password check.
    and pr.page_password_hash =
        extensions.crypt(page_password, pr.page_password_hash)
  limit 1;
$$;

revoke all on function public.get_public_page_unlocked(text, text) from public;
grant execute on function public.get_public_page_unlocked(text, text)
  to anon, authenticated;
