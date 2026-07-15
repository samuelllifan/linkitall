-- Storage bucket for user-uploaded page assets: avatars, background media
-- (image/video), and custom link logos. Previously these were stored as base64
-- data URLs inside the `pages` jsonb, which bloated rows and slowed every load.
--
-- The bucket is public-read so pages render for anonymous visitors, while writes
-- are restricted to each user's own top-level folder ("<user_id>/...").

insert into storage.buckets (id, name, public)
values ('page-assets', 'page-assets', true)
on conflict (id) do nothing;

-- Public read: anyone can view assets referenced by a public page.
drop policy if exists "page-assets public read" on storage.objects;
create policy "page-assets public read"
  on storage.objects for select to public
  using (bucket_id = 'page-assets');

-- Owners may write only inside their own "<uid>/" folder. Upsert needs
-- INSERT + SELECT (covered by the public read above) + UPDATE; DELETE lets the
-- app clean up replaced files. `(select auth.uid())` is wrapped in a subquery
-- per Supabase's RLS performance guidance.
drop policy if exists "page-assets owner insert" on storage.objects;
create policy "page-assets owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'page-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "page-assets owner update" on storage.objects;
create policy "page-assets owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'page-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'page-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "page-assets owner delete" on storage.objects;
create policy "page-assets owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'page-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
