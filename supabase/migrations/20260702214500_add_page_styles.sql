-- Add a `styles` column to store per-field text formatting (font, size, bold,
-- italics, underline, alignment, color) for the page's name and bio.
-- Shape: { "name": TextStyle, "bio": TextStyle }.

alter table public.pages
  add column if not exists styles jsonb not null default '{}'::jsonb;
