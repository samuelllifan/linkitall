-- User profiles: one row per account, holding the public username (and future
-- account settings). Separate from `pages` because a username should exist even
-- before a page is created. A trigger auto-creates a profile row on sign-up.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  updated_at timestamptz not null default now(),
  -- 3–30 chars, letters/numbers/underscore only.
  constraint profiles_username_format
    check (username is null or username ~ '^[A-Za-z0-9_]{3,30}$')
);

-- Case-insensitive uniqueness: "Sam" and "sam" can't both exist.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

alter table public.profiles enable row level security;

-- Owner-scoped access (public read comes later with public /username pages).
create policy "owners can read their profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "owners can insert their profile"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "owners can update their profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select, insert, update on public.profiles to authenticated;

-- Auto-create an (empty) profile whenever a new auth user is created. Runs as
-- SECURITY DEFINER because the insert happens under the auth admin role during
-- sign-up; search_path is emptied and every name is schema-qualified per
-- Supabase's hardening guidance. Username is set separately by the app so a
-- taken username never blocks account creation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any users that already exist.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
