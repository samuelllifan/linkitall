-- Admin view: a single-admin overview of every account and site-wide activity.
--
-- Adds an `is_admin` flag to profiles (defaulting false) and a SECURITY DEFINER
-- function that returns cross-user data (email, sign-in method, last activity,
-- per-user and site-wide analytics) — but ONLY when the caller is the admin.
-- This mirrors the app's existing definer-function pattern (record_analytics_event,
-- get_public_page) instead of shipping a service-role key to the app.

-- 1. Admin flag ------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Prevent privilege escalation: the owner-scoped update/insert policies would
-- otherwise let a user set their own `is_admin`. Restrict the columns the
-- `authenticated` role may write so `is_admin` can never be set from the app.
-- (The sign-up trigger runs as SECURITY DEFINER and is unaffected by grants.)
revoke insert, update on public.profiles from authenticated;
grant insert (id, username, updated_at) on public.profiles to authenticated;
grant update (username, updated_at) on public.profiles to authenticated;

-- Seed the sole admin by email. Safe on every environment: matches nothing when
-- that account doesn't exist (e.g. a fresh local db).
update public.profiles p
set is_admin = true
from auth.users u
where u.id = p.id
  and lower(u.email) = 'lifaneffects@gmail.com';

-- 2. Admin overview --------------------------------------------------------
-- Returns { users, totals, daily } as JSON. Definer so it can read auth.users;
-- search_path emptied and every name schema-qualified per Supabase hardening.
-- Raises if the caller isn't the admin, so the endpoint is useless to everyone
-- else even if they discover it.
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
