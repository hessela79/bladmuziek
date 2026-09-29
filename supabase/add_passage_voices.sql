-- Migratie: passages krijgen een eigen stemgroepen-veld, waarmee de
-- stemgroepen van het hele stuk (pieces.voices) automatisch worden
-- bepaald (unie van alle niet-verwijderde passages van dat stuk) — dat
-- blijft de verantwoordelijkheid van het beheerscherm, niet van de
-- database zelf.
--
-- Eenmalig te draaien in de Supabase SQL Editor, ná schema.sql (en
-- add_passage_rects.sql).

alter table passages add column if not exists voices text[] not null default '{}';

-- Vult elke bestaande passage met de huidige stemgroepen van haar stuk,
-- zodat er in de app niets zichtbaar verandert totdat je zelf per
-- passage een specifiekere stemgroep kiest (anders zou het stuk zijn
-- stemgroepen kwijtraken zodra je het voor het eerst weer opslaat, want
-- dan is de unie over alle -nog lege- passages leeg).
update passages
set voices = pieces.voices
from pieces
where pieces.id = passages.piece_id;
