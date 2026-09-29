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
  commit `0df5ba8` — "Wijzig koornaam naar Haarlems Jazz Koor" (2026-09-18,
  bevestigd door jou op 2026-09-29)

## Nog niet live (wél al in git op `main`)

Commits die ná de laatste live-bevestiging zijn gepusht, maar nog niet
naar hjk.hartvolmuziek.nl geüpload zijn:

- `41065a4` — Voeg dual-backend switch toe: MariaDB in productie,
  Supabase voor testen. Puur infrastructuur; verandert niets aan hoe
  productie zich gedraagt zodra het wél geüpload wordt (het domein
  hjk.hartvolmuziek.nl blijft automatisch de MariaDB-backend gebruiken).
- `8f7b94c` — Dit bestand (DEPLOYMENT.md) zelf; hoeft niet per se mee
  geüpload te worden (het wordt niet door de app gebruikt), maar kan
  geen kwaad.
- `ed134af` — **Echte bugfix**: passage tekenen op een tablet/
  touchscreen liet het venster scrollen in plaats van een rechthoek te
  tekenen (ontbrekende `touch-action: none` tijdens het tekenen). Deze
  wil je waarschijnlijk wél snel live hebben zodra je op een tablet
  test/beheert.
- `78f4fd6` — Dit bestand zelf bijgewerkt met de tablet-fix hierboven.
  Geen effect op de app.
- `5191a63` — Wachtwoordpopup toegevoegd voor de test-/GitHub
  Pages-omgeving (`js/devGate.js`, `js/prodHosts.js`). **Verandert niets
  aan productie**: op `hjk.hartvolmuziek.nl` zelf blijft de popup altijd
  weg (productiedomein staat op de uitzonderingslijst), dus dit hoeft
  qua urgentie niet snel live — het is puur bedoeld om de Supabase/
  GitHub Pages-testomgeving af te schermen.
- `f5b4e02` — **Nieuwe functie + database-migratie**: een passage kan nu
  uit meerdere vakken (rechthoeken) bestaan, bijv. voor een passage die
  over een pagina-einde of twee regels loopt. Vereist bij het live
  zetten: eerst `sql/002_passage_rects.sql` op de productie-database
  draaien (zet bestaande passages automatisch om naar hun eerste vak —
  geen dataverlies), dán pas de nieuwe bestanden uploaden. Lokaal
  end-to-end getest (aanmaken/bewerken/verwijderen van vakken, viewer,
  cascade-verwijdering) met Playwright vóór deze commit.
- `6ff8f86` — **Bugfix**: de "sleep het volgende vak"-banner uit de
  vorige commit bleef per ongeluk altijd zichtbaar staan onder "+
  Passage tekenen" (ook buiten het tekenen van een extra vak om), en de
  knop erin deed dan niets. Zelfde bugpatroon als eerder bij de
  Uitloggen-knop: eigen CSS overschreef de browserstandaard voor
  `hidden`. Trof ook (onopgemerkt, al langer bestaand) "+ Passage
  tekenen" vóór het kiezen van een PDF en "Verwijderen" bij een nieuwe
  passage. Puur een CSS-fix, geen database-wijziging.

_Nieuwe wijzigingen die je vanmiddag via Supabase/GitHub Pages laat
testen, komen hieronder bij te staan zodra ze gepusht worden._

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
