-- Expand admin_overview() with higher-signal, engagement-focused stats.
--
-- Everything here is derived from data the analytics + auth tables already hold,
-- so no schema or write-path change is needed — only the read-side aggregate
-- exposed to the admin dashboard grows. Same admin-only guard and hardening as
-- the prior versions (SECURITY DEFINER, empty search_path, schema-qualified
-- names, re-checks the caller is the admin).
--
-- New fields:
--   totals.uniqueVisitors — distinct visitor_id across all views (dedupes the
--                           raw view count into "how many people", not "how many
--                           page loads").
--   recent                — rolling activity windows (last 24h / last 7 days)
--                           for a quick sense of momentum.
--   topLinks              — the most-clicked links site-wide, by label, so it's
--                           clear what content actually drives engagement.
--   signups               — daily new accounts over the last 30 days, for a user
--                           growth trend alongside the existing views series.

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
      'clicks', (select count(*) from public.analytics_events where kind = 'click'),
      -- Distinct browsers that have viewed any page: the "people" number behind
      -- the raw view count.
      'uniqueVisitors', (
        select count(distinct visitor_id)
        from public.analytics_events
        where kind = 'view'
      )
    ),
    -- Rolling activity windows for recency at a glance.
    'recent', jsonb_build_object(
      'views24h', (
        select count(*) from public.analytics_events
        where kind = 'view' and created_at >= now() - interval '24 hours'
      ),
      'clicks24h', (
        select count(*) from public.analytics_events
        where kind = 'click' and created_at >= now() - interval '24 hours'
      ),
      'views7d', (
        select count(*) from public.analytics_events
        where kind = 'view' and created_at >= now() - interval '7 days'
      ),
      'clicks7d', (
        select count(*) from public.analytics_events
        where kind = 'click' and created_at >= now() - interval '7 days'
      )
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
    -- Most-clicked links site-wide, keyed by their denormalized label. Rows with
    -- no label (older/empty events) are folded into a single "Untitled" bucket.
    'topLinks', (
      select coalesce(
        jsonb_agg(jsonb_build_object('label', lbl, 'clicks', c) order by c desc),
        '[]'::jsonb
      )
      from (
        select coalesce(nullif(link_label, ''), 'Untitled') as lbl, count(*) as c
        from public.analytics_events
        where kind = 'click'
        group by 1
        order by c desc
        limit 10
      ) tl
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
    ),
    -- New accounts per day over the last 30 days, for a growth trend.
    'signups', (
      select coalesce(
        jsonb_agg(jsonb_build_object('date', d, 'count', n) order by d),
        '[]'::jsonb
      )
      from (
        select
          (au.created_at at time zone 'utc')::date as d,
          count(*) as n
        from auth.users au
        join public.profiles p on p.id = au.id
        where au.created_at >= now() - interval '30 days'
        group by 1
      ) su
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_overview() to authenticated;
