-- Migratie: een passage kan voortaan uit meerdere rechthoeken bestaan
-- (bijv. een passage die over twee regels of een pagina-einde loopt),
-- in plaats van precies één.
--
-- Eenmalig te draaien op een MariaDB-database die al met de oude
-- mariadb_schema.sql is opgezet (dus al een `passages`-tabel met
-- page/x_pct/y_pct/width_pct/height_pct heeft). Bestaande passages
-- behouden hun ene rechthoek: die wordt overgezet naar de nieuwe tabel
-- passage_rects als het eerste (en enige) vak.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS passage_rects (
  id CHAR(36) NOT NULL PRIMARY KEY,
  passage_id CHAR(36) NOT NULL,
  page INT NOT NULL,
  x_pct DECIMAL(9, 6) NOT NULL,
  y_pct DECIMAL(9, 6) NOT NULL,
  width_pct DECIMAL(9, 6) NOT NULL,
  height_pct DECIMAL(9, 6) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (passage_id) REFERENCES passages (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO passage_rects (id, passage_id, page, x_pct, y_pct, width_pct, height_pct, sort_order)
SELECT UUID(), id, page, x_pct, y_pct, width_pct, height_pct, 0
FROM passages;

ALTER TABLE passages
  DROP COLUMN page,
  DROP COLUMN x_pct,
  DROP COLUMN y_pct,
  DROP COLUMN width_pct,
  DROP COLUMN height_pct;
