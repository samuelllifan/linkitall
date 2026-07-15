-- Profile analytics: record a row per public view / link click, then aggregate
-- for the owner's Dashboard. Visitors are anonymous but carry a stable
-- browser-generated `visitor_id` so unique views can be counted.
--
-- Events are written through a SECURITY DEFINER function (like get_public_page)
-- so the table's RLS stays closed: the public can record events for any page
-- but can only ever read their OWN page's events.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  -- Whose page the event belongs to.
  page_user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('view', 'click')),
  -- Stable anonymous id for the visitor's browser (for unique-view counting).
  visitor_id text not null,
  -- 'mobile' | 'tablet' | 'desktop' (best-effort from the user agent).
  device text,
  -- For clicks: which link, plus a denormalized label for display.
  link_id text,
  link_label text,
  created_at timestamptz not null default now()
);

alter table public.analytics_events enable row level security;

-- Owner-only read; range queries filter on (page_user_id, created_at).
create index if not exists analytics_events_owner_time_idx
  on public.analytics_events (page_user_id, created_at);

-- The page owner may read their own events. No insert/update/delete policies:
-- writes go exclusively through record_analytics_event (SECURITY DEFINER).
create policy "owners can read their analytics"
  on public.analytics_events for select to authenticated
  using (page_user_id = (select auth.uid()));

-- Record a view/click for the page owned by `page_username`. Runs as definer so
-- anonymous visitors can insert without direct table access; search_path is
-- emptied and every name schema-qualified per Supabase's hardening guidance.
create or replace function public.record_analytics_event(
  page_username text,
  event_kind text,
  visitor text,
  device_type text default null,
  link_id text default null,
  link_label text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  if event_kind not in ('view', 'click') then
    return;
  end if;

  select id into owner_id
  from public.profiles
  where lower(username) = lower(page_username)
  limit 1;

  if owner_id is null then
    return;
  end if;

  insert into public.analytics_events (
    page_user_id, kind, visitor_id, device, link_id, link_label
  )
  values (
    owner_id, event_kind, visitor, device_type, link_id, link_label
  );
end;
$$;

grant execute on function public.record_analytics_event(
  text, text, text, text, text, text
) to anon, authenticated;
