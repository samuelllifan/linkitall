-- Add an `avatar` column to store the page's profile picture as a data URL.

alter table public.pages
  add column if not exists avatar text;
