import * as pdfjsLib from "./vendor/pdfjs/pdf.min.mjs";
import { supabase, PDF_BUCKET, AUDIO_BUCKET, publicUrlFor } from "./supabaseClient.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "./vendor/pdfjs/pdf.worker.min.mjs",
  import.meta.url
).href;

// ---------- DOM ----------

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
const fPdfSelect = document.getElementById("f-pdf-select");
const fPdfUpload = document.getElementById("f-pdf-upload");

const pdfNav = document.getElementById("pdf-nav");
const pdfPrev = document.getElementById("pdf-prev");
const pdfNext = document.getElementById("pdf-next");
const pdfPageIndicator = document.getElementById("pdf-page-indicator");
const pdfContainer = document.getElementById("admin-pdf-container");
const addPassageBtn = document.getElementById("add-passage-btn");
const drawHint = document.getElementById("draw-hint");

const passageListEl = document.getElementById("passage-list");

const passageModal = document.getElementById("passage-modal");
const passageModalTitle = document.getElementById("passage-modal-title");
const pfTitle = document.getElementById("pf-title");
const pfDescription = document.getElementById("pf-description");
const pfAudioSelect = document.getElementById("pf-audio-select");
const pfAudioUpload = document.getElementById("pf-audio-upload");
const pfDelete = document.getElementById("pf-delete");
const pfCancel = document.getElementById("pf-cancel");
const pfSave = document.getElementById("pf-save");

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
  passages: [], // {_key, id, title, description, audioAssetId, audioFile, page, xPct, yPct, widthPct, heightPct, sortOrder, deleted}
};

let drawModeOn = false;
let activePassageKey = null; // passage being edited in the modal
let pendingRect = null; // {page, xPct, yPct, widthPct, heightPct} for a not-yet-saved new passage

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
  const { data, error } = await supabase.from("assets").select("*").order("filename");
  if (error) throw error;
  pdfAssets = data.filter((a) => a.type === "pdf");
  audioAssets = data.filter((a) => a.type === "audio");

  fPdfSelect.innerHTML =
    `<option value="">— kies uit bibliotheek —</option>` +
    pdfAssets.map((a) => `<option value="${a.id}">${a.filename}</option>`).join("");
  pfAudioSelect.innerHTML =
    `<option value="">— kies uit bibliotheek —</option>` +
    audioAssets.map((a) => `<option value="${a.id}">${a.filename}</option>`).join("");
}

async function loadPieces() {
  const { data, error } = await supabase.from("pieces").select("*").order("created_at");
  if (error) throw error;
  pieces = data;
}

async function passageCountsByPiece() {
  const { data, error } = await supabase.from("passages").select("piece_id");
  if (error) throw error;
  const counts = new Map();
  for (const row of data) counts.set(row.piece_id, (counts.get(row.piece_id) || 0) + 1);
  return counts;
}

// ---------- List view ----------

function renderPieceList(counts) {
  if (pieces.length === 0) {
    pieceListEl.innerHTML = `<p class="status">Nog geen stukken toegevoegd.</p>`;
    return;
  }
  pieceListEl.innerHTML = "";
  for (const piece of pieces) {
    const row = document.createElement("div");
    row.className = "admin-piece-row";
    row.innerHTML = `
      <div>
        <div class="admin-piece-row-title serif">${piece.title}</div>
        <div class="admin-piece-row-meta">${piece.composer || ""} · ${piece.genre || ""} · ${counts.get(piece.id) || 0} passage(s)</div>
      </div>
      <div class="admin-piece-row-actions">
        <button class="btn btn-secondary btn-small" data-action="edit">Bewerken</button>
        <button class="btn btn-danger btn-small" data-action="delete">Verwijderen</button>
      </div>
    `;
    row.querySelector('[data-action="edit"]').addEventListener("click", () => openEditor(piece));
    row.querySelector('[data-action="delete"]').addEventListener("click", () => deletePiece(piece));
    pieceListEl.appendChild(row);
  }
}

async function refreshList() {
  pieceListEl.innerHTML = `<p class="status">Stukken worden geladen…</p>`;
  await loadPieces();
  const counts = await passageCountsByPiece();
  renderPieceList(counts);
}

