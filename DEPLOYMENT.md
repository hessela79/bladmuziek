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
  commit `a4fc768` (bevestigd door jou op 2026-10-30) — alles
  hieronder bij "Sinds `aa3da90`" staat nu live en getest bevestigd,
  inclusief de migraties `sql/003_passage_voices.sql`,
  `sql/004_page_views.sql` en `sql/005_passage_updated_at.sql`.
  **Let op voor volgende keer**: bij deze release werd `js/home.js`
  aanvankelijk vergeten in de uploadlijst — dat gaf een reeks
  verwarrende symptomen (zie de `874fd85`-regel hieronder) totdat het
  alsnog apart geüpload werd. Dubbel-check voortaan de volledige
  bestandenlijst tegen `git diff --name-status <vorige-commit>..main`
  in plaats van een lijst uit het geheugen samen te stellen.

### Sinds `aa3da90` (ter referentie, nu dus live)

- `2e66fbe` — **Nieuwe functie + database-migratie**: de stemgroepen van
  een stuk worden niet meer los ingesteld, maar automatisch bepaald uit
  de stemgroep(en) die je per passage kiest (unie van alle
  niet-verwijderde passages). Vereist bij het live zetten: eerst
  `sql/003_passage_voices.sql` op de productie-database draaien (voegt
  de nieuwe kolom toe én vult die voor bestaande passages met de
  huidige stemgroepen van hun stuk, zodat er niets zichtbaar verandert
  totdat je zelf per passage een specifiekere stemgroep kiest). Lokaal
  end-to-end getest met Playwright vóór deze commit.
- `7db1cda` — Stukkenoverzicht (beheerscherm) toont nu apart hoeveel
  passages (met oefenfragment) en hoeveel opmerkingen (zonder fragment)
  een stuk heeft, i.p.v. één totaal. Puur een weergave-wijziging, geen
  database-wijziging.
- `c25dc5a` — Zelfde opsplitsing, nu ook op de publieke overzichtspagina
  die koorleden zien (onder de stemgroep-chips per stuk). Puur een
  weergave-wijziging, geen database-wijziging.
- `95c766f` — **Nieuwe functie + database-migratie**: eigen, minimale
  bezoekstatistieken (hits + geschatte unieke bezoekers, per dag en per
  stuk), te bekijken via een nieuwe "Statistieken"-link in het
  beheerscherm. Vereist bij het live zetten: eerst
  `sql/004_page_views.sql` op de productie-database draaien (voegt
  alleen een nieuwe, lege tabel toe — raakt niets van de bestaande
  data). Lokaal end-to-end getest met Playwright vóór deze commit.
- `72dc78b` — "Nieuw"/"Bijgewerkt"-label op het publieke overzicht, puur
  lokaal (localStorage, geen cookie, geen database-wijziging) op basis
  van het vorige bezoekmoment van die browser.
- `9d55f3f` — **Verbetering + database-migratie**: het "Nieuw"/
  "Bijgewerkt"-label blijft nu staan totdat je het stuk echt opent
  (i.p.v. al bij het eerstvolgende overzicht-bezoek te verdwijnen), en
  "Bijgewerkt" geldt nu ook als je een extra vak aan een bestaande
  passage toevoegt. Vereist bij het live zetten: eerst
  `sql/005_passage_updated_at.sql` op de productie-database draaien
  (voegt een nieuwe kolom toe en vult die voor bestaande passages met
  hun bestaande created_at, zodat er niets zichtbaar verandert). Lokaal
  end-to-end getest met Playwright vóór deze commit.
