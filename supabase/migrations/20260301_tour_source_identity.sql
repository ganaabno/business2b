-- Canonical external tour identity for cross-system dedupe.

begin;

alter table if exists public.tours
  add column if not exists source_system text;

alter table if exists public.tours
  add column if not exists source_tour_id text;

update public.tours
set source_system = 'gtrip'
where source_system is null or btrim(source_system) = '';

alter table public.tours
  alter column source_system set default 'gtrip';

create unique index if not exists tours_source_identity_uidx
  on public.tours ((lower(source_system)), source_tour_id)
  where source_system is not null and source_tour_id is not null and btrim(source_tour_id) <> '';

create index if not exists tours_source_system_idx
  on public.tours ((lower(source_system)));

commit;
