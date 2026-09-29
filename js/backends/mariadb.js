// Backend-implementatie: praat met de eigen PHP-API in api/ (PHP +
// MariaDB) — de productie-opzet. Wordt gekozen door js/apiClient.js op
// basis van het hostnaam; zie dat bestand voor de switch-logica.
//
// Lezen is open, schrijven vereist een ingelogde sessie (zie api/auth.php)
// — de browser stuurt het sessie-cookie vanzelf mee omdat alles op
// hetzelfde domein draait.

const API_BASE = "api";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}/${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    // Leeg antwoord (bijv. bij een server-fout zonder JSON-body).
  }
  if (!res.ok) {
    throw new Error((body && body.error) || `Serverfout (${res.status})`);
  }
  return body;
}

export const PDF_BUCKET = "pdfs";
export const AUDIO_BUCKET = "audio";

export function publicUrlFor(bucket, storagePath) {
  return `uploads/${bucket}/${storagePath}`;
}

// ---------- Stukken ----------

export function listPieces({ visibleOnly = false } = {}) {
  return apiFetch(`pieces.php${visibleOnly ? "?visible_only=1" : ""}`);
}

export function getPiece(id) {
  return apiFetch(`pieces.php?id=${encodeURIComponent(id)}`);
}

export function insertPiece(row) {
  return apiFetch("pieces.php", { method: "POST", body: JSON.stringify(row) });
}

export function updatePiece(id, row) {
  return apiFetch(`pieces.php?id=${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(row) });
}

export function deletePiece(id) {
  return apiFetch(`pieces.php?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function reorderPieces(ids) {
  return apiFetch("reorder_pieces.php", { method: "POST", body: JSON.stringify({ ids }) });
}

// ---------- Passages ----------

export function listPassages(pieceId) {
  return apiFetch(`passages.php?piece_id=${encodeURIComponent(pieceId)}`);
}

export function listAllPassages() {
  return apiFetch("passages.php");
}

export function insertPassage(row) {
  return apiFetch("passages.php", { method: "POST", body: JSON.stringify(row) });
}

export function updatePassage(id, row) {
  return apiFetch(`passages.php?id=${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(row) });
}

export function deletePassage(id) {
  return apiFetch(`passages.php?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ---------- Bestanden (assets) ----------

export function listAssets() {
  return apiFetch("assets.php");
}

export function deleteAsset(id) {
  return apiFetch(`assets.php?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function uploadAsset(bucket, storagePath, file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("storage_path", storagePath);
  formData.append("type", bucket === PDF_BUCKET ? "pdf" : "audio");

  const res = await fetch(`${API_BASE}/upload.php`, { method: "POST", body: formData });
  let body = null;
  try {
    body = await res.json();
  } catch {
    // Leeg antwoord.
  }
  if (!res.ok) {
    throw new Error((body && body.error) || `Uploaden mislukt (${res.status})`);
  }
  return body;
}

// ---------- Inloggen (beheer) ----------

export function login(password) {
  return apiFetch("login.php", { method: "POST", body: JSON.stringify({ password }) });
}

export function logout() {
  return apiFetch("logout.php", { method: "POST" });
}

export function checkSession() {
  return apiFetch("session.php");
}
