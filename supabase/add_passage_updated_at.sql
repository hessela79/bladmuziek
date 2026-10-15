-- Migratie: passages krijgen een expliciete "laatst bijgewerkt"-kolom,
-- zodat het publieke overzicht een "Bijgewerkt"-label kan tonen zodra
-- een bestaande passage gewijzigd wordt (bijv. een extra vak), niet
-- alleen bij een gloednieuwe passage. Zie js/home.js.
--
-- Eenmalig te draaien in de Supabase SQL Editor, ná schema.sql.

alter table passages add column if not exists updated_at timestamptz not null default now();

-- De default hierboven vult bestaande rijen met het huidige moment (het
-- migratie-moment) — niet de bedoeling, want dan lijkt elke bestaande
-- passage toevallig "net bijgewerkt". Terugzetten naar het moment
-- waarop de passage oorspronkelijk is aangemaakt.
update passages set updated_at = created_at;
