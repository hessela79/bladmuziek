import * as pdfjsLib from "./vendor/pdfjs/pdf.min.mjs";
import { supabase, PDF_BUCKET, AUDIO_BUCKET, publicUrlFor } from "./supabaseClient.js";
import { exportStandaloneHtml } from "./export.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "./vendor/pdfjs/pdf.worker.min.mjs",
  import.meta.url
).href;

const VOICE_LABELS = { S: "S", A: "A", T: "T", B: "B" };

const container = document.getElementById("pdf-container");
const statusEl = document.getElementById("status");
const titleEl = document.getElementById("viewer-title");
const subtitleEl = document.getElementById("viewer-subtitle");
const exportBtn = document.getElementById("export-btn");
const exportBtnLabel = document.getElementById("export-btn-label");

const playerBar = document.getElementById("player-bar");
const playerTitle = document.getElementById("player-title");
const playerDesc = document.getElementById("player-desc");
const playerClose = document.getElementById("player-close");
const playerAudioControls = document.getElementById("player-audio-controls");
const playPauseBtn = document.getElementById("player-playpause");
const playPauseIcon = document.getElementById("playpause-icon");
const prevBtn = document.getElementById("player-prev");
const nextBtn = document.getElementById("player-next");
const back5Btn = document.getElementById("player-back5");
const fwd5Btn = document.getElementById("player-fwd5");
const rateButtons = Array.from(document.querySelectorAll(".rate-btn"));

const PLAY_ICON = '<svg width="11" height="11" viewBox="0 0 24 24" fill="#fffdf8"><path d="M8 5v14l11-7z"/></svg>';
const STOP_ICON = '<svg width="10" height="10" viewBox="0 0 24 24" fill="#fffdf8"><rect x="5" y="5" width="14" height="14" rx="1.5"/></svg>';
const NOTE_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fffdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
const ICON_PLAY = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l10-7z"/></svg>';
const ICON_PAUSE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';

let allPassages = [];
let currentIndex = -1;
let currentAudio = null;
let currentRate = 1;
let currentPiece = null;

// ---------- Afspeelbalk ----------

function setPassageButtonState(passage, playing) {
  if (!passage._button || !passage.hasAudio) return;
  passage._button.classList.toggle("playing", playing);
  const icon = passage._button.querySelector(".play-icon");
  if (icon) icon.innerHTML = playing ? STOP_ICON : PLAY_ICON;
}

function updateNavButtons() {
  prevBtn.disabled = currentIndex <= 0;
  nextBtn.disabled = currentIndex < 0 || currentIndex >= allPassages.length - 1;
}

function closeBar() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  if (currentIndex >= 0) setPassageButtonState(allPassages[currentIndex], false);
  currentAudio = null;
  currentIndex = -1;
  playerBar.hidden = true;
}

