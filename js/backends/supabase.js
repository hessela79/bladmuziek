// Backend-implementatie: praat rechtstreeks met Supabase (Postgres +
// Storage) — de ontwikkel-/testopzet, bijv. voor een preview op GitHub
// Pages. Wordt gekozen door js/apiClient.js op basis van het hostnaam;
// zie dat bestand voor de switch-logica.
//
// Gebruikt de publieke "anon" key — bedoeld om openbaar te zijn, de
// toegangsregels (RLS/storage policies) in supabase/schema.sql bepalen
// wat daarmee mag. RLS staat open (geen rechtenniveau), dus login/logout
// hieronder zijn no-ops: dit is puur een ontwikkelomgeving, geen echte
// beveiliging nodig (die zit in de MariaDB-backend, voor productie).

const SUPABASE_URL = "https://gtwsjpkuyiaxeaqmcvgs.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0d3NqcGt1eWlheGVhcW1jdmdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0OTc3MTQsImV4cCI6MjEwNDA3MzcxNH0.LmMbW4mDdSbM5l52XAWktJdRn-u-45D1lkj83P2xhVU";

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      if (window.supabase) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Kon ${src} niet laden.`));
    document.head.appendChild(script);
  });
}

// De Supabase-library wordt alleen gedownload wanneer deze backend
// daadwerkelijk gekozen wordt (niet in productie), via de vendored UMD-
// build — net als pdf.js blijft de site zo vrij van externe CDN's.
if (!window.supabase) {
  await loadScriptOnce(new URL("../vendor/supabase/supabase.js", import.meta.url).href);
}

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    // Zonder dit kan de browser een gewone (niet-harde) verversing soms
    // beantwoorden met een gecachte data-aanvraag, waardoor bijvoorbeeld
    // een net versleepte volgorde niet meteen zichtbaar is.
    fetch: (url, options = {}) => fetch(url, { ...options, cache: "no-store" }),
  },
});

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

export const PDF_BUCKET = "pdfs";
export const AUDIO_BUCKET = "audio";

export function publicUrlFor(bucket, storagePath) {
  const { data } = client.storage.from(bucket).getPublicUrl(storagePath);
  return data.publicUrl;
}

// ---------- Stukken ----------

export async function listPieces({ visibleOnly = false } = {}) {
  let query = client.from("pieces").select("*").order("sort_order", { ascending: true });
  if (visibleOnly) query = query.eq("visible", true);
  return unwrap(await query);
}

export async function getPiece(id) {
  const piece = unwrap(
    await client.from("pieces").select("*, pdf_asset:assets(storage_path)").eq("id", id).maybeSingle()
  );
  if (!piece) throw new Error("Stuk niet gevonden.");
  return piece;
}

export async function insertPiece(row) {
  unwrap(await client.from("pieces").insert(row));
  return { ok: true };
}

export async function updatePiece(id, row) {
  unwrap(await client.from("pieces").update(row).eq("id", id));
  return { ok: true };
}

export async function deletePiece(id) {
  unwrap(await client.from("pieces").delete().eq("id", id));
  return { ok: true };
}

export async function reorderPieces(ids) {
  await Promise.all(
    ids.map((id, index) => client.from("pieces").update({ sort_order: index }).eq("id", id))
  );
  return { ok: true };
}

// ---------- Passages ----------
//
// Een passage kan uit meerdere vakken (rechthoeken op de bladmuziek)
// bestaan — bijv. een passage die over twee regels of een pagina-einde
// loopt — en die staan daarom in een eigen tabel (passage_rects) in
// plaats van rechtstreeks op passages.

const PASSAGE_SELECT =
  "*, audio_asset:assets(storage_path), rects:passage_rects(page, x_pct, y_pct, width_pct, height_pct, sort_order)";

export async function listPassages(pieceId) {
  return unwrap(
    await client
      .from("passages")
      .select(PASSAGE_SELECT)
      .eq("piece_id", pieceId)
      .order("sort_order", { ascending: true })
      .order("sort_order", { ascending: true, foreignTable: "passage_rects" })
  );
}

export async function listAllPassages() {
  return unwrap(
    await client
      .from("passages")
      .select(PASSAGE_SELECT)
      .order("sort_order", { ascending: true, foreignTable: "passage_rects" })
  );
}

async function replaceRects(passageId, rects) {
  unwrap(await client.from("passage_rects").delete().eq("passage_id", passageId));
  if (rects.length === 0) return;
  const rows = rects.map((r, i) => ({
    passage_id: passageId,
    page: r.page,
    x_pct: r.x_pct,
    y_pct: r.y_pct,
    width_pct: r.width_pct,
    height_pct: r.height_pct,
    sort_order: i,
  }));
  unwrap(await client.from("passage_rects").insert(rows));
}

export async function insertPassage(row) {
  const { rects, ...passageFields } = row;
  const passage = unwrap(await client.from("passages").insert(passageFields).select().single());
  await replaceRects(passage.id, rects || []);
  return { ok: true, id: passage.id };
}

export async function updatePassage(id, row) {
  const { rects, ...passageFields } = row;
  unwrap(await client.from("passages").update(passageFields).eq("id", id));
  await replaceRects(id, rects || []);
  return { ok: true };
}

export async function deletePassage(id) {
  unwrap(await client.from("passages").delete().eq("id", id));
  return { ok: true };
}

// ---------- Bestanden (assets) ----------

export async function listAssets() {
  return unwrap(await client.from("assets").select("*").order("filename"));
}

export async function deleteAsset(id) {
  const asset = unwrap(await client.from("assets").select("*").eq("id", id).single());
  const bucket = asset.type === "pdf" ? PDF_BUCKET : AUDIO_BUCKET;
  await client.storage.from(bucket).remove([asset.storage_path]);
  unwrap(await client.from("assets").delete().eq("id", id));
  return { ok: true };
}

export async function uploadAsset(bucket, storagePath, file) {
  const { error: uploadError } = await client.storage.from(bucket).upload(storagePath, file, {
    upsert: true,
    contentType: file.type,
  });
  if (uploadError) throw uploadError;

  return unwrap(
    await client
      .from("assets")
      .insert({
        type: bucket === PDF_BUCKET ? "pdf" : "audio",
        filename: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
      })
      .select()
      .single()
  );
}

// ---------- Inloggen (beheer) ----------
//
// Supabase RLS staat hier open (geen rechtenniveau) — dit is een
// ontwikkel-/testomgeving, dus geen echte login nodig.

export async function login() {
  return { ok: true };
}

export async function logout() {
  return { ok: true };
}

export async function checkSession() {
  return { loggedIn: true };
}

// ---------- Bezoekregistratie ----------

export async function logPageView({ path, pieceId, visitorId }) {
  unwrap(await client.from("page_views").insert({ path, piece_id: pieceId ?? null, visitor_id: visitorId }));
  return { ok: true };
}

export async function listPageViews() {
  return unwrap(
    await client.from("page_views").select("path, piece_id, visitor_id, created_at").order("created_at", { ascending: true })
  );
}
