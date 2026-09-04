-- Notenmap — Supabase-schema
-- Eenmalig te draaien in de Supabase SQL Editor van dit project.
--
-- Model: een "asset databank" (geuploade PDF's en mp3's, herbruikbaar)
-- + pieces (stukken, verwijzen naar een PDF-asset)
-- + passages (moeilijke passages per stuk: positie op de pagina + een
--   audio-asset).
--
-- Rechtenniveau: er is er nog geen. RLS staat uit op de tabellen en de
-- storage-policies staan open, zodat de app zonder login kan lezen én
-- schrijven. Zodra er een rechtenniveau bijkomt, is dit het eerste dat
-- vervangen wordt door echte policies (zie opmerking onderaan).

create extension if not exists pgcrypto;

-- ---------- Tabellen ----------

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('pdf', 'audio')),
  filename text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists pieces (
  id text primary key,
  title text not null,
  composer text,
  genre text,
  voices text[] not null default '{}',
  solo boolean not null default false,
  pdf_asset_id uuid references assets (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists passages (
  id uuid primary key default gen_random_uuid(),
  piece_id text not null references pieces (id) on delete cascade,
  title text not null,
  description text,
  audio_asset_id uuid references assets (id) on delete set null,
  page int not null,
  x_pct numeric not null,
  y_pct numeric not null,
  width_pct numeric not null,
  height_pct numeric not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Geen rechtenniveau nog: RLS uit = de anon-key mag alles lezen/schrijven.
alter table assets disable row level security;
alter table pieces disable row level security;
alter table passages disable row level security;

-- ---------- Storage: buckets voor de bestanden zelf ----------

insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict (id) do nothing;

-- Storage.objects heeft altijd RLS aan (systeemtabel) — dus expliciete,
-- voorlopig volledig open policies per bucket:

drop policy if exists "public read pdfs" on storage.objects;
create policy "public read pdfs" on storage.objects
  for select using (bucket_id = 'pdfs');

drop policy if exists "public write pdfs" on storage.objects;
create policy "public write pdfs" on storage.objects
  for insert with check (bucket_id = 'pdfs');

drop policy if exists "public update pdfs" on storage.objects;
create policy "public update pdfs" on storage.objects
  for update using (bucket_id = 'pdfs');

drop policy if exists "public delete pdfs" on storage.objects;
create policy "public delete pdfs" on storage.objects
  for delete using (bucket_id = 'pdfs');

drop policy if exists "public read audio" on storage.objects;
create policy "public read audio" on storage.objects
  for select using (bucket_id = 'audio');

drop policy if exists "public write audio" on storage.objects;
create policy "public write audio" on storage.objects
  for insert with check (bucket_id = 'audio');

drop policy if exists "public update audio" on storage.objects;
create policy "public update audio" on storage.objects
  for update using (bucket_id = 'audio');

drop policy if exists "public delete audio" on storage.objects;
create policy "public delete audio" on storage.objects
  for delete using (bucket_id = 'audio');

-- Zodra er een rechtenniveau bijkomt: RLS weer aanzetten op de 3
-- tabellen + de "public write/update/delete"-storage-policies vervangen
-- door varianten met `using (auth.role() = 'authenticated')` (of een
-- rollen-check). Lezen kan dan vrijwel zeker open blijven.
