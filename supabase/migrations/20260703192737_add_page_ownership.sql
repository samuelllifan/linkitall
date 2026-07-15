-- Add per-user ownership to pages so each account edits its own page.
-- Editor-only phase: a page is private to its owner (public /username URLs come
-- later). This replaces the MVP's wide-open anon read/write policies.

-- Ownership column. Cascade so a page is removed when its owner is deleted.
alter table public.pages
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- One page per user for now. (NULLs are allowed and not deduped by Postgres,
-- so the legacy unclaimed seed row is unaffected.)
create unique index if not exists pages_user_id_key on public.pages (user_id);

-- Drop the wide-open MVP policies (anon could read/insert/update every row).
drop policy if exists "anon can read pages" on public.pages;
drop policy if exists "anon can insert pages" on public.pages;
drop policy if exists "anon can update pages" on public.pages;
drop policy if exists "authenticated can read pages" on public.pages;
drop policy if exists "authenticated can insert pages" on public.pages;
drop policy if exists "authenticated can update pages" on public.pages;

-- Owner-scoped policies: a user may only see and change their own page.
-- `(select auth.uid())` is wrapped in a subquery so Postgres evaluates it once
-- per statement (Supabase's recommended RLS performance pattern).
create policy "owners can read their page"
  on public.pages for select to authenticated
  using (user_id = (select auth.uid()));

create policy "owners can insert their page"
  on public.pages for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "owners can update their page"
  on public.pages for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "owners can delete their page"
  on public.pages for delete to authenticated
  using (user_id = (select auth.uid()));
