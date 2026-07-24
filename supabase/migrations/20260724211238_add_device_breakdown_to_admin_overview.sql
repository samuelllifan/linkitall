-- Add a site-wide device breakdown to the admin overview. Redefines
-- admin_overview() (create or replace) to include a `devices` array — view
-- counts grouped by the visitor's device — alongside the existing users,
-- totals, and daily series. Same admin-only guard and hardening as before.

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
