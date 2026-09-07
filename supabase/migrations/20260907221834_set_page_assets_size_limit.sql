-- Raise the imported-background ceiling from 8 MB to 20 MB.
--
-- The Studio's own check (MAX_MEDIA_BYTES in src/app/edit/studio-panels.tsx)
-- is only the friendly half of this limit: the enforcing half is the bucket.
-- `page-assets` was created with no file_size_limit, so it silently inherited
-- the project-wide upload cap — a value this repo does not control and that can
-- change under it. Pinning it makes the 20 MB promise the UI makes actually
-- true, and keeps the two numbers reviewable side by side.
--
-- This matters more than a normal limit bump because of the failure mode:
-- persistAsset() treats a rejected upload as non-fatal and keeps the inline
-- base64 data URL in the pages jsonb instead. A background that Storage refuses
-- therefore does not error — it lands a ~27 MB row that every visitor to that
-- page downloads on every load. The bucket must not be the thing that says no.
--
-- The bucket also holds avatars, link logos and uploaded audio; all are smaller
-- than backgrounds, so this is the max across them rather than a per-kind size.
-- 20 MB stays under Supabase's default 50 MB project-level upload cap, which
-- still applies on top of this and is set in the dashboard, not in SQL.

update storage.buckets
set file_size_limit = 20 * 1024 * 1024
where id = 'page-assets';
