# Notenmap — bladmuziek met afspeelknoppen

Een klein, platform-onafhankelijk webproject voor een koor: een overzicht
waaruit zangers een stuk kiezen, en een bladmuziek-pagina waarin op de
plek van moeilijke passages een afspeelknop staat. Klik/tik erop en het
bijbehorende oefenfragment (mp3) speelt af — werkt in elke moderne
browser, op telefoon, tablet of laptop. Geen app-installatie nodig.

Dit is een **demo met 6 fictieve stukken, nagemaakte bladmuziek en
gesynthetiseerde audiofragmenten** (geen echte partituren of opnames),
zodat je meteen kunt zien en beluisteren hoe het werkt. Zie hieronder hoe
je er je eigen stukken, PDF's en mp3's in zet.

## Zelf bekijken

Puur statische bestanden, geen build-stap, geen server-side code.

```bash
python3 -m http.server 8080
# of: npx serve
```

Open daarna `http://localhost:8080`.

(Rechtstreeks openen als `file://` werkt niet — de pagina's halen data op
via `fetch`, en dat blokkeren browsers vanaf het bestandssysteem. Een
simpele static-file server is genoeg, geen speciale hosting vereist.)

## Schermen

- **`index.html`** — overzicht van alle stukken (kaarten met titel,
  arrangeur, genre, stemgroepen en aantal oefenpassages). Klikken op een
  kaart gaat naar `viewer.html?stuk=<id>`.
- **`viewer.html`** — toont de bladmuziek van het gekozen stuk met
  klikbare afspeelknoppen op de gemarkeerde passages, plus een vaste
  "nu speelt"-balk onderin en een link terug naar het overzicht.

## Hoe het werkt

- `data/pieces.json` — de lijst van alle stukken: titel, arrangeur,
  genre, stemgroepen, aantal oefenpassages, en waar de PDF en de
  passage-data van dat stuk staan.
- `data/passages/<stuk-id>.json` — per stuk: voor elke passage het
  audiobestand en de positie op de pagina (paginanummer + genormaliseerde
  x/y/breedte/hoogte, 0–1, oorsprong linksboven).
- `assets/pdf/<stuk-id>.pdf` — de bladmuziek van dat stuk.
- `assets/audio/<stuk-id>/*.mp3` — de oefenfragmenten van dat stuk.
- `js/home.js` — bouwt het kaartenoverzicht op uit `data/pieces.json`.
- `js/viewer.js` — leest `?stuk=` uit de URL, rendert de PDF pagina voor
  pagina op een `<canvas>` (met [pdf.js](https://mozilla.github.io/pdf.js/),
  lokaal meegeleverd in `js/vendor/pdfjs/` zodat er geen externe CDN nodig
  is) en legt daarover doorzichtige knoppen op basis van de passage-data.
  Klikken speelt de mp3 af via de standaard HTML5 `<audio>`-API; nogmaals
  klikken stopt 'm.
- `css/style.css` — het gedeelde, muzikale uiterlijk (perkament/gouden
  tinten, notenbalklijnen als decoratie), met automatische donkere modus
  via `prefers-color-scheme`.

Omdat de knop-posities in procenten van de paginabreedte/-hoogte staan,
schalen ze automatisch mee als de pagina op een kleiner scherm smaller
wordt weergegeven.

## Je eigen stukken, bladmuziek en fragmenten gebruiken

1. Vervang de PDF's in `assets/pdf/` en de mp3's in `assets/audio/<id>/`
   door je eigen bestanden.
2. Bepaal per moeilijke passage op welke pagina en op welke plek (in
   procenten van de paginabreedte/-hoogte, vanaf linksboven) de knop moet
   komen — zie de uitleg in de vorige versie van dit document, of voeg
   tijdelijk een `console.log` toe in `js/viewer.js` om bij een klik de
   percentages af te lezen.
3. Werk `data/pieces.json` en `data/passages/<id>.json` bij met je eigen
   stukken en passages (zelfde structuur als de bestaande voorbeelden).
4. Vernieuw de pagina — alles verschijnt automatisch, de JS-bestanden
   hoeven niet aangepast te worden.

## Publiceren

Puur statische bestanden (HTML/CSS/JS/PDF/mp3), dus te hosten op elk
platform dat statische sites serveert: GitHub Pages, Netlify, Vercel, of
een map op een eigen webserver.

## Hoe de demo-inhoud is gemaakt

`scripts/generate_content.py` genereert voor alle 6 voorbeeldstukken de
nagemaakte bladmuziek-PDF's, de gesynthetiseerde mp3's en de bijbehorende
`data/pieces.json` + `data/passages/*.json`. Alleen voor deze demo — voor
je eigen koor gebruik je gewoon je eigen PDF-export en ingezongen
opnames. Vereist `reportlab` en `lameenc` (`pip install reportlab
lameenc`).
