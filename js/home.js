const PIECES_URL = "data/pieces.json";

const VOICE_LABELS = { S: "S", A: "A", T: "T", B: "B" };

const grid = document.getElementById("piece-grid");

function chevronIcon() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`;
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
        <div class="piece-card-meta">${piece.composer} · ${piece.genre}</div>
      </div>
      <div class="voice-chips">${chips}${soloChip}</div>
      <div class="piece-card-footer">
        <span>${piece.passageCount} oefenpassage${piece.passageCount === 1 ? "" : "s"}</span>
        ${chevronIcon()}
      </div>
    </div>
  `;
  return a;
}

async function main() {
  try {
    const pieces = await fetch(PIECES_URL).then((r) => r.json());
    grid.innerHTML = "";
    for (const piece of pieces) {
      grid.appendChild(renderCard(piece));
    }
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p class="status">Er ging iets mis bij het laden van de stukken.</p>`;
  }
}

main();
