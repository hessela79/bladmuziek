import * as pdfjsLib from "./vendor/pdfjs/pdf.min.mjs";
import {
  PDF_BUCKET,
  AUDIO_BUCKET,
  publicUrlFor,
  listAssets,
  listPieces,
  listAllPassages,
  listPassages,
  insertPiece,
  updatePiece,
  deletePiece as apiDeletePiece,
  reorderPieces as apiReorderPieces,
  insertPassage,
  updatePassage,
  deletePassage as apiDeletePassage,
  deleteAsset as apiDeleteAsset,
  uploadAsset,
  login,
  logout,
  checkSession,
} from "./apiClient.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "./vendor/pdfjs/pdf.worker.min.mjs",
  import.meta.url
).href;

// ---------- DOM ----------

const loginView = document.getElementById("login-view");
const loginForm = document.getElementById("login-form");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");

const listView = document.getElementById("list-view");
const editorView = document.getElementById("editor-view");
const pieceListEl = document.getElementById("piece-list");
const newPieceBtn = document.getElementById("new-piece-btn");

const toggleLibraryBtn = document.getElementById("toggle-library-btn");
const assetLibraryEl = document.getElementById("asset-library");

const editorHeading = document.getElementById("editor-heading");
const editorStatus = document.getElementById("editor-status");
const cancelBtn = document.getElementById("cancel-btn");
const saveBtn = document.getElementById("save-btn");

const fTitle = document.getElementById("f-title");
const fComposer = document.getElementById("f-composer");
const fGenre = document.getElementById("f-genre");
const fVoices = Array.from(document.querySelectorAll(".f-voice"));
const fSolo = document.getElementById("f-solo");
const fVisible = document.getElementById("f-visible");
const fPdfSelect = document.getElementById("f-pdf-select");
const fPdfUpload = document.getElementById("f-pdf-upload");

const pdfNav = document.getElementById("pdf-nav");
const pdfPrev = document.getElementById("pdf-prev");
const pdfNext = document.getElementById("pdf-next");
const pdfPageIndicator = document.getElementById("pdf-page-indicator");
const pdfContainer = document.getElementById("admin-pdf-container");
const addPassageBtn = document.getElementById("add-passage-btn");
const drawHint = document.getElementById("draw-hint");
const drawMoreBanner = document.getElementById("draw-more-banner");
const drawMoreCancelBtn = document.getElementById("draw-more-cancel");

const passageListEl = document.getElementById("passage-list");

const passageModal = document.getElementById("passage-modal");
const passageModalTitle = document.getElementById("passage-modal-title");
const pfTitle = document.getElementById("pf-title");
const pfDescription = document.getElementById("pf-description");
const pfNoAudio = document.getElementById("pf-no-audio");
const pfAudioField = document.getElementById("pf-audio-field");
const pfAudioSelect = document.getElementById("pf-audio-select");
const pfAudioUpload = document.getElementById("pf-audio-upload");
const pfDelete = document.getElementById("pf-delete");
const pfCancel = document.getElementById("pf-cancel");
const pfSave = document.getElementById("pf-save");
const pfRectsList = document.getElementById("pf-rects-list");
const pfAddRectBtn = document.getElementById("pf-add-rect-btn");
const pfColorSwatches = Array.from(document.querySelectorAll("#pf-color-swatches .color-swatch"));

const PASSAGE_COLORS = ["geel", "groen", "rood", "blauw", "bruin", "goud"];
const DEFAULT_PASSAGE_COLOR = "goud";
let selectedColor = DEFAULT_PASSAGE_COLOR;

function setSelectedColor(color) {
  selectedColor = PASSAGE_COLORS.includes(color) ? color : DEFAULT_PASSAGE_COLOR;
  for (const swatch of pfColorSwatches) {
    swatch.classList.toggle("selected", swatch.dataset.color === selectedColor);
  }
}

for (const swatch of pfColorSwatches) {
  swatch.addEventListener("click", () => setSelectedColor(swatch.dataset.color));
}

// ---------- State ----------

let pieces = [];
let pdfAssets = [];
let audioAssets = [];

const state = {
  pieceId: null,
  isNew: true,
  pdfDoc: null,
  currentPage: 1,
  pdfAssetId: null,
  pdfFile: null,
  passages: [], // {_key, id, title, description, audioAssetId, audioFile, color, sortOrder, deleted, rects}
  // rects: [{page, xPct, yPct, widthPct, heightPct}, ...] — een passage kan
  // over meerdere vakken (regels/pagina's) verdeeld zijn.
};

