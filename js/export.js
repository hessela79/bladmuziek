// Bouwt één op zichzelf staand HTML-bestand voor een stuk: de bladmuziek
// als afbeeldingen + de oefenfragmenten, allemaal ingebed (base64), zodat
// het bestand ook zonder internet werkt — handig om bijvoorbeeld op
// Google Drive te zetten en van daaruit te openen.

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function buildDocument(piece, pages, passages) {
  const voiceLabel = (piece.voices || []).join("");
  const subtitle = [piece.composer, voiceLabel && `stem${voiceLabel.length > 1 ? "men" : ""} ${voiceLabel}`]
    .filter(Boolean)
    .join(" · ");

  const pagesHtml = pages
    .map(
      (page, pageIndex) => `
    <div class="page-wrapper" style="width:${page.width}px;max-width:100%;">
      <img src="${page.dataUrl}" alt="Pagina ${pageIndex + 1}" style="display:block;width:100%;height:auto;" />
      <div class="page-overlay">
        ${passages
          .filter((p) => p.page === pageIndex + 1)
          .map(
            (p) => `
        <button type="button" class="passage-button${p.hasAudio ? "" : " note-only"}" data-index="${p.exportIndex}"
          style="left:${p.x_pct * 100}%;top:${p.y_pct * 100}%;width:${p.width_pct * 100}%;height:${p.height_pct * 100}%;">
          <span class="play-icon">${p.hasAudio ? PLAY_ICON_SVG : NOTE_ICON_SVG}</span>
        </button>`
          )
          .join("")}
      </div>
    </div>`
    )
    .join("\n");

  const passagesData = passages.map((p) => ({
    title: p.title,
    description: p.description || "",
    hasAudio: p.hasAudio,
    audioDataUri: p.audioDataUri || null,
  }));

  // Voorkomt dat een "</script>" in tekst (titel/beschrijving) het
  // script-blok voortijdig afsluit.
  const passagesJson = JSON.stringify(passagesData).replace(/<\//g, "<\\/");

  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(piece.title)} — Notenmap (export)</title>
<style>
${EXPORT_CSS}
</style>
</head>
<body>
  <header class="header">
    <div class="title">${escapeHtml(piece.title)}</div>
    <div class="subtitle">${escapeHtml(subtitle)}</div>
    <p class="hint">Geëxporteerd uit Notenmap — werkt offline, ook rechtstreeks vanaf Google Drive of een andere schijf.</p>
  </header>
  <main class="pdf-container">
${pagesHtml}
  </main>
  <div id="player-bar" class="player-bar" hidden>
    <div class="player-row">
      <div class="player-info">
        <div id="player-title" class="player-title">—</div>
        <div id="player-desc" class="player-desc"></div>
      </div>
      <button id="player-close" class="player-close" aria-label="Sluiten">✕</button>
    </div>
    <div id="player-controls" class="player-controls">
      <button id="player-playpause" class="player-btn player-btn-main" aria-label="Afspelen of pauzeren">
        <span id="playpause-icon">${PLAY_ICON_BIG_SVG}</span>
      </button>
    </div>
  </div>
  <script>
  (function () {
    var PASSAGES = ${passagesJson};
    var playerBar = document.getElementById("player-bar");
    var playerTitle = document.getElementById("player-title");
    var playerDesc = document.getElementById("player-desc");
    var playerClose = document.getElementById("player-close");
    var playerControls = document.getElementById("player-controls");
    var playPauseBtn = document.getElementById("player-playpause");
    var playPauseIcon = document.getElementById("playpause-icon");
    var buttons = Array.prototype.slice.call(document.querySelectorAll(".passage-button"));
    var currentAudio = null;
    var currentIndex = -1;

    function setPlaying(btn, playing) {
      if (!btn) return;
      btn.classList.toggle("playing", playing);
    }

    function closeBar() {
      if (currentAudio) { currentAudio.pause(); }
      if (currentIndex >= 0) setPlaying(buttons[currentIndex], false);
      currentAudio = null;
      currentIndex = -1;
      playerBar.hidden = true;
    }

    function openPassage(index) {
      if (currentIndex >= 0) setPlaying(buttons[currentIndex], false);
      if (currentAudio) currentAudio.pause();
      var passage = PASSAGES[index];
      currentIndex = index;
      playerTitle.textContent = passage.title;
      playerDesc.textContent = passage.description || "";
      playerBar.hidden = false;
      if (passage.hasAudio) {
        playerControls.hidden = false;
        setPlaying(buttons[index], true);
        currentAudio = new Audio(passage.audioDataUri);
        currentAudio.addEventListener("ended", function () {
          setPlaying(buttons[index], false);
          playPauseIcon.innerHTML = ${JSON.stringify(PLAY_ICON_BIG_SVG)};
        });
        currentAudio.addEventListener("play", function () {
          playPauseIcon.innerHTML = ${JSON.stringify(PAUSE_ICON_BIG_SVG)};
        });
        currentAudio.addEventListener("pause", function () {
          if (!currentAudio.ended) playPauseIcon.innerHTML = ${JSON.stringify(PLAY_ICON_BIG_SVG)};
        });
        currentAudio.play().catch(function () {});
      } else {
        playerControls.hidden = true;
        currentAudio = null;
      }
    }

    buttons.forEach(function (btn, index) {
      btn.addEventListener("click", function () {
        if (currentIndex === index) { closeBar(); } else { openPassage(index); }
      });
    });
    playerClose.addEventListener("click", closeBar);
    playPauseBtn.addEventListener("click", function () {
      if (!currentAudio) return;
      if (currentAudio.paused) currentAudio.play().catch(function () {}); else currentAudio.pause();
    });
  })();
  </script>
</body>
</html>
`;
}

const PLAY_ICON_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="#fffdf8"><path d="M8 5v14l11-7z"/></svg>';
const NOTE_ICON_SVG =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fffdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
const PLAY_ICON_BIG_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE_ICON_BIG_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';

const EXPORT_CSS = `
  :root {
    --parchment: #f7efe0; --paper: #fffcf5; --wood-900: #2b1c12;
    --ink: #2b2013; --ink-muted: #7a6650; --gold: #b9822f;
    --line: rgba(43,32,19,0.18); --overlay: rgba(185,130,47,0.16);
    --overlay-playing: rgba(185,130,47,0.34);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--parchment); color: var(--ink);
    font-family: -apple-system, "Segoe UI", Arial, sans-serif;
    padding-bottom: 100px;
  }
  .header { padding: 24px clamp(16px,4vw,48px) 8px; }
  .title { font-size: 1.4rem; font-weight: 700; }
  .subtitle { font-size: 0.9rem; color: var(--ink-muted); margin-top: 4px; }
  .hint { font-size: 0.78rem; color: var(--ink-muted); margin-top: 10px; }
  .pdf-container {
    display: flex; flex-direction: column; align-items: center; gap: 20px;
    padding: 16px clamp(16px,4vw,48px) 24px;
  }
  .page-wrapper {
    position: relative; background: var(--paper); border-radius: 14px;
    box-shadow: 0 10px 28px rgba(43,32,19,0.14); overflow: hidden;
  }
  .page-overlay { position: absolute; inset: 0; }
  .passage-button {
    position: absolute; background: var(--overlay); border: 1.5px solid transparent;
    border-radius: 8px; cursor: pointer; display: flex; align-items: flex-start;
    justify-content: flex-end; padding: 6px;
  }
  .passage-button.playing { background: var(--overlay-playing); border-color: var(--gold); }
  .play-icon {
    width: 28px; height: 28px; border-radius: 50%; background: var(--gold);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .passage-button.note-only .play-icon { background: var(--ink-muted); }
  .passage-button.playing .play-icon { background: #b3432f; }
  .player-bar[hidden] { display: none; }
  .player-bar {
    position: fixed; left: 0; right: 0; bottom: 0; background: var(--wood-900);
    color: #f7efe0; padding: 12px clamp(16px,4vw,32px) 14px; display: flex;
    flex-direction: column; gap: 8px; box-shadow: 0 -6px 20px rgba(0,0,0,0.25);
  }
  .player-row { display: flex; align-items: center; gap: 14px; }
  .player-info { min-width: 0; flex: 1; }
  .player-title { font-weight: 700; font-size: 0.95rem; }
  .player-desc { font-size: 0.78rem; color: #cbb99a; margin-top: 1px; }
  .player-close {
    width: 30px; height: 30px; border-radius: 50%; background: transparent;
    border: 1.5px solid rgba(247,239,224,0.3); color: #f7efe0; cursor: pointer;
    flex-shrink: 0;
  }
  .player-controls[hidden] { display: none; }
  .player-btn-main {
    width: 42px; height: 42px; border-radius: 50%; background: var(--gold);
    color: var(--wood-900); border: none; display: flex; align-items: center;
    justify-content: center; cursor: pointer;
  }
`;

async function renderPagesFromDom(pdfContainer) {
  const wrappers = Array.from(pdfContainer.querySelectorAll(".page-wrapper"));
  return wrappers.map((wrapper) => {
    const canvas = wrapper.querySelector("canvas");
    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.85),
      width: parseInt(wrapper.style.width, 10) || canvas.width,
    };
  });
}

export async function exportStandaloneHtml(piece, allPassages, pdfContainer) {
  const pages = await renderPagesFromDom(pdfContainer);

  const passages = [];
  let exportIndex = 0;
  for (const p of allPassages) {
    let audioDataUri = null;
    if (p.hasAudio) {
      const res = await fetch(p.audioUrl);
      if (!res.ok) throw new Error(`Kon fragment "${p.title}" niet ophalen`);
      const blob = await res.blob();
      audioDataUri = await blobToDataUrl(blob);
    }
    passages.push({
      title: p.title,
      description: p.description,
      page: p.page,
      x_pct: p.x_pct,
      y_pct: p.y_pct,
      width_pct: p.width_pct,
      height_pct: p.height_pct,
      hasAudio: p.hasAudio,
      audioDataUri,
      exportIndex: exportIndex++,
    });
  }

  const html = buildDocument(piece, pages, passages);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `notenmap-${slugify(piece.title)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
