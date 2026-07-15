-- Create the `pages` table backing the link-in-bio / portfolio.
-- MVP: a single shared page (no login), identified by a slug, with public
-- read/write so the page persists across browsers. Ownership/auth comes later.

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null default '',
  bio text not null default '',
  links jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.pages enable row level security;

-- Public (anon) access — the MVP has no login yet.
create policy "anon can read pages"
  on public.pages for select to anon using (true);

create policy "anon can insert pages"
  on public.pages for insert to anon with check (true);

create policy "anon can update pages"
  on public.pages for update to anon using (true) with check (true);

-- Same access for authenticated users — harmless now, ready for when we add auth.
create policy "authenticated can read pages"
  on public.pages for select to authenticated using (true);

create policy "authenticated can insert pages"
  on public.pages for insert to authenticated with check (true);

create policy "authenticated can update pages"
  on public.pages for update to authenticated using (true) with check (true);

-- Seed the single MVP page.
insert into public.pages (slug, name, bio, links)
values (
  'default',
  'lifanfx',
  'Video Editor | VFX',
  '[{"id":"tiktok","label":"TikTok","href":"https://www.tiktok.com/@lifanfx"}]'::jsonb
)
on conflict (slug) do nothing;