let drawModeOn = false;
let activePassageKey = null; // passage die in de modal bewerkt wordt; null = nieuwe passage
// De vakken van de passage die momenteel in de modal open staat (of net
// getekend wordt) — een werkkopie die pas bij "Bewaren" naar state.passages
// geschreven wordt, zodat "Annuleren" niets van al getekende vakken bewaart.
let draftRects = null;
// Voorkomt dat het opnieuw tonen van de modal (na het tekenen van een extra
// vak) de al ingevulde titel/beschrijving/kleur overschrijft.
let draftFieldsInitialized = false;

function newKey() {
  return crypto.randomUUID();
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------- Data loading ----------

async function loadAssets() {
  const data = await listAssets();
  pdfAssets = data.filter((a) => a.type === "pdf");
  audioAssets = data.filter((a) => a.type === "audio");

  fPdfSelect.innerHTML =
    `<option value="">— kies uit bibliotheek —</option>` +
    pdfAssets.map((a) => `<option value="${a.id}">${a.filename}</option>`).join("");

  await buildGroupedAudioSelect();
}

// Groepeert de mp3-keuzelijst per stuk (net als de mappen in de
// bibliotheek hieronder), zodat je niet door één lange platte lijst
// hoeft te zoeken.
async function buildGroupedAudioSelect() {
  const allPieces = await listPieces();
  const allPassages = await listAllPassages();

  const pieceTitleById = new Map(allPieces.map((p) => [p.id, p.title]));
  const audioToPieceTitle = new Map();
  for (const row of allPassages) {
    if (row.audio_asset_id && !audioToPieceTitle.has(row.audio_asset_id)) {
      audioToPieceTitle.set(row.audio_asset_id, pieceTitleById.get(row.piece_id) || null);
    }
  }

  const groups = new Map();
  const unused = [];
  for (const asset of audioAssets) {
    const title = audioToPieceTitle.get(asset.id);
    if (title) {
      if (!groups.has(title)) groups.set(title, []);
      groups.get(title).push(asset);
    } else {
      unused.push(asset);
    }
  }

  let html = `<option value="">— kies uit bibliotheek —</option>`;
  for (const [title, assets] of groups) {
    html += `<optgroup label="${title}">` + assets.map((a) => `<option value="${a.id}">${a.filename}</option>`).join("") + `</optgroup>`;
  }
  if (unused.length > 0) {
    html += `<optgroup label="Ongebruikt">` + unused.map((a) => `<option value="${a.id}">${a.filename}</option>`).join("") + `</optgroup>`;
  }
  pfAudioSelect.innerHTML = html;
}

async function loadPieces() {
  pieces = await listPieces();
}

async function passageCountsByPiece() {
  const data = await listAllPassages();
  const counts = new Map();
  for (const row of data) counts.set(row.piece_id, (counts.get(row.piece_id) || 0) + 1);
  return counts;
}

// ---------- List view ----------

let lastCounts = new Map();
let draggedPieceId = null;

function renderPieceList(counts) {
  lastCounts = counts;
  if (pieces.length === 0) {
    pieceListEl.innerHTML = `<p class="status">Nog geen stukken toegevoegd.</p>`;
    return;
  }
  pieceListEl.innerHTML = "";
  for (const piece of pieces) {
    const row = document.createElement("div");
    row.className = "admin-piece-row" + (piece.visible === false ? " hidden-piece" : "");
    row.draggable = true;
    const isVisible = piece.visible !== false;
    row.innerHTML = `
      <div class="drag-handle" title="Sleep om de volgorde te wijzigen">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
      </div>
      <div class="piece-swatch"></div>
      <div style="flex:1;min-width:0;">
        <div class="admin-piece-row-title serif">${piece.title}</div>
        <div class="admin-piece-row-meta">${piece.composer || ""} · ${piece.genre || ""} · ${counts.get(piece.id) || 0} passage(s)</div>
      </div>
      <div class="admin-piece-row-actions">
        <label class="visibility-toggle" title="Zichtbaar in het overzicht voor gebruikers">
          <span class="visibility-toggle-label">${isVisible ? "Zichtbaar" : "Verborgen"}</span>
          <span class="switch">
            <input type="checkbox" class="visibility-checkbox" ${isVisible ? "checked" : ""} />
            <span class="switch-track"></span>
          </span>
        </label>
        <button class="icon-btn" data-action="edit" title="Bewerken" aria-label="Bewerken">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button class="icon-btn danger" data-action="delete" title="Verwijderen" aria-label="Verwijderen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
        </button>
      </div>
    `;
    row.querySelector('[data-action="edit"]').addEventListener("click", () => openEditor(piece));
    row.querySelector('[data-action="delete"]').addEventListener("click", () => deletePiece(piece));
    const visibilityLabel = row.querySelector(".visibility-toggle-label");
    row.querySelector(".visibility-checkbox").addEventListener("change", async (e) => {
      const newVisible = e.target.checked;
      const previous = piece.visible !== false;
      piece.visible = newVisible;
      row.classList.toggle("hidden-piece", !newVisible);
      visibilityLabel.textContent = newVisible ? "Zichtbaar" : "Verborgen";
      try {
        await updatePiece(piece.id, { visible: newVisible });
      } catch (err) {
        alert("Zichtbaarheid aanpassen mislukt: " + err.message);
        piece.visible = previous;
        e.target.checked = previous;
        row.classList.toggle("hidden-piece", !previous);
        visibilityLabel.textContent = previous ? "Zichtbaar" : "Verborgen";
      }
    });

    row.addEventListener("dragstart", (e) => {
      draggedPieceId = piece.id;
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragend", () => {
      draggedPieceId = null;
      pieceListEl.querySelectorAll(".admin-piece-row").forEach((r) => r.classList.remove("dragging", "drag-over"));
    });
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (draggedPieceId && draggedPieceId !== piece.id) row.classList.add("drag-over");
    });
    row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      row.classList.remove("drag-over");
      if (!draggedPieceId || draggedPieceId === piece.id) return;
      reorderPieces(draggedPieceId, piece.id);
    });

    pieceListEl.appendChild(row);
  }
}

