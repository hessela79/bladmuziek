-- Eenmalig te draaien in de Supabase SQL Editor.
--
-- Voegt een "visible"-kolom toe aan pieces, zodat een stuk in het
-- beheer onzichtbaar gemaakt kan worden voor gebruikers (bijv. tijdens
-- het voorbereiden van bladmuziek). Bestaande stukken blijven gewoon
-- zichtbaar (default true).

alter table pieces
  add column if not exists visible boolean not null default true;
