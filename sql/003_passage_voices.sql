-- Migratie: passages krijgen een eigen stemgroepen-veld, waarmee de
-- stemgroepen van het hele stuk (pieces.voices) automatisch worden
-- bepaald (unie van alle niet-verwijderde passages van dat stuk) —
-- dat blijft de verantwoordelijkheid van de PHP-API/het beheerscherm,
-- niet van de database zelf.
--
-- Eenmalig te draaien op een MariaDB-database die al mariadb_schema.sql
-- (en 002_passage_rects.sql) heeft gehad.

ALTER TABLE passages
  ADD COLUMN voices VARCHAR(32) NOT NULL DEFAULT '' AFTER color;

-- Vult elke bestaande passage met de huidige stemgroepen van haar stuk,
-- zodat er in de app niets zichtbaar verandert totdat je zelf per
-- passage een specifiekere stemgroep kiest (anders zou het stuk zijn
-- stemgroepen kwijtraken zodra je het voor het eerst weer opslaat, want
-- dan is de unie over alle -nog lege- passages leeg).
UPDATE passages p
JOIN pieces pc ON pc.id = p.piece_id
SET p.voices = pc.voices;