function openPassage(index) {
  if (index < 0 || index >= allPassages.length) return;

  if (currentIndex >= 0) setPassageButtonState(allPassages[currentIndex], false);
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  const passage = allPassages[index];
  currentIndex = index;

  playerTitle.textContent = passage.title;
  playerDesc.textContent = passage.description || "";
  playerBar.hidden = false;
  updateNavButtons();

  if (passage._button) {
    passage._button.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (passage.hasAudio) {
    playerAudioControls.hidden = false;
    setPassageButtonState(passage, true);

    const audio = new Audio(passage.audioUrl);
    audio.playbackRate = currentRate;
    audio.addEventListener("ended", () => {
      setPassageButtonState(passage, false);
      playPauseIcon.innerHTML = ICON_PLAY;
    });
    audio.addEventListener("error", () => {
      statusEl.textContent = `Kon audio niet laden: ${passage.audioUrl}`;
      statusEl.hidden = false;
      closeBar();
    });
    audio.addEventListener("pause", () => {
      if (!audio.ended) playPauseIcon.innerHTML = ICON_PLAY;
    });
    audio.addEventListener("play", () => {
      playPauseIcon.innerHTML = ICON_PAUSE;
    });

    currentAudio = audio;
    audio.play().catch((err) => {
      console.error("Afspelen mislukt", err);
      statusEl.textContent = "Afspelen mislukt — tik nogmaals op de knop.";
      statusEl.hidden = false;
    });
  } else {
    playerAudioControls.hidden = true;
    currentAudio = null;
  }
}

function togglePassage(index) {
  if (currentIndex === index) {
    closeBar();
  } else {
    openPassage(index);
  }
}

function togglePlayPause() {
  if (!currentAudio) return;
  if (currentAudio.paused) {
    currentAudio.play().catch(() => {});
  } else {
    currentAudio.pause();
  }
}

function seek(deltaSeconds) {
  if (!currentAudio) return;
  const duration = Number.isFinite(currentAudio.duration) ? currentAudio.duration : Infinity;
  currentAudio.currentTime = Math.max(0, Math.min(duration, currentAudio.currentTime + deltaSeconds));
}

function setRate(rate) {
  currentRate = rate;
  if (currentAudio) currentAudio.playbackRate = rate;
  for (const btn of rateButtons) {
    btn.classList.toggle("active", Number(btn.dataset.rate) === rate);
  }
}

playerClose.addEventListener("click", closeBar);
playPauseBtn.addEventListener("click", togglePlayPause);
back5Btn.addEventListener("click", () => seek(-5));
fwd5Btn.addEventListener("click", () => seek(5));
prevBtn.addEventListener("click", () => openPassage(currentIndex - 1));
nextBtn.addEventListener("click", () => openPassage(currentIndex + 1));
for (const btn of rateButtons) {
  btn.addEventListener("click", () => setRate(Number(btn.dataset.rate)));
}

// ---------- PDF-weergave ----------

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

function addPassageButton(overlay, passage, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "passage-button color-" + (passage.color || "goud") + (passage.hasAudio ? "" : " note-only");
  button.style.left = `${passage.x_pct * 100}%`;
  button.style.top = `${passage.y_pct * 100}%`;
  button.style.width = `${passage.width_pct * 100}%`;
  button.style.height = `${passage.height_pct * 100}%`;
  button.setAttribute("aria-label", passage.hasAudio ? `Afspelen: ${passage.title}` : `Opmerking: ${passage.title}`);
  button.title = passage.title;
  button.innerHTML = `<span class="play-icon">${passage.hasAudio ? PLAY_ICON : NOTE_ICON}</span>`;

  passage._button = button;
  button.addEventListener("click", () => togglePassage(index));
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

  const entries = passagesByPage.get(pageNumber) || [];
  for (const { passage, index } of entries) {
    addPassageButton(overlay, passage, index);
  }
}

// ---------- Export ----------

exportBtn.addEventListener("click", async () => {
  exportBtn.disabled = true;
  exportBtnLabel.textContent = "Bezig met exporteren…";
  try {
    await exportStandaloneHtml(currentPiece, allPassages, container);
  } catch (err) {
    console.error(err);
    alert("Exporteren is mislukt: " + err.message);
  } finally {
    exportBtn.disabled = false;
    exportBtnLabel.textContent = "Exporteren";
  }
});

// ---------- Init ----------

async function main() {
  const params = new URLSearchParams(window.location.search);
  const pieceId = params.get("stuk");

  if (!pieceId) {
    statusEl.textContent = "Geen stuk gekozen — ga terug naar het overzicht.";
    return;
  }

  try {
    const { data: piece, error: pieceError } = await supabase
      .from("pieces")
      .select("*, pdf_asset:assets(storage_path)")
      .eq("id", pieceId)
      .maybeSingle();

    if (pieceError) throw pieceError;
    if (!piece) {
      statusEl.textContent = "Dit stuk is niet gevonden.";
      return;
    }

    currentPiece = piece;
    document.title = `${piece.title} — Notenmap`;
    titleEl.textContent = piece.title;
    subtitleEl.textContent = `${piece.composer || ""} · ${piece.voices.map((v) => VOICE_LABELS[v] || v).join("")}${piece.solo ? " + solo" : ""}`;

    const { data: passages, error: passagesError } = await supabase
      .from("passages")
      .select("*, audio_asset:assets(storage_path)")
      .eq("piece_id", pieceId)
      .order("sort_order", { ascending: true });

    if (passagesError) throw passagesError;

    allPassages = passages.map((p) => ({
      ...p,
      hasAudio: !!p.audio_asset,
      audioUrl: p.audio_asset ? publicUrlFor(AUDIO_BUCKET, p.audio_asset.storage_path) : null,
      _button: null,
    }));

    const pdfUrl = publicUrlFor(PDF_BUCKET, piece.pdf_asset.storage_path);
    const pdf = await pdfjsLib.getDocument(pdfUrl).promise;

    const passagesByPage = new Map();
    allPassages.forEach((passage, index) => {
      const list = passagesByPage.get(passage.page) || [];
      list.push({ passage, index });
      passagesByPage.set(passage.page, list);
    });

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
