-- Migratie: eigen, minimale bezoekregistratie (hits + geschatte unieke
-- bezoekers, per stuk en per dag) — zie README/DEPLOYMENT.md.
--
-- Eenmalig te draaien in de Supabase SQL Editor, ná schema.sql.

create table if not exists page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  piece_id text references pieces (id) on delete set null,
  visitor_id uuid not null,
  created_at timestamptz not null default now()
);

alter table page_views enable row level security;

create policy "open select page_views" on page_views for select using (true);
create policy "open insert page_views" on page_views for insert with check (true);
