-- Notenmap — Supabase-schema
-- Eenmalig te draaien in de Supabase SQL Editor van dit project.
--
-- Model: een "asset databank" (geuploade PDF's en mp3's, herbruikbaar)
-- + pieces (stukken, verwijzen naar een PDF-asset)
-- + passages (moeilijke passages per stuk: positie op de pagina + een
--   audio-asset).
--
-- Rechtenniveau: er is er nog geen, maar RLS staat wél aan met
-- expliciete, voorlopig volledig open policies (in plaats van RLS
-- helemaal uitgeschakeld) — zo kan een echt rechtenniveau er straks
-- ingezet worden door "using (true)" te vervangen, zonder de
-- structuur om te hoeven bouwen.

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
  visible boolean not null default true,
  pdf_asset_id uuid references assets (id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists passages (
  id uuid primary key default gen_random_uuid(),
  piece_id text not null references pieces (id) on delete cascade,
  title text not null,
  description text,
  audio_asset_id uuid references assets (id) on delete set null,
  color text not null default 'goud' check (color in ('geel', 'groen', 'rood', 'blauw', 'bruin', 'goud')),
  page int not null,
  x_pct numeric not null,
  y_pct numeric not null,
  width_pct numeric not null,
  height_pct numeric not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- RLS aan, met (voorlopig) volledig open policies — zie opmerking
-- bovenaan dit bestand.
alter table assets enable row level security;
alter table pieces enable row level security;
alter table passages enable row level security;

create policy "open select assets" on assets for select using (true);
create policy "open insert assets" on assets for insert with check (true);
create policy "open update assets" on assets for update using (true);
create policy "open delete assets" on assets for delete using (true);

create policy "open select pieces" on pieces for select using (true);
create policy "open insert pieces" on pieces for insert with check (true);
create policy "open update pieces" on pieces for update using (true);
create policy "open delete pieces" on pieces for delete using (true);

create policy "open select passages" on passages for select using (true);
create policy "open insert passages" on passages for insert with check (true);
create policy "open update passages" on passages for update using (true);
create policy "open delete passages" on passages for delete using (true);

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

-- Zodra er een rechtenniveau bijkomt: vervang de "open ..."-policies
-- op de 3 tabellen en de "public write/update/delete"-storage-policies
-- door varianten met `using (auth.role() = 'authenticated')` (of een
-- rollen-check). Lezen kan dan vrijwel zeker open blijven.
