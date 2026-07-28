-- Capture the visitor's country on analytics events so the admin overview can
-- show where in the world people access stacked.page from.
--
-- The country (ISO 3166-1 alpha-2, e.g. "US") is derived server-side from the
-- request's geo headers (x-vercel-ip-country) — the browser can't see it — and
-- passed into record_analytics_event. The event table itself stays closed:
-- writes still go only through the SECURITY DEFINER function, and the new
-- site-wide `locations` aggregate is exposed only via admin_overview().

alter table public.analytics_events
  add column if not exists country text;

-- record_analytics_event gains a `visitor_country` parameter. Its argument list
-- changes, so the old 6-arg version must be dropped before redefining (a plain
-- create or replace can't change the signature and would leave an overload that
-- makes named-argument calls ambiguous).
drop function if exists public.record_analytics_event(
  text, text, text, text, text, text
);

create or replace function public.record_analytics_event(
  page_username text,
  event_kind text,
  visitor text,
  device_type text default null,
  link_id text default null,
  link_label text default null,
  visitor_country text default null
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
    page_user_id, kind, visitor_id, device, link_id, link_label, country
  )
  values (
    owner_id, event_kind, visitor, device_type, link_id, link_label,
    -- Normalize to an uppercase 2-letter code, or null when absent/malformed.
    case
      when visitor_country ~ '^[A-Za-z]{2}$' then upper(visitor_country)
      else null
    end
  );
end;
$$;

grant execute on function public.record_analytics_event(
  text, text, text, text, text, text, text
) to anon, authenticated;

-- Add a site-wide `locations` breakdown (view counts grouped by visitor country)
-- to the admin overview, alongside the existing users, totals, devices, and
-- daily series. Same admin-only guard and hardening as before.
create or replace function public.admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  result jsonb;
begin
  if not exists (
    select 1 from public.profiles where id = caller and is_admin
  ) then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'users', (
      select coalesce(jsonb_agg(u_json order by u_last_sign_in desc nulls last), '[]'::jsonb)
      from (
        select
          jsonb_build_object(
            'id', p.id,
            'username', p.username,
            'email', au.email,
            'provider', coalesce(au.raw_app_meta_data ->> 'provider', 'email'),
            'lastSignInAt', au.last_sign_in_at,
            'createdAt', au.created_at,
            'views', coalesce(ev.views, 0),
            'clicks', coalesce(ev.clicks, 0)
          ) as u_json,
          au.last_sign_in_at as u_last_sign_in
        from public.profiles p
        join auth.users au on au.id = p.id
        left join (
          select
            page_user_id,
            count(*) filter (where kind = 'view') as views,
            count(*) filter (where kind = 'click') as clicks
          from public.analytics_events
          group by page_user_id
        ) ev on ev.page_user_id = p.id
      ) s
    ),
    'totals', jsonb_build_object(
      'users', (select count(*) from public.profiles),
      'views', (select count(*) from public.analytics_events where kind = 'view'),
      'clicks', (select count(*) from public.analytics_events where kind = 'click')
    ),
    'devices', (
      select coalesce(
        jsonb_agg(jsonb_build_object('device', dev, 'views', v) order by v desc),
        '[]'::jsonb
      )
      from (
        select coalesce(nullif(device, ''), 'unknown') as dev, count(*) as v
        from public.analytics_events
        where kind = 'view'
        group by 1
      ) d
    ),
    'locations', (
      select coalesce(
        jsonb_agg(jsonb_build_object('country', c, 'views', v) order by v desc),
        '[]'::jsonb
      )
      from (
        select coalesce(nullif(country, ''), 'ZZ') as c, count(*) as v
        from public.analytics_events
        where kind = 'view'
        group by 1
      ) loc
    ),
    'daily', (
      select coalesce(
        jsonb_agg(jsonb_build_object('date', d, 'views', v, 'clicks', c) order by d),
        '[]'::jsonb
      )
      from (
        select
          (created_at at time zone 'utc')::date as d,
          count(*) filter (where kind = 'view') as v,
          count(*) filter (where kind = 'click') as c
        from public.analytics_events
        where created_at >= now() - interval '30 days'
        group by 1
      ) day
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_overview() to authenticated;
