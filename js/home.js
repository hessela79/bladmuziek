import { listPieces, listAllPassages } from "./apiClient.js";

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

  const a = document.createElement("a");
  a.href = `viewer.html?stuk=${encodeURIComponent(piece.id)}`;
  a.className = "piece-card";
  a.innerHTML = `
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
    for (const p of passages) {
      const counts = p.audio_asset_id ? passageCounts : noteCounts;
      counts.set(p.piece_id, (counts.get(p.piece_id) || 0) + 1);
    }

    grid.innerHTML = "";
    if (pieces.length === 0) {
      grid.innerHTML = `<p class="status">Nog geen stukken toegevoegd.</p>`;
      return;
    }
    for (const piece of pieces) {
      grid.appendChild(
        renderCard({
          ...piece,
          passageCount: passageCounts.get(piece.id) || 0,
          noteCount: noteCounts.get(piece.id) || 0,
        })
      );
    }
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p class="status">Er ging iets mis bij het laden van de stukken.</p>`;
  }
}

main();
