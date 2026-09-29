-- Migratie: passages krijgen een eigen stemgroepen-veld, waarmee de
-- stemgroepen van het hele stuk (pieces.voices) automatisch worden
-- bepaald (unie van alle niet-verwijderde passages van dat stuk) — dat
-- blijft de verantwoordelijkheid van het beheerscherm, niet van de
-- database zelf.
--
-- Eenmalig te draaien in de Supabase SQL Editor, ná schema.sql (en
-- add_passage_rects.sql).

alter table passages add column if not exists voices text[] not null default '{}';