async function reorderPieces(draggedId, targetId) {
  const fromIndex = pieces.findIndex((p) => p.id === draggedId);
  const toIndex = pieces.findIndex((p) => p.id === targetId);
  if (fromIndex === -1 || toIndex === -1) return;
  const [moved] = pieces.splice(fromIndex, 1);
  pieces.splice(toIndex, 0, moved);
  renderPieceList(lastCounts);
  await persistPieceOrder();
}

async function persistPieceOrder() {
  await apiReorderPieces(pieces.map((piece) => piece.id));
}

async function refreshList() {
  pieceListEl.innerHTML = `<p class="status">Stukken worden geladen…</p>`;
  await loadPieces();
  const counts = await passageCountsByPiece();
  renderPieceList(counts);
}

async function deletePiece(piece) {
  if (!confirm(`"${piece.title}" verwijderen? De PDF en oefenfragmenten blijven in de bibliotheek staan.`)) return;
  try {
    await apiDeletePiece(piece.id);
  } catch (err) {
    alert("Verwijderen mislukt: " + err.message);
    return;
  }
  await refreshList();
}

// ---------- Asset library panel ----------

let libraryVisible = false;

function fileKindLabel(asset) {
  if (asset.type === "pdf") return "PDF";
  const ext = asset.filename.split(".").pop().toLowerCase();
  return ext || "audio";
}

function assetRowHtml(asset, useLabel) {
  return `
    <div class="asset-row">
      <div>
        <strong>${asset.filename}</strong>
        <div class="asset-row-meta">${fileKindLabel(asset)}${useLabel ? " · " + useLabel : ""}</div>
      </div>
      <button class="btn btn-danger btn-small" data-asset-id="${asset.id}">Verwijderen</button>
    </div>
  `;
}

function folderHtml(name, innerHtml, openByDefault) {
  return `
    <details class="asset-folder"${openByDefault ? " open" : ""}>
      <summary>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>
        ${name}
      </summary>
      <div class="asset-folder-body">${innerHtml}</div>
    </details>
  `;
}

async function renderAssetLibrary() {
  const allPieces = await listPieces();
  const allPassages = await listAllPassages();

  const assetsById = new Map([...pdfAssets, ...audioAssets].map((a) => [a.id, a]));
  const usedAssetIds = new Set();
  let html = "";

  for (const piece of allPieces) {
    const files = [];
    if (piece.pdf_asset_id && assetsById.has(piece.pdf_asset_id)) {
      usedAssetIds.add(piece.pdf_asset_id);
      files.push(assetRowHtml(assetsById.get(piece.pdf_asset_id), "bladmuziek"));
    }
    for (const passage of allPassages.filter((p) => p.piece_id === piece.id)) {
      if (passage.audio_asset_id && assetsById.has(passage.audio_asset_id)) {
        usedAssetIds.add(passage.audio_asset_id);
        files.push(assetRowHtml(assetsById.get(passage.audio_asset_id), "oefenfragment"));
      }
    }
    html += folderHtml(
      piece.title,
      files.length ? files.join("") : `<p class="status">Geen bestanden.</p>`,
      false
    );
  }

  const unused = [...assetsById.values()].filter((a) => !usedAssetIds.has(a.id));
  if (unused.length > 0) {
    html += folderHtml(
      "Ongebruikt",
      unused.map((a) => assetRowHtml(a, "niet gekoppeld aan een stuk")).join(""),
      true
    );
  }

  assetLibraryEl.innerHTML = html || `<p class="status">Nog geen bestanden in de bibliotheek.</p>`;
  assetLibraryEl.querySelectorAll("button[data-asset-id]").forEach((btn) => {
    const asset = assetsById.get(btn.dataset.assetId);
    btn.addEventListener("click", () => deleteAsset(asset, usedAssetIds.has(asset.id)));
  });
}

