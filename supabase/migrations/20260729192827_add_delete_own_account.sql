-- Account deletion: let a signed-in user permanently delete their own account.
--
-- Deleting the `auth.users` row cascades across the app's data: `profiles`,
-- `pages`, and `analytics_events` are all FK'd `on delete cascade`, and
-- `contact_messages.submitted_by` is `on delete set null`. Supabase's own auth
-- tables (identities, sessions, refresh_tokens) also cascade off auth.users.
--
-- Runs as SECURITY DEFINER (owned by the migration/postgres role) because the
-- `authenticated` role cannot write `auth.users` directly. It is scoped strictly
-- to the caller's own id via auth.uid(), so it can never delete another account.
-- Orphaned Storage objects in the page-assets bucket are not removed here; they
-- are unreachable once the account is gone and can be swept separately.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = uid;
end;
$$;

-- Only a signed-in user may call it, and only for themselves (enforced above).
revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
