# Notenmap — bladmuziek met afspeelknoppen

Een klein webproject voor een koor: een overzicht waaruit zangers een
stuk kiezen, en een bladmuziek-pagina waarin op de plek van moeilijke
passages een afspeelknop staat. Klik/tik erop en het bijbehorende
oefenfragment (mp3/mp4) speelt af. Vanuit een beheerscherm (achter een
wachtwoord) voeg je zelf stukken, PDF's en oefenfragmenten toe.

## Architectuur

- **Frontend**: statische HTML/CSS/JS (geen build-stap, geen framework).
  `index.html` (overzicht), `viewer.html` (bladmuziek + afspeelknoppen),
  `admin.html` (beheer, achter een wachtwoord).
- **Backend**: een kleine PHP-API in `api/` die met een MariaDB-database
  praat — draait op gewone PHP+MySQL/MariaDB shared hosting (bijv.
  mijndomein.nl). Lezen (de site bekijken) is open; toevoegen/wijzigen/
  verwijderen vereist een ingelogde beheerder.
- **Bestanden** (PDF's, mp3/mp4-fragmenten) staan gewoon als losse
  bestanden in `uploads/pdfs/` en `uploads/audio/` op de server, niet in
  de database.

## Lokaal draaien

Nodig: PHP 8+ met de `pdo_mysql`-extensie, en een MariaDB/MySQL-server.

1. Database aanmaken en het schema toepassen:
   ```bash
   mysql -u root -e "CREATE DATABASE notenmap CHARACTER SET utf8mb4;"
   mysql -u root notenmap < sql/mariadb_schema.sql
   ```
2. `api/config.sample.php` kopiëren naar `api/config.php` en invullen
   (databasegegevens + een wachtwoord-hash voor het beheerscherm — zie de
   uitleg bovenin dat bestand). **`api/config.php` staat in `.gitignore`
   en mag nooit in git terechtkomen.**
3. Server starten vanaf de projectmap:
   ```bash
   php -S localhost:8080
   ```
4. Open `http://localhost:8080` voor het overzicht, of
   `http://localhost:8080/admin.html` om in te loggen en stukken toe te
   voegen.

## Hosten op shared hosting (bijv. mijndomein.nl)

1. Maak een MariaDB/MySQL-database aan via het hostingpaneel en pas
   `sql/mariadb_schema.sql` toe (bijv. via phpMyAdmin).
2. Upload de hele projectmap naar je webruimte (FTP of bestandsbeheer in
   het paneel).
3. Maak op de server zelf `api/config.php` aan (kopie van
   `api/config.sample.php`, ingevuld met je eigen databasegegevens en
   wachtwoord-hash). Upload dit bestand apart — het staat bewust niet in
   git.
4. Zorg dat `uploads/pdfs/` en `uploads/audio/` beschrijfbaar zijn voor
   PHP (standaard rechten zijn meestal genoeg).
5. Open `jouwdomein.nl/admin.html`, log in en voeg je eerste stuk toe.

`api/.htaccess` en `uploads/.htaccess` beveiligen `config.php` en
voorkomen dat een geüpload bestand ooit als PHP-script wordt uitgevoerd
— dit werkt alleen op een Apache-server (zoals gangbare shared hosting),
niet met `php -S` lokaal.

## Overkomen van bestaande Supabase-data

Als je eerder de Supabase-versie van deze app gebruikte: draai
`scripts/migrate_supabase_to_mariadb.mjs` (Node 18+, geen npm-install
nodig) nádat de nieuwe site live staat. Vul bovenin het script je eigen
`TARGET_URL` en beheerderswachtwoord in, en draai:

```bash
node scripts/migrate_supabase_to_mariadb.mjs
```

Dit zet alle stukken, passages en bestanden (PDF's + audio) over naar de
nieuwe backend.

## Schermen

- **`index.html`** — overzicht van alle *zichtbare* stukken (kaarten met
  titel, arrangeur, genre, stemgroepen en aantal oefenpassages). Klikken
  op een kaart gaat naar `viewer.html?stuk=<id>`.
- **`viewer.html`** — toont de bladmuziek van het gekozen stuk met
  klikbare, gekleurde afspeelknoppen op de gemarkeerde passages, plus een
  vaste "nu speelt"-balk (vorige/volgende, 5s terug/vooruit, snelheid) en
  een link terug naar het overzicht.
- **`admin.html`** — beheer (achter een wachtwoord): stukken toevoegen/
  bewerken/verwijderen/herordenen, per stuk zichtbaarheid instellen,
  passages tekenen op de PDF met titel, opmerking, kleur en optioneel een
  oefenfragment, en een bibliotheek van alle geüploade bestanden.

## Belangrijkste bestanden

- `js/apiClient.js` — alle communicatie met de PHP-API (lezen is open,
  schrijven vereist inloggen; de browser stuurt het sessie-cookie vanzelf
  mee omdat alles op hetzelfde domein draait).
- `api/*.php` — de backend: `pieces.php`, `passages.php`, `assets.php`,
  `upload.php`, `reorder_pieces.php` (data), en `login.php`/`logout.php`/
  `session.php`/`auth.php` (inloggen voor het beheerscherm).
- `sql/mariadb_schema.sql` — het databaseschema.
- `js/home.js` / `js/viewer.js` / `js/admin.js` — respectievelijk het
  overzicht, de bladmuziek-viewer (met [pdf.js](https://mozilla.github.io/pdf.js/),
  lokaal meegeleverd in `js/vendor/pdfjs/`) en het beheerscherm.
- `js/export.js` — bouwt een zelfstandig HTML-bestand van één stuk (PDF-
  pagina's en audio ingebed als base64), te downloaden en bijv. op Google
  Drive te zetten. De exportknop staat momenteel verborgen in de viewer
  (zie `viewer.html`) — de functionaliteit zelf werkt nog gewoon.
- `css/style.css` / `css/admin.css` — het muzikale uiterlijk (perkament/
  gouden tinten), met automatische donkere modus via
  `prefers-color-scheme`.

## Hoe de demo-inhoud is gemaakt

`scripts/generate_content.py` genereert nagemaakte bladmuziek-PDF's en
gesynthetiseerde mp3's voor de voorbeeldstukken (`data/pieces.json` +
`data/passages/*.json`, gebruikt door het oude `scripts/
migrate_to_supabase.mjs`). Alleen relevant als je opnieuw demo-inhoud
wilt genereren — voor je eigen koor gebruik je gewoon je eigen PDF-export
en ingezongen opnames via het beheerscherm.
