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

- `2e66fbe` — **Nieuwe functie + database-migratie**: de stemgroepen van
  een stuk worden niet meer los ingesteld, maar automatisch bepaald uit
  de stemgroep(en) die je per passage kiest (unie van alle
  niet-verwijderde passages). Vereist bij het live zetten: eerst
  `sql/003_passage_voices.sql` op de productie-database draaien (voegt
  de nieuwe kolom toe én vult die voor bestaande passages met de
  huidige stemgroepen van hun stuk, zodat er niets zichtbaar verandert
  totdat je zelf per passage een specifiekere stemgroep kiest). Lokaal
  end-to-end getest met Playwright vóór deze commit.
- `7db1cda` — Stukkenoverzicht toont nu apart hoeveel passages (met
  oefenfragment) en hoeveel opmerkingen (zonder fragment) een stuk
  heeft, i.p.v. één totaal. Puur een weergave-wijziging, geen
  database-wijziging.

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
