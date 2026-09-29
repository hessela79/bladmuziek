-- Notenmap — MariaDB-schema
-- Eenmalig te draaien op de MariaDB-database van je hosting (bijv. via
-- phpMyAdmin op mijndomein.nl).
--
-- Zelfde model als de eerdere Supabase-opzet: assets (geüploade PDF's en
-- audiofragmenten, herbruikbaar) + pieces (stukken, verwijzen naar een
-- PDF-asset) + passages (moeilijke passages per stuk: positie op de
-- pagina + evt. een audio-asset + kleur).
--
-- Rechtenniveau: lezen is open (geen inloggen nodig), schrijven
-- (toevoegen/wijzigen/verwijderen) vereist een ingelogde beheerder — dat
-- wordt afgedwongen in de PHP-API (api/auth.php), niet in de database
-- zelf. Dit is dezelfde openheid als de vorige Supabase-opzet had.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS assets (
  id CHAR(36) NOT NULL PRIMARY KEY,
  type ENUM('pdf', 'audio') NOT NULL,
  filename VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes BIGINT UNSIGNED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pieces (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  composer VARCHAR(255),
  genre VARCHAR(255),
  -- Komma-gescheiden stemgroepletters, bijv. "S,A,B" (MariaDB heeft geen
  -- array-kolomtype zoals Postgres text[]).
  voices VARCHAR(32) NOT NULL DEFAULT '',
  solo TINYINT(1) NOT NULL DEFAULT 0,
  visible TINYINT(1) NOT NULL DEFAULT 1,
  pdf_asset_id CHAR(36),
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pdf_asset_id) REFERENCES assets (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS passages (
  id CHAR(36) NOT NULL PRIMARY KEY,
  piece_id VARCHAR(191) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  audio_asset_id CHAR(36),
  color VARCHAR(20) NOT NULL DEFAULT 'goud',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (piece_id) REFERENCES pieces (id) ON DELETE CASCADE,
  FOREIGN KEY (audio_asset_id) REFERENCES assets (id) ON DELETE SET NULL,
  CONSTRAINT passages_color_check CHECK (color IN ('geel', 'groen', 'rood', 'blauw', 'bruin', 'goud'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Eén passage kan uit meerdere rechthoeken bestaan (bijv. een passage die
-- over twee regels of een pagina-einde loopt) — vandaar een aparte tabel
-- in plaats van page/x_pct/... rechtstreeks op passages.
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