async function deletePiece(piece) {
  if (!confirm(`"${piece.title}" verwijderen? De PDF en mp3's blijven in de bibliotheek staan.`)) return;
  const { error } = await supabase.from("pieces").delete().eq("id", piece.id);
  if (error) {
    alert("Verwijderen mislukt: " + error.message);
    return;
  }
  await refreshList();
}

// ---------- Asset library panel ----------

let libraryVisible = false;

function assetRowHtml(asset, useLabel) {
  return `
    <div class="asset-row">
      <div>
        <strong>${asset.filename}</strong>
        <div class="asset-row-meta">${asset.type === "pdf" ? "PDF" : "mp3"}${useLabel ? " · " + useLabel : ""}</div>
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
  const { data: allPieces } = await supabase.from("pieces").select("id, title, pdf_asset_id");
  const { data: allPassages } = await supabase.from("passages").select("id, piece_id, audio_asset_id");

  const assetsById = new Map([...pdfAssets, ...audioAssets].map((a) => [a.id, a]));
  const usedAssetIds = new Set();
  let html = "";

  for (const piece of allPieces || []) {
    const files = [];
    if (piece.pdf_asset_id && assetsById.has(piece.pdf_asset_id)) {
      usedAssetIds.add(piece.pdf_asset_id);
      files.push(assetRowHtml(assetsById.get(piece.pdf_asset_id), "bladmuziek"));
    }
    for (const passage of (allPassages || []).filter((p) => p.piece_id === piece.id)) {
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

  const bucket = asset.type === "pdf" ? PDF_BUCKET : AUDIO_BUCKET;
  await supabase.storage.from(bucket).remove([asset.storage_path]);
  const { error } = await supabase.from("assets").delete().eq("id", asset.id);
  if (error) {
    alert("Verwijderen mislukt: " + error.message);
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
    for (const cb of fVoices) cb.checked = piece.voices.includes(cb.value);
    state.pdfAssetId = piece.pdf_asset_id;
    fPdfSelect.value = piece.pdf_asset_id || "";

    const { data: passages } = await supabase
      .from("passages")
      .select("*")
      .eq("piece_id", piece.id)
      .order("sort_order");
    state.passages = (passages || []).map((p) => ({
      _key: newKey(),
      id: p.id,
      title: p.title,
      description: p.description,
      audioAssetId: p.audio_asset_id,
      audioFile: null,
      page: p.page,
      xPct: Number(p.x_pct),
      yPct: Number(p.y_pct),
      widthPct: Number(p.width_pct),
      heightPct: Number(p.height_pct),
      sortOrder: p.sort_order,
      deleted: false,
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

function renderMarkersOnOverlay(overlay) {
  for (const passage of state.passages) {
    if (passage.deleted || passage.page !== state.currentPage) continue;
    const marker = document.createElement("div");
    marker.className = "editor-passage-marker";
    marker.style.left = `${passage.xPct * 100}%`;
    marker.style.top = `${passage.yPct * 100}%`;
    marker.style.width = `${passage.widthPct * 100}%`;
    marker.style.height = `${passage.heightPct * 100}%`;
    marker.innerHTML = `<span class="marker-badge">${passage.title || "passage"}</span>`;
    marker.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!drawModeOn) openPassageModal(passage._key);
    });
    overlay.appendChild(marker);
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
  drawModeOn = !drawModeOn;
  addPassageBtn.textContent = drawModeOn ? "Annuleer tekenen" : "+ Passage tekenen";
  drawHint.hidden = !drawModeOn;
  pdfContainer.classList.toggle("draw-mode", drawModeOn);
});

function attachDrawHandlers(overlay) {
  let dragStart = null;
  let dragEl = null;

  overlay.addEventListener("pointerdown", (e) => {
    if (!drawModeOn) return;
    const rect = overlay.getBoundingClientRect();
    dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    dragEl = document.createElement("div");
    dragEl.className = "draw-rect";
    overlay.appendChild(dragEl);
  });

  overlay.addEventListener("pointermove", (e) => {
    if (!dragStart || !dragEl) return;
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

    pendingRect = {
      page: state.currentPage,
      xPct: left / rect.width,
      yPct: top / rect.height,
      widthPct: w / rect.width,
      heightPct: h / rect.height,
    };
    drawModeOn = false;
    addPassageBtn.textContent = "+ Passage tekenen";
    drawHint.hidden = true;
    openPassageModal(null);
  });
}

// ---------- Passage modal ----------

function openPassageModal(key) {
  activePassageKey = key;
  if (key) {
    const passage = state.passages.find((p) => p._key === key);
    passageModalTitle.textContent = "Passage bewerken";
    pfTitle.value = passage.title || "";
    pfDescription.value = passage.description || "";
    pfAudioSelect.value = passage.audioAssetId || "";
    pfAudioUpload.value = "";
    pfDelete.hidden = false;
  } else {
    passageModalTitle.textContent = "Nieuwe passage";
    pfTitle.value = "";
    pfDescription.value = "";
    pfAudioSelect.value = "";
    pfAudioUpload.value = "";
    pfDelete.hidden = true;
  }
  passageModal.hidden = false;
}

function closePassageModal() {
  passageModal.hidden = true;
  activePassageKey = null;
  pendingRect = null;
}

pfCancel.addEventListener("click", closePassageModal);

pfSave.addEventListener("click", async () => {
  const title = pfTitle.value.trim();
  if (!title) {
    alert("Geef de passage een titel.");
    return;
  }
  const audioFile = pfAudioUpload.files[0] || null;
  const audioAssetId = pfAudioSelect.value || null;

  if (activePassageKey) {
    const passage = state.passages.find((p) => p._key === activePassageKey);
    passage.title = title;
    passage.description = pfDescription.value.trim();
    if (audioFile) {
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
      page: pendingRect.page,
      xPct: pendingRect.xPct,
      yPct: pendingRect.yPct,
      widthPct: pendingRect.widthPct,
      heightPct: pendingRect.heightPct,
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
    const row = document.createElement("div");
    row.className = "passage-row";
    row.innerHTML = `
      <div>
        <div class="passage-row-title">${passage.title}</div>
        <div class="passage-row-meta">Pagina ${passage.page} · ${passage.description || ""}</div>
      </div>
      <button class="btn btn-secondary btn-small">Bewerken</button>
    `;
    row.querySelector("button").addEventListener("click", () => openPassageModal(passage._key));
    passageListEl.appendChild(row);
  }
}

// ---------- Save piece ----------

async function uploadAsset(bucket, storagePath, file) {
  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, {
    upsert: true,
    contentType: file.type,
  });
  if (uploadError) throw uploadError;

  const { data: asset, error: insertError } = await supabase
    .from("assets")
    .insert({
      type: bucket === PDF_BUCKET ? "pdf" : "audio",
      filename: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select()
    .single();
  if (insertError) throw insertError;
  return asset;
}

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
      pdf_asset_id: pdfAssetId,
    };

    editorStatus.textContent = "Stuk opslaan…";
    if (state.isNew) {
      const { error } = await supabase.from("pieces").insert(pieceRow);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("pieces").update(pieceRow).eq("id", pieceId);
      if (error) throw error;
    }

    let order = 0;
    for (const passage of state.passages) {
      if (passage.deleted) {
        if (passage.id) {
          editorStatus.textContent = `Passage "${passage.title}" verwijderen…`;
          const { error } = await supabase.from("passages").delete().eq("id", passage.id);
          if (error) throw error;
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
      if (!audioAssetId) {
        throw new Error(`Passage "${passage.title}" heeft geen oefenfragment.`);
      }

      const passageRow = {
        piece_id: pieceId,
        title: passage.title,
        description: passage.description,
        audio_asset_id: audioAssetId,
        page: passage.page,
        x_pct: passage.xPct,
        y_pct: passage.yPct,
        width_pct: passage.widthPct,
        height_pct: passage.heightPct,
        sort_order: order++,
      };

      editorStatus.textContent = `Passage "${passage.title}" opslaan…`;
      if (passage.id) {
        const { error } = await supabase.from("passages").update(passageRow).eq("id", passage.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("passages").insert(passageRow);
        if (error) throw error;
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

// ---------- Init ----------

async function main() {
  try {
    await loadAssets();
    await refreshList();
  } catch (err) {
    console.error(err);
    pieceListEl.innerHTML = `<p class="status">Er ging iets mis bij het laden: ${err.message}</p>`;
  }
}

main();
