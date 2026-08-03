-- Make admin_overview() time-range aware so the dashboard can scope every stat
-- to a chosen window (last 24h, last 7 days, lifetime, or a custom calendar
-- range). The window is passed as two optional bounds; a null bound is open.
--
-- Also upgrades the time series: buckets are now zero-filled and adapt their
-- granularity to the window (hourly for spans up to 48h, daily otherwise), so a
-- short range renders a continuous line instead of a couple of stray points.
--
-- The signature changes (gains two params), so the old zero-arg version is
-- dropped first — create-or-replace can't change a signature and would leave an
-- ambiguous overload for no-arg RPC calls. Same admin-only guard and hardening.

drop function if exists public.admin_overview();

create or replace function public.admin_overview(
  range_start timestamptz default null,
  range_end timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  result jsonb;
  lo timestamptz;
  hi timestamptz;
  by_hour boolean;
  unit text;
  step interval;
begin
  if not exists (
    select 1 from public.profiles where id = caller and is_admin
  ) then
    raise exception 'not authorized';
  end if;

  -- Effective window for time-series bucketing. Open bounds fall back to the
  -- full data span so "lifetime" still produces a sensible axis.
  lo := coalesce(
    range_start,
    (select min(created_at) from public.analytics_events),
    now() - interval '30 days'
  );
  hi := coalesce(range_end, now());
  by_hour := (hi - lo) <= interval '48 hours';
  unit := case when by_hour then 'hour' else 'day' end;
  step := case when by_hour then interval '1 hour' else interval '1 day' end;

  select jsonb_build_object(
    'granularity', unit,
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
          where (range_start is null or created_at >= range_start)
            and (range_end is null or created_at < range_end)
          group by page_user_id
        ) ev on ev.page_user_id = p.id
      ) s
    ),
    'totals', jsonb_build_object(
      -- Roster size is cumulative and not scoped to the window.
      'users', (select count(*) from public.profiles),
      'views', (
        select count(*) from public.analytics_events
        where kind = 'view'
          and (range_start is null or created_at >= range_start)
          and (range_end is null or created_at < range_end)
      ),
      'clicks', (
        select count(*) from public.analytics_events
        where kind = 'click'
          and (range_start is null or created_at >= range_start)
          and (range_end is null or created_at < range_end)
      ),
      'uniqueVisitors', (
        select count(distinct visitor_id) from public.analytics_events
        where kind = 'view'
          and (range_start is null or created_at >= range_start)
          and (range_end is null or created_at < range_end)
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
          and (range_start is null or created_at >= range_start)
          and (range_end is null or created_at < range_end)
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
          and (range_start is null or created_at >= range_start)
          and (range_end is null or created_at < range_end)
        group by 1
      ) loc
    ),
    'topLinks', (
      select coalesce(
        jsonb_agg(jsonb_build_object('label', lbl, 'clicks', c) order by c desc),
        '[]'::jsonb
      )
      from (
        select coalesce(nullif(link_label, ''), 'Untitled') as lbl, count(*) as c
        from public.analytics_events
        where kind = 'click'
          and (range_start is null or created_at >= range_start)
          and (range_end is null or created_at < range_end)
        group by 1
        order by c desc
        limit 10
      ) tl
    ),
    -- Zero-filled views/clicks series across the window at the chosen unit.
    'trend', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'label', case
              when by_hour then to_char(b, 'HH24:00')
              else to_char(b, 'Mon FMDD')
            end,
            'views', v,
            'clicks', c
          ) order by b
        ),
        '[]'::jsonb
      )
      from (
        select
          gs.b as b,
          count(e.*) filter (where e.kind = 'view') as v,
          count(e.*) filter (where e.kind = 'click') as c
        from generate_series(
          date_trunc(unit, lo at time zone 'utc'),
          date_trunc(unit, hi at time zone 'utc'),
          step
        ) gs(b)
        left join public.analytics_events e
          on date_trunc(unit, e.created_at at time zone 'utc') = gs.b
          and (range_start is null or e.created_at >= range_start)
          and (range_end is null or e.created_at < range_end)
        group by gs.b
      ) t
    ),
    -- Zero-filled new-accounts series across the same window and unit.
    'signups', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'label', case
              when by_hour then to_char(b, 'HH24:00')
              else to_char(b, 'Mon FMDD')
            end,
            'count', n
          ) order by b
        ),
        '[]'::jsonb
      )
      from (
        select
          gs.b as b,
          count(au.id) as n
        from generate_series(
          date_trunc(unit, lo at time zone 'utc'),
          date_trunc(unit, hi at time zone 'utc'),
          step
        ) gs(b)
        left join auth.users au
          on date_trunc(unit, au.created_at at time zone 'utc') = gs.b
          and (range_start is null or au.created_at >= range_start)
          and (range_end is null or au.created_at < range_end)
        group by gs.b
      ) su
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_overview(timestamptz, timestamptz) to authenticated;