async function deleteAsset(asset, isUsed) {
  const warning = isUsed
    ? `"${asset.filename}" wordt nog gebruikt door een stuk of passage. Verwijderen maakt die koppeling leeg. Doorgaan?`
    : `"${asset.filename}" verwijderen?`;
  if (!confirm(warning)) return;

  try {
    await apiDeleteAsset(asset.id);
  } catch (err) {
    alert("Verwijderen mislukt: " + err.message);
    return;
  }
  await loadAssets();
  await renderAssetLibrary();
}

toggleLibraryBtn.addEventListener("click", async () => {
  libraryVisible = !libraryVisible;
  assetLibraryEl.hidden = !libraryVisible;
  toggleLibraryBtn.textContent = libraryVisible ? "Verbergen" : "Tonen";
  if (libraryVisible) await renderAssetLibrary();
});

// ---------- Editor: open/close ----------

function resetEditorState() {
  state.pieceId = null;
  state.isNew = true;
  state.pdfDoc = null;
  state.currentPage = 1;
  state.pdfAssetId = null;
  state.pdfFile = null;
  state.passages = [];
  drawModeOn = false;
  draftRects = null;
  draftFieldsInitialized = false;
  activePassageKey = null;
  addPassageBtn.textContent = "+ Passage tekenen";
  drawHint.hidden = true;
  drawMoreBanner.hidden = true;
  pdfContainer.classList.remove("draw-mode");
}

async function openEditor(piece) {
  resetEditorState();
  listView.hidden = true;
  editorView.hidden = false;
  editorStatus.hidden = true;

  if (piece) {
    state.pieceId = piece.id;
    state.isNew = false;
    editorHeading.textContent = `Bewerken — ${piece.title}`;
    fTitle.value = piece.title;
    fComposer.value = piece.composer || "";
    fGenre.value = piece.genre || "";
    fSolo.checked = !!piece.solo;
    fVisible.checked = piece.visible !== false;
    for (const cb of fVoices) cb.checked = piece.voices.includes(cb.value);
    state.pdfAssetId = piece.pdf_asset_id;
    fPdfSelect.value = piece.pdf_asset_id || "";

    const passages = await listPassages(piece.id);
    state.passages = passages.map((p) => ({
      _key: newKey(),
      id: p.id,
      title: p.title,
      description: p.description,
      audioAssetId: p.audio_asset_id,
      audioFile: null,
      color: p.color || DEFAULT_PASSAGE_COLOR,
      sortOrder: p.sort_order,
      deleted: false,
      rects: (p.rects || []).map((r) => ({
        page: r.page,
        xPct: Number(r.x_pct),
        yPct: Number(r.y_pct),
        widthPct: Number(r.width_pct),
        heightPct: Number(r.height_pct),
      })),
    }));

    if (state.pdfAssetId) {
      const asset = pdfAssets.find((a) => a.id === state.pdfAssetId);
      if (asset) await loadPdfPreview(publicUrlFor(PDF_BUCKET, asset.storage_path));
    }
  } else {
    editorHeading.textContent = "Nieuw stuk";
    fTitle.value = "";
    fComposer.value = "";
    fGenre.value = "";
    fSolo.checked = false;
    fVisible.checked = true;
    for (const cb of fVoices) cb.checked = false;
    fPdfSelect.value = "";
    fPdfUpload.value = "";
    pdfContainer.innerHTML = `<p class="status">Kies of upload eerst een PDF.</p>`;
    pdfNav.hidden = true;
    addPassageBtn.hidden = true;
  }

  renderPassageList();
}

function closeEditor() {
  editorView.hidden = true;
  listView.hidden = false;
}

cancelBtn.addEventListener("click", closeEditor);
newPieceBtn.addEventListener("click", () => openEditor(null));

// ---------- PDF preview + page rendering ----------

async function loadPdfPreview(urlOrData) {
  const loadingTask =
    typeof urlOrData === "string" ? pdfjsLib.getDocument(urlOrData) : pdfjsLib.getDocument({ data: urlOrData });
  state.pdfDoc = await loadingTask.promise;
  state.currentPage = 1;
  pdfNav.hidden = state.pdfDoc.numPages <= 1;
  addPassageBtn.hidden = false;
  await renderCurrentPage();
}

