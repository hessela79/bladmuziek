# Bladmuziek met afspeelknoppen (demo)

Een klein, platform-onafhankelijk webproject dat digitale bladmuziek (PDF)
toont met klikbare knoppen op de plek van moeilijke passages. Klik/tik op
zo'n knop en het bijbehorende oefenfragment (mp3) speelt af — werkt in elke
moderne browser, op telefoon, tablet of laptop. Geen app-installatie nodig.

Dit is een **demo met nagemaakte bladmuziek en gesynthetiseerde
audiofragmenten** (geen echte partituur of opnames), zodat je meteen kunt
zien en beluisteren hoe het werkt. Zie hieronder hoe je 'm vervangt door
je eigen PDF en mp3's.

## Zelf bekijken

Dit is een statische site: geen build-stap, geen server-side code nodig.

```bash
python3 -m http.server 8080
# of: npx serve
```

Open daarna `http://localhost:8080` in de browser.

(Rechtstreeks openen als `file://` werkt niet, omdat de PDF en de
passages.json via `fetch` worden opgehaald — browsers blokkeren dat vanaf
het bestandssysteem. Een simpele static-file server is genoeg, geen
speciale hosting vereist.)

## Hoe het werkt

- `assets/pdf/voorbeeld-bladmuziek.pdf` — de bladmuziek.
- `assets/audio/*.mp3` — de oefenfragmenten per passage.
- `data/passages.json` — koppelt elke passage aan een audiobestand én de
  positie op de pagina (paginanummer + genormaliseerde x/y/breedte/hoogte,
  0–1, oorsprong linksboven).
- `js/app.js` — rendert de PDF pagina voor pagina op een `<canvas>` (met
  [pdf.js](https://mozilla.github.io/pdf.js/), lokaal meegeleverd in
  `js/vendor/pdfjs/` zodat er geen externe CDN nodig is) en legt daarover
  doorzichtige knoppen op basis van `passages.json`. Klikken speelt de mp3
  af via de standaard HTML5 `<audio>`-API; nogmaals klikken stopt 'm.

Omdat de knop-posities in procenten van de paginabreedte/-hoogte staan,
schalen ze automatisch mee als de pagina op een kleiner scherm (telefoon)
smaller wordt weergegeven.

## Je eigen bladmuziek en fragmenten gebruiken

1. Vervang `assets/pdf/voorbeeld-bladmuziek.pdf` door je eigen PDF en zet
   je eigen mp3's in `assets/audio/`.
2. Bepaal per moeilijke passage op welke pagina en op welke plek (in
   procenten van de paginabreedte/-hoogte, vanaf linksboven) de knop moet
   komen. Twee manieren om dat te doen:
   - **Kladwerk**: open de pagina in een PDF-viewer, meet de positie van
     de passage ten opzichte van de paginarand, en reken om naar
     percentages (`x / paginabreedte`, `y / paginahoogte`, enz.).
   - **Handiger**: zet tijdelijk `js/app.js` in een modus die bij een
     muisklik de percentages in de console logt (een paar regels toe te
     voegen aan `addPassageButton`/de canvas-click), klik dan op de juiste
     plek in de browser en lees de waarden af.
3. Voeg voor elke passage een object toe aan `data/passages.json`, bv.:

   ```json
   {
     "id": "maat-12-15-sopraan",
     "title": "Maat 12–15 — Sopraan",
     "description": "Modulatie die vaak misgaat.",
     "audio": "assets/audio/sopraan-maat12.mp3",
     "page": 1,
     "xPct": 0.32,
     "yPct": 0.41,
     "widthPct": 0.18,
     "heightPct": 0.06
   }
   ```

4. Vernieuw de pagina — de knoppen verschijnen automatisch, `app.js` hoeft
   niet aangepast te worden.

## Publiceren

Puur statische bestanden (HTML/CSS/JS/PDF/mp3), dus te hosten op elk
platform dat statische sites serveert: GitHub Pages, Netlify, Vercel, of
gewoon een map op een eigen webserver. Belangrijk is alleen dat de mp3's en
de PDF niet te groot worden voor de hosting die je kiest (bij twijfel: mp3's
comprimeren naar een lage bitrate, dat is voor korte oefenfragmenten meer
dan voldoende kwaliteit).

## Hoe de demo-bestanden zijn gemaakt

`scripts/generate_pdf.py` en `scripts/generate_audio.py` genereren de
nagemaakte bladmuziek-PDF en de gesynthetiseerde mp3's (alleen voor deze
demo — voor je eigen bladmuziek gebruik je gewoon je eigen PDF-export en
ingezongen opnames). Vereist `reportlab` en `lameenc` (`pip install
reportlab lameenc`).
