// Onthoudt, per stuk en per browser, wanneer iemand dat stuk voor het
// laatst echt heeft geopend (niet alleen het overzicht bekeken) — puur
// lokaal (localStorage, geen cookie, niets dat naar de server gestuurd
// wordt). Daarmee blijft een "Nieuw"/"Bijgewerkt"-label op het publieke
// overzicht staan totdat iemand het stuk echt opent, in plaats van al
// bij het eerstvolgende bezoek aan het overzicht te verdwijnen.

const STORAGE_KEY = "notenmap-seen-pieces";

function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Privé-browsen of localStorage geblokkeerd: labels werken dan niet,
    // maar de rest van de pagina moet gewoon blijven werken.
  }
}

// Geeft de kaart {pieceId: isoTimestamp} terug van wanneer elk stuk voor
// het laatst geopend is. Bestaat er nog helemaal geen kaart (de eerste
// keer dat dit ooit op dit apparaat draait), dan geldt al het huidige
// repertoire per definitie als "al gezien": de kaart wordt dan in één
// keer gevuld met nu voor elk meegegeven stuk-ID, en de aanroeper toont
// voor dit bezoek nog geen enkel label.
export function getSeenMapOrBootstrap(allPieceIds) {
  const existing = readMap();
  if (existing) return { map: existing, justBootstrapped: false };

  const now = new Date().toISOString();
  const bootstrapped = {};
  for (const id of allPieceIds) bootstrapped[id] = now;
  writeMap(bootstrapped);
  return { map: bootstrapped, justBootstrapped: true };
}

// Markeert één stuk als zojuist geopend — aanroepen vanuit viewer.js,
// niet vanuit het overzicht zelf (alleen een kaart zíen is niet
// hetzelfde als het stuk echt bekijken).
export function markPieceSeen(pieceId) {
  const map = readMap() || {};
  map[pieceId] = new Date().toISOString();
  writeMap(map);
}
