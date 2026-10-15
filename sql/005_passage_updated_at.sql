-- Migratie: passages krijgen een expliciete "laatst bijgewerkt"-kolom,
-- zodat het publieke overzicht een "Bijgewerkt"-label kan tonen zodra
-- een bestaande passage gewijzigd wordt (bijv. een extra vak), niet
-- alleen bij een gloednieuwe passage. Zie js/home.js.
--
-- Eenmalig te draaien op een MariaDB-database die al mariadb_schema.sql
-- heeft gehad.

ALTER TABLE passages
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER created_at;

-- De ADD COLUMN hierboven vult bestaande rijen met het huidige moment
-- (het migratie-moment) — dat is niet de bedoeling, want dan lijkt elke
-- bestaande passage toevallig "net bijgewerkt". Terugzetten naar het
-- moment waarop de passage oorspronkelijk is aangemaakt.
UPDATE passages SET updated_at = created_at;