async function renderCurrentPage() {
  if (!state.pdfDoc) return;
  const page = await state.pdfDoc.getPage(state.currentPage);
  const targetWidth = Math.min(pdfContainer.clientWidth || 600, 640);
  const viewport = page.getViewport({ scale: targetWidth / page.getViewport({ scale: 1 }).width });

  pdfContainer.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "page-wrapper";
  const canvas = document.createElement("canvas");
  canvas.className = "page-canvas";
  const overlay = document.createElement("div");
  overlay.className = "page-overlay";
  wrapper.appendChild(canvas);
  wrapper.appendChild(overlay);
  pdfContainer.appendChild(wrapper);

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

  pdfPageIndicator.textContent = `Pagina ${state.currentPage} van ${state.pdfDoc.numPages}`;
  pdfPrev.disabled = state.currentPage <= 1;
  pdfNext.disabled = state.currentPage >= state.pdfDoc.numPages;

  renderMarkersOnOverlay(overlay);
  attachDrawHandlers(overlay);
}

function renderRectMarker(overlay, rect, { colorClass, noteOnly, badgeText, clickable, onClick }) {
  const marker = document.createElement("div");
  marker.className = "editor-passage-marker color-" + colorClass + (noteOnly ? " note-only" : "");
  marker.style.left = `${rect.xPct * 100}%`;
  marker.style.top = `${rect.yPct * 100}%`;
  marker.style.width = `${rect.widthPct * 100}%`;
  marker.style.height = `${rect.heightPct * 100}%`;
  marker.innerHTML = `<span class="marker-badge">${badgeText}</span>`;
  if (clickable) {
    marker.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
  }
  overlay.appendChild(marker);
}

// Tekent alle passages op de huidige pagina. Een passage kan uit meerdere
// vakken bestaan — die krijgen dan een nummertje (1, 2, …) in plaats van de
// titel, zodat op elke rechthoek meteen duidelijk is dat ze bij elkaar
// horen. De passage die op dit moment in de modal open staat (nieuw of
// bewerkt) wordt getekend vanuit de werkkopie (draftRects), niet vanuit de
// laatst opgeslagen versie, zodat net toegevoegde/verwijderde vakken en de
// gekozen kleur meteen zichtbaar zijn.
function renderMarkersOnOverlay(overlay) {
  for (const passage of state.passages) {
    if (passage.deleted) continue;
    const isDraft = draftRects !== null && passage._key === activePassageKey;
    const rects = isDraft ? draftRects : passage.rects;
    const hasAudio = !!(passage.audioAssetId || passage.audioFile);
    const color = (isDraft ? selectedColor : passage.color) || DEFAULT_PASSAGE_COLOR;
    const showNumbers = rects.length > 1;
    rects.forEach((rect, i) => {
      if (rect.page !== state.currentPage) return;
      renderRectMarker(overlay, rect, {
        colorClass: color,
        noteOnly: !hasAudio,
        badgeText: showNumbers ? String(i + 1) : passage.title || "passage",
        clickable: true,
        onClick: () => {
          if (!drawModeOn) openPassageModal(passage._key);
        },
      });
    });
  }

  // Een gloednieuwe passage heeft nog geen rij in state.passages (die komt
  // er pas bij "Bewaren") — die vakken apart tekenen.
  if (draftRects !== null && activePassageKey === null) {
    const showNumbers = draftRects.length > 1;
    draftRects.forEach((rect, i) => {
      if (rect.page !== state.currentPage) return;
      renderRectMarker(overlay, rect, {
        colorClass: selectedColor,
        noteOnly: false,
        badgeText: showNumbers ? String(i + 1) : "nieuw",
        clickable: false,
      });
    });
  }
}

pdfPrev.addEventListener("click", async () => {
  if (state.currentPage > 1) {
    state.currentPage -= 1;
    await renderCurrentPage();
  }
});
pdfNext.addEventListener("click", async () => {
  if (state.currentPage < state.pdfDoc.numPages) {
    state.currentPage += 1;
    await renderCurrentPage();
  }
});

fPdfSelect.addEventListener("change", async () => {
  if (!fPdfSelect.value) return;
  fPdfUpload.value = "";
  state.pdfAssetId = fPdfSelect.value;
  state.pdfFile = null;
  const asset = pdfAssets.find((a) => a.id === fPdfSelect.value);
  await loadPdfPreview(publicUrlFor(PDF_BUCKET, asset.storage_path));
});

fPdfUpload.addEventListener("change", async () => {
  const file = fPdfUpload.files[0];
  if (!file) return;
  fPdfSelect.value = "";
  state.pdfAssetId = null;
  state.pdfFile = file;
  const buffer = await file.arrayBuffer();
  await loadPdfPreview(new Uint8Array(buffer));
});

// ---------- Drawing new passage rectangles ----------

addPassageBtn.addEventListener("click", () => {
  if (drawModeOn) {
    // Annuleer het tekenen van het eerste vak van een gloednieuwe passage —
    // er is nog niets getekend, dus er is ook niets te bewaren.
    drawModeOn = false;
    draftRects = null;
    addPassageBtn.textContent = "+ Passage tekenen";
    drawHint.hidden = true;
    pdfContainer.classList.remove("draw-mode");
    renderCurrentPage();
  } else {
    draftRects = [];
    draftFieldsInitialized = false;
    activePassageKey = null;
    drawModeOn = true;
    addPassageBtn.textContent = "Annuleer tekenen";
    drawHint.hidden = false;
    pdfContainer.classList.add("draw-mode");
  }
});

