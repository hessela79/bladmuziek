// Kiest welke backend de app gebruikt en her-exporteert die ene set
// functies naar de rest van de app (home.js/viewer.js/admin.js/export.js
// importeren allemaal alleen van dit bestand, en weten niet welke
// backend er onder zit).
//
// - Productiedomein(en) hieronder in PRODUCTION_HOSTS -> js/backends/mariadb.js
//   (de eigen PHP-API op MariaDB, met een echt inlogscherm voor beheer).
// - Alle andere hostnamen (GitHub Pages, localhost, een preview-domein, …)
//   -> js/backends/supabase.js (development/testomgeving; RLS staat open,
//   dus geen login nodig).
//
// Overschrijven kan ook expliciet via de URL, ongeacht het hostnaam —
// handig om lokaal een van beide paden te forceren:
//   ?backend=mariadb   of   ?backend=supabase

const PRODUCTION_HOSTS = ["hjk.hartvolmuziek.nl"];

function pickBackend() {
  const forced = new URLSearchParams(location.search).get("backend");
  if (forced === "mariadb" || forced === "supabase") return forced;
  return PRODUCTION_HOSTS.includes(location.hostname) ? "mariadb" : "supabase";
}

const backend =
  pickBackend() === "mariadb" ? await import("./backends/mariadb.js") : await import("./backends/supabase.js");

export const {
  PDF_BUCKET,
  AUDIO_BUCKET,
  publicUrlFor,
  listPieces,
  getPiece,
  insertPiece,
  updatePiece,
  deletePiece,
  reorderPieces,
  listPassages,
  listAllPassages,
  insertPassage,
  updatePassage,
  deletePassage,
  listAssets,
  deleteAsset,
  uploadAsset,
  login,
  logout,
  checkSession,
} = backend;
