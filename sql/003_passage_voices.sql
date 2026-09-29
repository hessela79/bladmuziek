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
