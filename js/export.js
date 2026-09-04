// Bouwt één op zichzelf staand HTML-bestand voor een stuk: de bladmuziek
// als afbeeldingen + de oefenfragmenten, allemaal ingebed (base64), zodat
// het bestand ook zonder internet werkt — handig om bijvoorbeeld op
// Google Drive te zetten en van daaruit te openen. De afspeelbalk heeft
// dezelfde bediening als de live viewer: vorige/volgende passage, 5 sec
// terug/vooruit, play/pause en afspeelsnelheid.

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
    <button id="player-close" class="player-close" aria-label="Sluiten">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>

    <div class="player-info">
      <div id="player-title" class="player-title">—</div>
      <div id="player-desc" class="player-desc"></div>
    </div>

    <div class="player-nav-row">
      <button id="player-prev" class="player-edge-btn" aria-label="Vorige passage" title="Vorige passage">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zM20 6l-9 6 9 6z"/></svg>
      </button>

      <div id="player-audio-controls" class="player-audio-controls">
        <button id="player-back5" class="player-btn" aria-label="5 seconden terug" title="5 sec terug">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>
          <span>5s</span>
        </button>
        <button id="player-playpause" class="player-btn player-btn-main" aria-label="Afspelen of pauzeren">
          <span id="playpause-icon">${PLAY_ICON_BIG_SVG}</span>
        </button>
        <button id="player-fwd5" class="player-btn" aria-label="5 seconden vooruit" title="5 sec vooruit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>
          <span>5s</span>
        </button>
        <div class="player-rates" role="group" aria-label="Afspeelsnelheid">
          <button class="rate-btn" data-rate="0.5">0.5x</button>
          <button class="rate-btn active" data-rate="1">1x</button>
          <button class="rate-btn" data-rate="1.5">1.5x</button>
        </div>
      </div>

      <button id="player-next" class="player-edge-btn" aria-label="Volgende passage" title="Volgende passage">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM4 6l9 6-9 6z"/></svg>
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
    var playerAudioControls = document.getElementById("player-audio-controls");
    var playPauseBtn = document.getElementById("player-playpause");
    var playPauseIcon = document.getElementById("playpause-icon");
    var prevBtn = document.getElementById("player-prev");
    var nextBtn = document.getElementById("player-next");
    var back5Btn = document.getElementById("player-back5");
    var fwd5Btn = document.getElementById("player-fwd5");
    var rateButtons = Array.prototype.slice.call(document.querySelectorAll(".rate-btn"));
    var buttons = Array.prototype.slice.call(document.querySelectorAll(".passage-button"));
    var currentAudio = null;
    var currentIndex = -1;
    var currentRate = 1;
    var ICON_PLAY = ${JSON.stringify(PLAY_ICON_BIG_SVG)};
    var ICON_PAUSE = ${JSON.stringify(PAUSE_ICON_BIG_SVG)};

    function setPlaying(btn, playing) {
      if (!btn) return;
      btn.classList.toggle("playing", playing);
    }

    function updateNavButtons() {
      prevBtn.disabled = currentIndex <= 0;
      nextBtn.disabled = currentIndex < 0 || currentIndex >= PASSAGES.length - 1;
    }

    function closeBar() {
      if (currentAudio) { currentAudio.pause(); }
      if (currentIndex >= 0) setPlaying(buttons[currentIndex], false);
      currentAudio = null;
      currentIndex = -1;
      playerBar.hidden = true;
    }

    function openPassage(index) {
      if (index < 0 || index >= PASSAGES.length) return;
      if (currentIndex >= 0) setPlaying(buttons[currentIndex], false);
      if (currentAudio) { currentAudio.pause(); currentAudio = null; }

      var passage = PASSAGES[index];
      currentIndex = index;
      playerTitle.textContent = passage.title;
      playerDesc.textContent = passage.description || "";
      playerBar.hidden = false;
      updateNavButtons();

      if (buttons[index] && buttons[index].scrollIntoView) {
        buttons[index].scrollIntoView({ behavior: "smooth", block: "center" });
      }

      if (passage.hasAudio) {
        playerAudioControls.hidden = false;
        setPlaying(buttons[index], true);
        var audio = new Audio(passage.audioDataUri);
        audio.playbackRate = currentRate;
        audio.addEventListener("ended", function () {
          setPlaying(buttons[index], false);
          playPauseIcon.innerHTML = ICON_PLAY;
        });
        audio.addEventListener("play", function () {
          playPauseIcon.innerHTML = ICON_PAUSE;
        });
        audio.addEventListener("pause", function () {
          if (!audio.ended) playPauseIcon.innerHTML = ICON_PLAY;
        });
        currentAudio = audio;
        audio.play().catch(function () {});
      } else {
        playerAudioControls.hidden = true;
        currentAudio = null;
      }
    }

    function togglePassage(index) {
      if (currentIndex === index) { closeBar(); } else { openPassage(index); }
    }

    function seek(delta) {
      if (!currentAudio) return;
      var duration = isFinite(currentAudio.duration) ? currentAudio.duration : Infinity;
      currentAudio.currentTime = Math.max(0, Math.min(duration, currentAudio.currentTime + delta));
    }

    function setRate(rate) {
      currentRate = rate;
      if (currentAudio) currentAudio.playbackRate = rate;
      rateButtons.forEach(function (btn) {
        btn.classList.toggle("active", Number(btn.dataset.rate) === rate);
      });
    }

    buttons.forEach(function (btn, index) {
      btn.addEventListener("click", function () { togglePassage(index); });
    });
    playerClose.addEventListener("click", closeBar);
    playPauseBtn.addEventListener("click", function () {
      if (!currentAudio) return;
      if (currentAudio.paused) currentAudio.play().catch(function () {}); else currentAudio.pause();
    });
    back5Btn.addEventListener("click", function () { seek(-5); });
    fwd5Btn.addEventListener("click", function () { seek(5); });
    prevBtn.addEventListener("click", function () { openPassage(currentIndex - 1); });
    nextBtn.addEventListener("click", function () { openPassage(currentIndex + 1); });
    rateButtons.forEach(function (btn) {
      btn.addEventListener("click", function () { setRate(Number(btn.dataset.rate)); });
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
const PLAY_ICON_BIG_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l10-7z"/></svg>';
const PAUSE_ICON_BIG_SVG =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';

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
    padding-bottom: 120px;
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
    color: #fffdf8; padding: 12px clamp(16px,4vw,32px) 14px; display: flex;
    flex-direction: column; align-items: center; gap: 8px; box-shadow: 0 -6px 20px rgba(0,0,0,0.25);
  }
  .player-close {
    position: absolute; top: 8px; right: 10px; width: 28px; height: 28px;
    border-radius: 50%; background: transparent; border: 1.5px solid rgba(247,239,224,0.3);
    color: #f7efe0; cursor: pointer; display: flex; align-items: center; justify-content: center;
  }
  .player-close:hover { border-color: var(--gold); color: var(--gold); }
  .player-nav-row {
    width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .player-edge-btn {
    flex-shrink: 0; width: 44px; height: 44px; border-radius: 50%;
    background: rgba(247,239,224,0.16); border: 1.5px solid rgba(247,239,224,0.3);
    color: #fffdf8; display: flex; align-items: center; justify-content: center; cursor: pointer;
  }
  .player-edge-btn:hover { background: rgba(247,239,224,0.3); border-color: rgba(247,239,224,0.5); }
  .player-edge-btn:disabled { opacity: 0.3; cursor: default; }
  .player-info { min-width: 0; width: 100%; text-align: center; padding: 0 40px; }
  .player-title {
    font-weight: 700; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .player-desc {
    font-size: 0.78rem; color: #cbb99a; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .player-audio-controls[hidden] { display: none; }
  .player-audio-controls {
    flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;
  }
  .player-btn {
    flex-shrink: 0; height: 38px; min-width: 38px; padding: 0 12px; border-radius: 999px;
    background: rgba(247,239,224,0.16); border: 1.5px solid rgba(247,239,224,0.3); color: #fffdf8;
    display: flex; align-items: center; justify-content: center; gap: 4px; cursor: pointer;
    font-size: 0.8rem; font-weight: 700;
  }
  .player-btn:hover { background: rgba(247,239,224,0.3); border-color: rgba(247,239,224,0.5); }
  .player-btn svg { display: block; flex-shrink: 0; }
  .player-btn-main {
    width: 46px; height: 46px; min-width: 46px; background: var(--gold);
    border-color: var(--gold); color: var(--wood-900);
  }
  .player-btn-main:hover { background: #d6a545; border-color: #d6a545; }
  .player-rates {
    display: flex; gap: 4px; background: rgba(247,239,224,0.14);
    border: 1.5px solid rgba(247,239,224,0.25); border-radius: 999px; padding: 3px;
  }
  .rate-btn {
    border: none; background: transparent; color: #f0e2c8; font-size: 0.72rem;
    font-weight: 700; padding: 6px 10px; border-radius: 999px; cursor: pointer;
  }
  .rate-btn.active { background: var(--gold); color: var(--wood-900); }
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
