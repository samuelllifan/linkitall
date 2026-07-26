-- Contact form submissions from the public /contact page.
--
-- Anyone (signed in or not) may submit a message, so anon + authenticated get
-- INSERT. Nobody gets SELECT via RLS: messages may contain personal info and
-- must never be readable by ordinary visitors. The sole admin reads them
-- through admin_contact_messages() (SECURITY DEFINER), mirroring the app's
-- existing admin_overview / record_analytics_event pattern instead of shipping
-- a service-role key to the client.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  -- If a signed-in user submits, record who (nullable for anonymous visitors).
  submitted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Guard against empty / abusively large submissions at the DB layer.
  constraint contact_messages_name_len check (char_length(name) between 1 and 200),
  constraint contact_messages_email_len check (char_length(email) between 3 and 320),
  constraint contact_messages_subject_len check (char_length(subject) between 1 and 300),
  constraint contact_messages_message_len check (char_length(message) between 1 and 5000)
);

alter table public.contact_messages enable row level security;

-- Admin reads are ordered newest-first over created_at.
create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

-- INSERT-only policies, one per role. A signed-in submitter may only attribute
-- a message to themselves; anonymous submissions leave submitted_by null.
create policy "anon can submit contact messages"
  on public.contact_messages for insert to anon
  with check (submitted_by is null);

create policy "authenticated can submit contact messages"
  on public.contact_messages for insert to authenticated
  with check (submitted_by is null or submitted_by = (select auth.uid()));

grant insert on public.contact_messages to anon, authenticated;

-- Admin-only read. Definer so it can bypass the closed RLS, but it raises unless
-- the caller is the admin — useless to everyone else. search_path emptied and
-- every name schema-qualified per Supabase hardening guidance.
create or replace function public.admin_contact_messages()
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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'name', m.name,
        'email', m.email,
        'subject', m.subject,
        'message', m.message,
        'submittedBy', m.submitted_by,
        'createdAt', m.created_at
      )
      order by m.created_at desc
    ),
    '[]'::jsonb
  )
  into result
  from public.contact_messages m;

  return result;
end;
$$;

grant execute on function public.admin_contact_messages() to authenticated;
