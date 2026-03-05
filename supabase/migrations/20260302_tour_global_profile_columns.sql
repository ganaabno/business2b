-- Align public.tours metadata shape with Global-Travel tour model.

begin;

alter table if exists public.tours
  add column if not exists cover_photo text;

alter table if exists public.tours
  add column if not exists country text;

alter table if exists public.tours
  add column if not exists hotel text;

alter table if exists public.tours
  add column if not exists country_temperature text;

alter table if exists public.tours
  add column if not exists duration_day text;

alter table if exists public.tours
  add column if not exists duration_night text;

alter table if exists public.tours
  add column if not exists group_size text;

alter table if exists public.tours
  add column if not exists is_featured boolean default false;

alter table if exists public.tours
  add column if not exists genre text;

alter table if exists public.tours
  add column if not exists airlines text[] default array[]::text[];

update public.tours
set cover_photo = image_key
where coalesce(btrim(cover_photo), '') = '' and coalesce(btrim(image_key), '') <> '';

commit;
