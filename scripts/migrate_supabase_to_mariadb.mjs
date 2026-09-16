#!/usr/bin/env node
// Eenmalig migratiescript: haalt de huidige stukken/passages/bestanden op
// uit Supabase en zet ze over naar de nieuwe PHP+MariaDB-backend (op
// mijndomein.nl of waar je 'm ook host).
//
// Geen npm-installatie nodig — gebruikt alleen de ingebouwde fetch/FormData
// van Node 18+.
//
// Voordat je dit draait:
//  1. Zet de nieuwe site (met api/config.php ingevuld en het schema uit
//     sql/mariadb_schema.sql toegepast) live.
//  2. Vul TARGET_URL en TARGET_ADMIN_PASSWORD hieronder in.
//
// Gebruik:  node scripts/migrate_supabase_to_mariadb.mjs

const SUPABASE_URL = "https://gtwsjpkuyiaxeaqmcvgs.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0d3NqcGt1eWlheGVhcW1jdmdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0OTc3MTQsImV4cCI6MjEwNDA3MzcxNH0.LmMbW4mDdSbM5l52XAWktJdRn-u-45D1lkj83P2xhVU";

// ---------- Hier je eigen gegevens invullen ----------
const TARGET_URL = "https://jouwdomein.nl"; // zonder slash aan het eind
const TARGET_ADMIN_PASSWORD = "vul-hier-je-beheerderswachtwoord-in";
// ------------------------------------------------------

const supabaseHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

let sessionCookie = null;

async function targetFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (sessionCookie) headers.Cookie = sessionCookie;
  const res = await fetch(`${TARGET_URL}/api/${path}`, { ...options, headers });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) sessionCookie = setCookie.split(";")[0];
  let body = null;
  try {
    body = await res.json();
  } catch {
    // leeg antwoord
  }
  if (!res.ok) {
    throw new Error(`${path} mislukt (${res.status}): ${(body && body.error) || "onbekende fout"}`);
  }
  return body;
}

async function login() {
  await targetFetch("login.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: TARGET_ADMIN_PASSWORD }),
  });
  console.log("Ingelogd op de nieuwe backend.");
}

async function fetchSupabase(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: supabaseHeaders });
  if (!res.ok) {
    throw new Error(`Ophalen ${path} uit Supabase mislukt (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

async function downloadSupabaseFile(bucket, storagePath) {
  const url = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${storagePath}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Downloaden van ${url} mislukt (${res.status})`);
  }
  const blob = await res.blob();
  return blob;
}

async function uploadToTarget(type, storagePath, blob, filename) {
  const formData = new FormData();
  formData.append("file", blob, filename);
  formData.append("storage_path", storagePath);
  formData.append("type", type);
  const asset = await targetFetch("upload.php", { method: "POST", body: formData });
  return asset;
}

async function migratePiece(piece, allPassages) {
  console.log(`\n== ${piece.title} (${piece.id}) ==`);

  let pdfAssetId = null;
  if (piece.pdf_asset) {
    const filename = piece.pdf_asset.storage_path.split("/").pop();
    const blob = await downloadSupabaseFile("pdfs", piece.pdf_asset.storage_path);
    const asset = await uploadToTarget("pdf", piece.pdf_asset.storage_path, blob, filename);
    pdfAssetId = asset.id;
    console.log(`  PDF overgezet -> asset ${pdfAssetId}`);
  } else {
    console.log("  Waarschuwing: geen PDF gevonden voor dit stuk, wordt overgeslagen als PDF.");
  }

  await targetFetch("pieces.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: piece.id,
      title: piece.title,
      composer: piece.composer,
      genre: piece.genre,
      voices: piece.voices || [],
      solo: !!piece.solo,
      visible: piece.visible !== false,
      pdf_asset_id: pdfAssetId,
      sort_order: piece.sort_order ?? 0,
    }),
  });
  console.log("  stuk aangemaakt");

  const passages = allPassages.filter((p) => p.piece_id === piece.id);
  for (const passage of passages) {
    let audioAssetId = null;
    if (passage.audio_asset) {
      const filename = passage.audio_asset.storage_path.split("/").pop();
      const blob = await downloadSupabaseFile("audio", passage.audio_asset.storage_path);
      const asset = await uploadToTarget("audio", passage.audio_asset.storage_path, blob, filename);
      audioAssetId = asset.id;
    }

    await targetFetch("passages.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        piece_id: piece.id,
        title: passage.title,
        description: passage.description || "",
        audio_asset_id: audioAssetId,
        color: passage.color || "goud",
        page: passage.page,
        x_pct: passage.x_pct,
        y_pct: passage.y_pct,
        width_pct: passage.width_pct,
        height_pct: passage.height_pct,
        sort_order: passage.sort_order ?? 0,
      }),
    });
    console.log(`  passage "${passage.title}"${audioAssetId ? ` -> audio-asset ${audioAssetId}` : " (geen fragment)"}`);
  }
}

async function main() {
  if (TARGET_URL.includes("jouwdomein.nl") || TARGET_ADMIN_PASSWORD.includes("vul-hier")) {
    throw new Error("Vul eerst TARGET_URL en TARGET_ADMIN_PASSWORD bovenaan dit script in.");
  }

  console.log(`Doel: ${TARGET_URL}`);
  await login();

  console.log("Stukken en passages ophalen uit Supabase…");
  const pieces = await fetchSupabase("pieces?select=*,pdf_asset:assets(storage_path)&order=sort_order.asc");
  const passages = await fetchSupabase("passages?select=*,audio_asset:assets(storage_path)");

  for (const piece of pieces) {
    await migratePiece(piece, passages);
  }

  console.log(`\nKlaar — ${pieces.length} stuk(ken) gemigreerd naar ${TARGET_URL}.`);
}

main().catch((err) => {
  console.error("\nMigratie gestopt door een fout:");
  console.error(err.message);
  if (err.cause) {
    console.error("Onderliggende oorzaak:", err.cause.message || err.cause);
  }
  if (err.message === "fetch failed") {
    console.error(
      "\nDit betekent dat de netwerkverbinding zelf mislukte (niet een fout van de server).\n" +
        "Controleer:\n" +
        `  - Klopt TARGET_URL precies? Nu ingesteld als: ${TARGET_URL}\n` +
        "  - Is die URL nu gewoon te openen in je browser?\n" +
        "  - Staat er 'https://' voor (of juist 'http://' als de site nog geen SSL heeft)?\n" +
        "  - Geen slash '/' aan het eind van TARGET_URL?"
    );
  }
  process.exit(1);
});
