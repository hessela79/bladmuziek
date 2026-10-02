// Anoniem apparaat-ID voor de eigen bezoekregistratie (zie
// DEPLOYMENT.md/README): een willekeurig nummer dat de browser zelf
// bewaart in localStorage, zodat herhaalde bezoeken vanaf hetzelfde
// apparaat/browser als "dezelfde bezoeker" meetellen. Geen naam, e-mail
// of IP-adres, en nooit gedeeld met een derde partij.

const STORAGE_KEY = "notenmap-visitor-id";

export function getVisitorId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // Privé-browsen of localStorage geblokkeerd: val terug op een
    // tijdelijk ID — dit bezoek telt dan mee, maar niet als herkende
    // terugkerende bezoeker.
    return crypto.randomUUID();
  }
}