drawMoreCancelBtn.addEventListener("click", () => {
  drawModeOn = false;
  pdfContainer.classList.remove("draw-mode");
  drawMoreBanner.hidden = true;
  renderCurrentPage();
  openPassageModal(activePassageKey, { keepDraft: true });
});

function attachDrawHandlers(overlay) {
  let dragStart = null;
  let dragEl = null;

  overlay.addEventListener("pointerdown", (e) => {
    if (!drawModeOn) return;
    // Voorkomt dat een sleepbeweging met de vinger (tablet/touchscreen)
    // als scrollen/pannen van de pagina wordt opgevat — zie ook de
    // touch-action: none hierboven in css/admin.css.
    e.preventDefault();
    overlay.setPointerCapture(e.pointerId);
    const rect = overlay.getBoundingClientRect();
    dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    dragEl = document.createElement("div");
    dragEl.className = "draw-rect";
    overlay.appendChild(dragEl);
  });

  overlay.addEventListener("pointermove", (e) => {
    if (!dragStart || !dragEl) return;
    e.preventDefault();
    const rect = overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const left = Math.min(x, dragStart.x);
    const top = Math.min(y, dragStart.y);
    const w = Math.abs(x - dragStart.x);
    const h = Math.abs(y - dragStart.y);
    dragEl.style.left = `${left}px`;
    dragEl.style.top = `${top}px`;
    dragEl.style.width = `${w}px`;
    dragEl.style.height = `${h}px`;
  });

  overlay.addEventListener("pointerup", (e) => {
    if (!dragStart || !dragEl) return;
    const rect = overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let left = Math.min(x, dragStart.x);
    let top = Math.min(y, dragStart.y);
    let w = Math.abs(x - dragStart.x);
    let h = Math.abs(y - dragStart.y);
    dragEl.remove();
    dragStart = null;
    dragEl = null;

    // Een gewone klik (nauwelijks gesleept) telt ook: geef een standaard
    // rechthoekje rond het klikpunt, zodat "even klikken" ook werkt.
    if (w < 12 || h < 8) {
      w = Math.min(160, rect.width * 0.25);
      h = Math.min(70, rect.height * 0.3);
      left = Math.max(0, Math.min(x - w / 2, rect.width - w));
      top = Math.max(0, Math.min(y - h / 2, rect.height - h));
    }

    draftRects.push({
      page: state.currentPage,
      xPct: left / rect.width,
      yPct: top / rect.height,
      widthPct: w / rect.width,
      heightPct: h / rect.height,
    });
    drawModeOn = false;
    addPassageBtn.textContent = "+ Passage tekenen";
    drawHint.hidden = true;
    drawMoreBanner.hidden = true;
    pdfContainer.classList.remove("draw-mode");
    // keepDraft: dit vak is zojuist aan draftRects toegevoegd — de al
    // ingevulde titel/beschrijving/kleur (of "Nieuwe passage" bij het
    // allereerste vak) mogen niet overschreven worden.
    openPassageModal(activePassageKey, { keepDraft: draftFieldsInitialized });
  });
}

// ---------- Passage modal ----------

function updateNoAudioFieldState() {
  pfAudioField.classList.toggle("disabled", pfNoAudio.checked);
}

pfNoAudio.addEventListener("change", () => {
  if (pfNoAudio.checked) {
    pfAudioSelect.value = "";
    pfAudioUpload.value = "";
  }
  updateNoAudioFieldState();
});

// Vakken die uit de bladmuziek (regel/pagina) bestaan. `keepDraft` geeft aan
// dat we de modal opnieuw tonen ná het tekenen van een extra vak (of na
// annuleren daarvan) voor dezelfde passage — dan mogen de al ingevulde
// velden niet gereset worden, alleen het vakkenlijstje wordt ververst.
function openPassageModal(key, { keepDraft = false } = {}) {
  activePassageKey = key;
  if (!keepDraft) {
    if (key) {
      const passage = state.passages.find((p) => p._key === key);
      passageModalTitle.textContent = "Passage bewerken";
      pfTitle.value = passage.title || "";
      pfDescription.value = passage.description || "";
      pfAudioSelect.value = passage.audioAssetId || "";
      pfAudioUpload.value = "";
      pfNoAudio.checked = !passage.audioAssetId && !passage.audioFile;
      pfDelete.hidden = false;
      setSelectedColor(passage.color || DEFAULT_PASSAGE_COLOR);
      draftRects = passage.rects.map((r) => ({ ...r }));
    } else {
      passageModalTitle.textContent = "Nieuwe passage";
      pfTitle.value = "";
      pfDescription.value = "";
      pfAudioSelect.value = "";
      pfAudioUpload.value = "";
      pfNoAudio.checked = false;
      pfDelete.hidden = true;
      setSelectedColor(DEFAULT_PASSAGE_COLOR);
      // draftRects bevat op dit moment al het zojuist getekende eerste vak
      // (gezet door de pointerup-handler vóór deze aanroep).
    }
    updateNoAudioFieldState();
    draftFieldsInitialized = true;
  }
  renderRectsList();
  addPassageBtn.hidden = true;
  passageModal.hidden = false;
}