- `4435047` — **Nieuwe functie**: bij het bewerken van de PDF van een
  stuk kun je nu de actieve pagina vervangen of er een nieuwe pagina
  (PDF of foto/afbeelding) vóór invoegen, via twee nieuwe knopjes bij de
  (nu gecentreerde) vorige/volgende-paginanavigatie. Het hele PDF-bestand
  wordt dan opnieuw opgebouwd en als nieuw bestand opgeslagen zodra je op
  "Bewaren" klikt; het oude PDF-bestand blijft gewoon in de bibliotheek
  staan. Bij invoegen schuiven de paginanummers van bestaande vakken
  automatisch mee op. Geen database-wijziging. Gebruikt een nieuw,
  lokaal meegeleverd bestand (`js/vendor/pdf-lib/`, geen externe
  dienst). Lokaal end-to-end getest met Playwright (alle vier de
  combinaties: PDF/afbeelding × vervangen/invoegen) vóór deze commit.
- `c4867b2` — **Let op, gedragswijziging bij live zetten**: de
  wachtwoordpopup die eerder alleen op de test-/GitHub Pages-omgeving
  verscheen, verschijnt nu overal — dus ook op de echte site. **Zodra
  dit live staat, moet elke bezoeker (ook koorleden op het gewone
  overzicht) eerst het wachtwoord `k00r` invoeren voordat ze iets te
  zien krijgen.** Dat wachtwoord moet dus vooraf gedeeld worden met
  iedereen die de site gebruikt. Het wordt wel per browser onthouden
  (net als voorheen) — iemand hoeft het maar één keer per
  apparaat/browser in te voeren. Het bestand `js/devGate.js` is
  hernoemd naar `js/visitorGate.js` (bij het uploaden dus niet
  vergeten: `devGate.js` mag van de server af, `visitorGate.js` moet
  erbij). Dit is losstaand van de bestaande beheerinlog, die
  ongewijzigd blijft. Geen database-wijziging. Lokaal end-to-end
  getest met Playwright vóór deze commit.
- `874fd85` — **Bugfix** (reden dat "Bijgewerkt" op productie niet
  verscheen na de vorige live-release): MariaDB geeft tijden terug
  zonder tijdzone-aanduiding, en de browser interpreteerde die dan als
  lokale tijd in plaats van de tijd van de server — klopte dat niet met
  elkaar (zeer waarschijnlijk het geval op productie), dan kon een net
  gewijzigde passage onterecht lijken op "ouder dan je laatste bezoek",
  waardoor het label wegbleef. Raakt alleen de 6 bestanden in `api/`
  (`db.php`, `passages.php`, `pieces.php`, `assets.php`, `upload.php`,
  `track.php`) — geen HTML/CSS/JS-bestand, geen database-wijziging.
  Lokaal gereproduceerd en bevestigd opgelost met Playwright (bezoeker
  op Europe/Amsterdam, server op UTC). Bevestigd werkend op productie
  op 2026-10-30, nadat ook het gemiste `js/home.js` alsnog was
  geüpload.

## Nog niet live (wél al in git op `main`)

_Niets op dit moment._

_Nieuwe wijzigingen komen hieronder bij te staan zodra ze gepusht worden._

## Bij een live-deploy: wat moet er gebeuren

1. Bestanden uploaden (FTP/bestandsbeheer): alle gewijzigde bestanden
   sinds de laatste live-commit, **behalve** `api/config.php` (die staat
   al op de server en mag niet overschreven worden door de sample). De
   bestandenlijst wordt altijd opnieuw afgeleid met
   `git diff --name-status <laatste-live-commit>..main`, nooit uit het
   geheugen samengesteld (zie de noot bij `a4fc768` hierboven — dat ging
   hier eerder mis).
2. Als er database-schema-wijzigingen bij zitten (nieuwe kolom, nieuwe
   tabel): het bijbehorende SQL-migratiescript in `sql/` op de
   MariaDB-database draaien.
3. Als er nieuwe stukken/passages/bestanden zijn toegevoegd via de
   Supabase-testomgeving die ook in productie moeten komen: die moeten
   apart overgezet worden (dit bestand volgt alleen *code*, geen data).
4. Na upload: dit bestand bijwerken met de nieuwe laatst-live-commit.
