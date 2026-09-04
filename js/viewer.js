import * as pdfjsLib from "./vendor/pdfjs/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "./vendor/pdfjs/pdf.worker.min.mjs",
  import.meta.url
).href;

const PIECES_URL = "data/pieces.json";

const VOICE_LABELS = { S: "S", A: "A", T: "T", B: "B" };

const container = document.getElementById("pdf-container");
const statusEl = document.getElementById("status");
const titleEl = document.getElementById("viewer-title");
const subtitleEl = document.getElementById("viewer-subtitle");
const playerBar = document.getElementById("player-bar");
const playerTitle = document.getElementById("player-title");
const playerDesc = document.getElementById("player-desc");
const playerStop = document.getElementById("player-stop");

const PLAY_ICON = '<svg width="11" height="11" viewBox="0 0 24 24" fill="#fffdf8"><path d="M8 5v14l11-7z"/></svg>';
const STOP_ICON = '<svg width="10" height="10" viewBox="0 0 24 24" fill="#fffdf8"><rect x="5" y="5" width="14" height="14" rx="1.5"/></svg>';

let currentAudio = null;
let currentButton = null;

function stopPlayback() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  if (currentButton) {
    currentButton.classList.remove("playing");
    currentButton.querySelector(".play-icon").innerHTML = PLAY_ICON;
  }
  currentAudio = null;
  currentButton = null;
  playerBar.hidden = true;
}

function playPassage(passage, button) {
  if (currentButton === button) {
    stopPlayback();
    return;
  }
  stopPlayback();

  const audio = new Audio(passage.audio);
  audio.addEventListener("ended", stopPlayback);
  audio.addEventListener("error", () => {
    statusEl.textContent = `Kon audio niet laden: ${passage.audio}`;
    statusEl.hidden = false;
    stopPlayback();
  });

  currentAudio = audio;
  currentButton = button;
  button.classList.add("playing");
  button.querySelector(".play-icon").innerHTML = STOP_ICON;

  playerTitle.textContent = passage.title;
  playerDesc.textContent = passage.description || "";
  playerBar.hidden = false;

  audio.play().catch((err) => {
    console.error("Afspelen mislukt", err);
    statusEl.textContent = "Afspelen mislukt — tik nogmaals op de knop.";
    statusEl.hidden = false;
  });
}

playerStop.addEventListener("click", stopPlayback);

function buildPageWrapper(pageNumber) {
  const wrapper = document.createElement("div");
  wrapper.className = "page-wrapper";
  wrapper.dataset.page = String(pageNumber);

  const canvas = document.createElement("canvas");
  canvas.className = "page-canvas";
  wrapper.appendChild(canvas);

  const overlay = document.createElement("div");
  overlay.className = "page-overlay";
  wrapper.appendChild(overlay);

  return { wrapper, canvas, overlay };
}

function addPassageButton(overlay, passage) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "passage-button";
  button.style.left = `${passage.xPct * 100}%`;
  button.style.top = `${passage.yPct * 100}%`;
  button.style.width = `${passage.widthPct * 100}%`;
  button.style.height = `${passage.heightPct * 100}%`;
  button.setAttribute("aria-label", `Afspelen: ${passage.title}`);
  button.title = passage.title;
  button.innerHTML = `<span class="play-icon">${PLAY_ICON}</span>`;

  button.addEventListener("click", () => playPassage(passage, button));
  overlay.appendChild(button);
}

async function renderPage(pdf, pageNumber, passagesByPage) {
  const page = await pdf.getPage(pageNumber);

  const targetWidth = Math.min(container.clientWidth || 900, 1000);
  const unscaledViewport = page.getViewport({ scale: 1 });
  const scale = targetWidth / unscaledViewport.width;
  const viewport = page.getViewport({ scale });

  const { wrapper, canvas, overlay } = buildPageWrapper(pageNumber);
  container.appendChild(wrapper);

  const dpr = window.devicePixelRatio || 1;
  canvas.width = viewport.width * dpr;
  canvas.height = viewport.height * dpr;
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  wrapper.style.width = `${viewport.width}px`;
  wrapper.style.height = `${viewport.height}px`;

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  await page.render({ canvasContext: ctx, viewport }).promise;

  const passages = passagesByPage.get(pageNumber) || [];
  for (const passage of passages) {
    addPassageButton(overlay, passage);
  }
}

async function main() {
  const params = new URLSearchParams(window.location.search);
  const pieceId = params.get("stuk");

  if (!pieceId) {
    statusEl.textContent = "Geen stuk gekozen — ga terug naar het overzicht.";
    return;
  }

  try {
    const pieces = await fetch(PIECES_URL).then((r) => r.json());
    const piece = pieces.find((p) => p.id === pieceId);

    if (!piece) {
      statusEl.textContent = "Dit stuk is niet gevonden.";
      return;
    }

    document.title = `${piece.title} — Notenmap`;
    titleEl.textContent = piece.title;
    subtitleEl.textContent = `${piece.composer} · ${piece.voices.map((v) => VOICE_LABELS[v] || v).join("")}${piece.solo ? " + solo" : ""}`;

    const [pdf, passages] = await Promise.all([
      pdfjsLib.getDocument(piece.pdf).promise,
      fetch(piece.passagesData).then((r) => r.json()),
    ]);

    const passagesByPage = new Map();
    for (const passage of passages) {
      const list = passagesByPage.get(passage.page) || [];
      list.push(passage);
      passagesByPage.set(passage.page, list);
    }

    statusEl.hidden = true;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      await renderPage(pdf, pageNumber, passagesByPage);
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Er ging iets mis bij het laden van de bladmuziek.";
    statusEl.hidden = false;
  }
}

main();