function renderRectsList() {
  pfRectsList.innerHTML = "";
  draftRects.forEach((rect, i) => {
    const row = document.createElement("div");
    row.className = "rect-row";
    const canRemove = draftRects.length > 1;
    row.innerHTML = `
      <span class="rect-badge">${i + 1}</span>
      <span class="rect-row-label">Pagina ${rect.page}</span>
      ${canRemove ? '<button type="button" class="rect-remove" aria-label="Vak verwijderen" title="Vak verwijderen">✕</button>' : ""}
    `;
    if (canRemove) {
      row.querySelector(".rect-remove").addEventListener("click", () => {
        draftRects.splice(i, 1);
        renderRectsList();
        renderCurrentPage();
      });
    }
    pfRectsList.appendChild(row);
  });
}

pfAddRectBtn.addEventListener("click", () => {
  passageModal.hidden = true;
  drawModeOn = true;
  drawHint.hidden = true;
  drawMoreBanner.hidden = false;
  pdfContainer.classList.add("draw-mode");
  renderCurrentPage();
});

function closePassageModal() {
  passageModal.hidden = true;
  activePassageKey = null;
  draftRects = null;
  draftFieldsInitialized = false;
  addPassageBtn.hidden = false;
}

pfCancel.addEventListener("click", () => {
  closePassageModal();
  renderCurrentPage();
});

pfSave.addEventListener("click", async () => {
  const title = pfTitle.value.trim();
  if (!title) {
    alert("Geef de passage een titel.");
    return;
  }
  if (!draftRects || draftRects.length === 0) {
    alert("Teken minstens één vak op de bladmuziek.");
    return;
  }
  const audioFile = pfNoAudio.checked ? null : pfAudioUpload.files[0] || null;
  const audioAssetId = pfNoAudio.checked ? null : pfAudioSelect.value || null;
  const rects = draftRects.map((r) => ({ ...r }));

  if (activePassageKey) {
    const passage = state.passages.find((p) => p._key === activePassageKey);
    passage.title = title;
    passage.description = pfDescription.value.trim();
    passage.color = selectedColor;
    passage.rects = rects;
    if (pfNoAudio.checked) {
      passage.audioFile = null;
      passage.audioAssetId = null;
    } else if (audioFile) {
      passage.audioFile = audioFile;
      passage.audioAssetId = null;
    } else if (audioAssetId) {
      passage.audioAssetId = audioAssetId;
      passage.audioFile = null;
    }
  } else {
    state.passages.push({
      _key: newKey(),
      id: null,
      title,
      description: pfDescription.value.trim(),
      audioAssetId: audioFile ? null : audioAssetId,
      audioFile,
      color: selectedColor,
      rects,
      sortOrder: state.passages.length,
      deleted: false,
    });
  }

  closePassageModal();
  await renderCurrentPage();
  renderPassageList();
});

pfDelete.addEventListener("click", () => {
  const passage = state.passages.find((p) => p._key === activePassageKey);
  if (passage.id) {
    passage.deleted = true;
  } else {
    state.passages = state.passages.filter((p) => p._key !== activePassageKey);
  }
  closePassageModal();
  renderCurrentPage();
  renderPassageList();
});

// ---------- Passage list (onder de editor) ----------

function renderPassageList() {
  const visible = state.passages.filter((p) => !p.deleted);
  if (visible.length === 0) {
    passageListEl.innerHTML = `<p class="status">Nog geen passages.</p>`;
    return;
  }
  passageListEl.innerHTML = "";
  for (const passage of visible) {
    const hasAudio = !!(passage.audioAssetId || passage.audioFile);
    const color = passage.color || DEFAULT_PASSAGE_COLOR;
    const pages = [...new Set(passage.rects.map((r) => r.page))];
    const pageLabel =
      passage.rects.length > 1 ? `${passage.rects.length} vakken (pagina ${pages.join(", ")})` : `Pagina ${pages[0]}`;
    const row = document.createElement("div");
    row.className = "passage-row";
    row.innerHTML = `
      <div>
        <div class="passage-row-title"><span class="color-swatch color-${color} passage-row-dot"></span>${passage.title}${hasAudio ? "" : ' <span class="passage-row-note-badge">alleen opmerking</span>'}</div>
        <div class="passage-row-meta">${pageLabel} · ${passage.description || ""}</div>
      </div>
      <button class="btn btn-secondary btn-small">Bewerken</button>
    `;
    row.querySelector("button").addEventListener("click", () => openPassageModal(passage._key));
    passageListEl.appendChild(row);
  }
}

