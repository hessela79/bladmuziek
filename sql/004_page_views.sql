-- Migratie: eigen, minimale bezoekregistratie (hits + geschatte unieke
-- bezoekers, per stuk en per dag) — zie README/DEPLOYMENT.md.
--
-- Eenmalig te draaien op een MariaDB-database die al mariadb_schema.sql
-- heeft gehad.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS page_views (
  id CHAR(36) NOT NULL PRIMARY KEY,
  path VARCHAR(20) NOT NULL,
  piece_id VARCHAR(191),
  visitor_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (piece_id) REFERENCES pieces (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_page_views_created_at ON page_views (created_at);
