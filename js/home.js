import { listPieces, listAllPassages, logPageView } from "./apiClient.js";
import { getVisitorId } from "./visitorId.js";
import { getSeenMapOrBootstrap } from "./seenPieces.js";

// Bezoek loggen voor de (beheer-only) statistiekenpagina — "fire and
// forget": een mislukte of trage telling mag het laden van de pagina
// zelf nooit ophouden of breken.
logPageView({ path: "index", visitorId: getVisitorId() }).catch(() => {});

// MariaDB geeft "2026-10-02 14:23:11" terug (spatie), Supabase
// "2026-10-02T14:23:11.123+00:00" — new Date(...) parseert de eerste
// vorm niet betrouwbaar in elke browser, dus altijd normaliseren.
function toDate(value) {
  return new Date(String(value).replace(" ", "T"));
}

const VOICE_LABELS = { S: "S", A: "A", T: "T", B: "B" };

const grid = document.getElementById("piece-grid");

function chevronIcon() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`;
}

function passageSummary(passageCount, noteCount) {
  const parts = [];
  if (passageCount > 0) parts.push(`${passageCount} oefenpassage${passageCount === 1 ? "" : "s"}`);
  if (noteCount > 0) parts.push(`${noteCount} opmerking${noteCount === 1 ? "" : "en"}`);
  return parts.length > 0 ? parts.join(", ") : "Nog geen oefenpassages";
}

function renderCard(piece) {
  const chips = piece.voices
    .map((v) => `<div class="voice-chip ${v.toLowerCase()}">${VOICE_LABELS[v] || v}</div>`)
    .join("");
  const soloChip = piece.solo ? `<div class="voice-chip solo">Solo</div>` : "";
  const badgeHtml = piece.badge
    ? `<div class="piece-card-badge ${piece.badge}">${piece.badge === "new" ? "Nieuw" : "Bijgewerkt"}</div>`
    : "";

  const a = document.createElement("a");
  a.href = `viewer.html?stuk=${encodeURIComponent(piece.id)}`;
  a.className = "piece-card";
  a.innerHTML = `
    ${badgeHtml}
    <div class="piece-card-staff"></div>
    <div class="piece-card-body">
      <div>
        <div class="piece-card-title serif">${piece.title}</div>
        <div class="piece-card-meta">${piece.composer || ""} · ${piece.genre || ""}</div>
      </div>
      <div class="voice-chips">${chips}${soloChip}</div>
      <div class="piece-card-footer">
        <span>${passageSummary(piece.passageCount, piece.noteCount)}</span>
        ${chevronIcon()}
      </div>
    </div>
  `;
  return a;
}

async function main() {
  try {
    const [pieces, passages] = await Promise.all([
      listPieces({ visibleOnly: true }),
      listAllPassages(),
    ]);

    const passageCounts = new Map();
    const noteCounts = new Map();
    const latestPassageByPiece = new Map();
    for (const p of passages) {
      const counts = p.audio_asset_id ? passageCounts : noteCounts;
      counts.set(p.piece_id, (counts.get(p.piece_id) || 0) + 1);

      // updated_at i.p.v. created_at: ook een extra vak of ander
      // oefenfragment op een al bestaande passage moet "Bijgewerkt"
      // opleveren, niet alleen een gloednieuwe passage.
      const t = toDate(p.updated_at).getTime();
      if (t > (latestPassageByPiece.get(p.piece_id) || 0)) latestPassageByPiece.set(p.piece_id, t);
    }

    grid.innerHTML = "";
    if (pieces.length === 0) {
      grid.innerHTML = `<p class="status">Nog geen stukken toegevoegd.</p>`;
      return;
    }

    // Eerste keer dat dit op dit apparaat draait: al het huidige
    // repertoire geldt dan als "al gezien" (justBootstrapped), zodat niet
    // opeens alles als nieuw/bijgewerkt oplicht.
    const { map: seenMap, justBootstrapped } = getSeenMapOrBootstrap(pieces.map((p) => p.id));

    for (const piece of pieces) {
      // "Nieuw": dit stuk is nog nooit door deze browser geopend (het
      // bestond nog niet bij de bootstrap, of is sindsdien toegevoegd).
      // "Bijgewerkt": wel al eens geopend, maar het stuk of een van zijn
      // passages is sindsdien gewijzigd. Het label blijft staan over
      // meerdere bezoeken aan dit overzicht — pas het echt openen van het
      // stuk (zie viewer.js) telt als "gezien".
      let badge = null;
      if (!justBootstrapped) {
        const seenAt = seenMap[piece.id] ? toDate(seenMap[piece.id]).getTime() : null;
        if (seenAt === null) {
          badge = "new";
        } else {
          const lastChanged = Math.max(toDate(piece.created_at).getTime(), latestPassageByPiece.get(piece.id) || 0);
          if (lastChanged > seenAt) badge = "updated";
        }
      }

      grid.appendChild(
        renderCard({
          ...piece,
          passageCount: passageCounts.get(piece.id) || 0,
          noteCount: noteCounts.get(piece.id) || 0,
          badge,
        })
      );
    }
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p class="status">Er ging iets mis bij het laden van de stukken.</p>`;
  }
}

main();
