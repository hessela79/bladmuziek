// Onthoudt, per browser, wanneer iemand voor het laatst op de
// overzichtspagina is geweest — puur lokaal (localStorage, geen cookie,
// niets dat naar de server gestuurd wordt). Wordt gebruikt om "Nieuw"/
// "Bijgewerkt"-labels te tonen op stukken die sindsdien zijn toegevoegd
// of aangevuld.

const STORAGE_KEY = "notenmap-last-visit";

// Geeft het vorige bezoekmoment terug (of null bij een eerste bezoek) en
// werkt de opslag meteen bij naar nu, zodat een volgend bezoek weer een
// correcte vergelijkingsdatum heeft.
export function getLastVisitAndUpdate() {
  let previous = null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    previous = stored ? new Date(stored) : null;
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    // Privé-browsen of localStorage geblokkeerd: dan maar geen labels —
    // de pagina moet hoe dan ook gewoon blijven werken.
  }
  return previous;
}
