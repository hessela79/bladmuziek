# Deploystatus

Bijhouden wat er op de productieomgeving staat, zodat we weten wat er nog
"live gezet" moet worden zodra jij daarom vraagt. Dit bestand wordt door
Claude bijgewerkt bij elke wijziging en bij elke keer dat productie ge-
update wordt — niet iets om zelf handmatig te onderhouden, maar wel fijn
om even te checken.

## Productie

- **URL**: https://hjk.hartvolmuziek.nl/
- **Backend**: PHP + MariaDB (`js/backends/mariadb.js`, `api/*.php`)
- **Laatst bevestigd live gezet (door jou, handmatig geüpload)**:
  commit `aa3da90` — inclusief dual-backend switch, tablet-tekenfix,
  wachtwoordpopup test-/GitHub Pages-omgeving, meerdere vakken per
  passage (+ database-migratie `sql/002_passage_rects.sql`, door jou
  gedraaid) en de hidden-knoppen-bugfix (2026-09-29, bevestigd door jou
  op 2026-09-29)

## Nog niet live (wél al in git op `main`)

Nog niets — alles op `main` staat nu ook op hjk.hartvolmuziek.nl.

_Nieuwe wijzigingen komen hieronder bij te staan zodra ze gepusht worden._

## Bij een live-deploy: wat moet er gebeuren

1. Bestanden uploaden (FTP/bestandsbeheer): alle gewijzigde bestanden
   sinds de laatste live-commit, **behalve** `api/config.php` (die staat
   al op de server en mag niet overschreven worden door de sample).
2. Als er database-schema-wijzigingen bij zitten (nieuwe kolom, nieuwe
   tabel): het bijbehorende SQL-migratiescript in `sql/` op de
   MariaDB-database draaien.
3. Als er nieuwe stukken/passages/bestanden zijn toegevoegd via de
   Supabase-testomgeving die ook in productie moeten komen: die moeten
   apart overgezet worden (dit bestand volgt alleen *code*, geen data).
4. Na upload: dit bestand bijwerken met de nieuwe laatst-live-commit.
