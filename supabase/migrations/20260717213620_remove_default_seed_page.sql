-- Remove the legacy MVP seed page ("lifanfx / Video Editor | VFX / TikTok").
-- It was inserted by the initial create_pages migration as the single shared
-- MVP page and left unclaimed (user_id is null) once per-user ownership landed.
-- Nothing reads it anymore (queryPage filters by user_id; get_public_page joins
-- on user_id), so deleting the orphan row is safe. Guarded to the unclaimed
-- seed only, so no real user's page can be affected.
delete from public.pages
where slug = 'default' and user_id is null;