// ---------- Save piece ----------

function uniquePieceId(title) {
  const base = slugify(title) || "stuk";
  let candidate = base;
  let n = 2;
  const existingIds = new Set(pieces.map((p) => p.id));
  while (existingIds.has(candidate)) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}

saveBtn.addEventListener("click", async () => {
  const title = fTitle.value.trim();
  if (!title) {
    alert("Geef het stuk een titel.");
    return;
  }
  if (!state.pdfAssetId && !state.pdfFile) {
    alert("Kies of upload een PDF.");
    return;
  }

  saveBtn.disabled = true;
  editorStatus.hidden = false;
  editorStatus.textContent = "Bezig met opslaan…";

  try {
    const pieceId = state.isNew ? uniquePieceId(title) : state.pieceId;

    let pdfAssetId = state.pdfAssetId;
    if (state.pdfFile) {
      editorStatus.textContent = "PDF uploaden…";
      const asset = await uploadAsset(PDF_BUCKET, `${pieceId}/${state.pdfFile.name}`, state.pdfFile);
      pdfAssetId = asset.id;
    }

    const voices = fVoices.filter((cb) => cb.checked).map((cb) => cb.value);
    const pieceRow = {
      id: pieceId,
      title,
      composer: fComposer.value.trim(),
      genre: fGenre.value.trim(),
      voices,
      solo: fSolo.checked,
      visible: fVisible.checked,
      pdf_asset_id: pdfAssetId,
    };
    if (state.isNew) {
      pieceRow.sort_order = pieces.length ? Math.max(...pieces.map((p) => p.sort_order ?? 0)) + 1 : 0;
    }

    editorStatus.textContent = "Stuk opslaan…";
    if (state.isNew) {
      await insertPiece(pieceRow);
    } else {
      await updatePiece(pieceId, pieceRow);
    }

    let order = 0;
    for (const passage of state.passages) {
      if (passage.deleted) {
        if (passage.id) {
          editorStatus.textContent = `Passage "${passage.title}" verwijderen…`;
          await apiDeletePassage(passage.id);
        }
        continue;
      }

      let audioAssetId = passage.audioAssetId;
      if (passage.audioFile) {
        editorStatus.textContent = `Audio uploaden voor "${passage.title}"…`;
        const path = `${pieceId}/${Date.now()}-${passage.audioFile.name}`;
        const asset = await uploadAsset(AUDIO_BUCKET, path, passage.audioFile);
        audioAssetId = asset.id;
      }

      const passageRow = {
        piece_id: pieceId,
        title: passage.title,
        description: passage.description,
        audio_asset_id: audioAssetId,
        color: passage.color || DEFAULT_PASSAGE_COLOR,
        sort_order: order++,
        rects: passage.rects.map((r) => ({
          page: r.page,
          x_pct: r.xPct,
          y_pct: r.yPct,
          width_pct: r.widthPct,
          height_pct: r.heightPct,
        })),
      };

      editorStatus.textContent = `Passage "${passage.title}" opslaan…`;
      if (passage.id) {
        await updatePassage(passage.id, passageRow);
      } else {
        await insertPassage(passageRow);
      }
    }

    await loadAssets();
    await refreshList();
    closeEditor();
  } catch (err) {
    console.error(err);
    editorStatus.textContent = "Opslaan mislukt: " + err.message;
  } finally {
    saveBtn.disabled = false;
  }
});

// ---------- Inloggen ----------

async function showAdmin() {
  loginView.hidden = true;
  listView.hidden = false;
  logoutBtn.hidden = false;
  try {
    await loadAssets();
    await refreshList();
  } catch (err) {
    console.error(err);
    pieceListEl.innerHTML = `<p class="status">Er ging iets mis bij het laden: ${err.message}</p>`;
  }
}

function showLogin() {
  listView.hidden = true;
  editorView.hidden = true;
  logoutBtn.hidden = true;
  loginView.hidden = false;
  loginPassword.value = "";
  loginError.hidden = true;
  loginPassword.focus();
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    await login(loginPassword.value);
    await showAdmin();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await logout();
  } catch (err) {
    console.error(err);
  }
  showLogin();
});

// ---------- Init ----------

async function main() {
  try {
    const { loggedIn } = await checkSession();
    if (loggedIn) {
      await showAdmin();
    } else {
      showLogin();
    }
  } catch (err) {
    console.error(err);
    showLogin();
    loginError.textContent = "Kon geen verbinding maken met de server: " + err.message;
    loginError.hidden = false;
  }
}

main();
