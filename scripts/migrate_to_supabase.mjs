#!/usr/bin/env node
// Eenmalig migratiescript: uploadt de bestaande demo-PDF's/mp3's naar
// Supabase Storage en vult de tabellen assets/pieces/passages op basis
// van data/pieces.json + data/passages/<id>.json.
//
// Geen npm-installatie nodig — gebruikt alleen de ingebouwde fetch/fs
// van Node 18+.
//
// Gebruik:  node scripts/migrate_to_supabase.mjs

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const SUPABASE_URL = "https://gtwsjpkuyiaxeaqmcvgs.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0d3NqcGt1eWlheGVhcW1jdmdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0OTc3MTQsImV4cCI6MjEwNDA3MzcxNH0.LmMbW4mDdSbM5l52XAWktJdRn-u-45D1lkj83P2xhVU";

const headersJson = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function insertRow(table, row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: headersJson,
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    throw new Error(`Insert in ${table} mislukt (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data[0];
}

async function uploadFile(bucket, storagePath, filePath, mimeType) {
  const bytes = readFileSync(filePath);
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURIComponent(storagePath).replace(/%2F/g, "/")}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": mimeType,
        "x-upsert": "true",
      },
      body: bytes,
    }
  );
  if (!res.ok) {
    throw new Error(`Upload naar ${bucket}/${storagePath} mislukt (${res.status}): ${await res.text()}`);
  }
  return bytes.length;
}

async function migratePiece(piece) {
  console.log(`\n== ${piece.title} (${piece.id}) ==`);

  // PDF
  const pdfLocalPath = path.join(ROOT, piece.pdf);
  const pdfStoragePath = `${piece.id}/${path.basename(pdfLocalPath)}`;
  const pdfSize = await uploadFile("pdfs", pdfStoragePath, pdfLocalPath, "application/pdf");
  const pdfAsset = await insertRow("assets", {
    type: "pdf",
    filename: path.basename(pdfLocalPath),
    storage_path: pdfStoragePath,
    mime_type: "application/pdf",
    size_bytes: pdfSize,
  });
  console.log(`  PDF geupload (${pdfSize} bytes) -> asset ${pdfAsset.id}`);

  await insertRow("pieces", {
    id: piece.id,
    title: piece.title,
    composer: piece.composer,
    genre: piece.genre,
    voices: piece.voices,
    solo: piece.solo,
    pdf_asset_id: pdfAsset.id,
  });
  console.log(`  piece-rij aangemaakt`);

  // Passages
  const passagesPath = path.join(ROOT, piece.passagesData);
  const passages = JSON.parse(readFileSync(passagesPath, "utf8"));

  let sortOrder = 0;
  for (const passage of passages) {
    const audioLocalPath = path.join(ROOT, passage.audio);
    const audioStoragePath = `${piece.id}/${path.basename(audioLocalPath)}`;
    const audioSize = await uploadFile("audio", audioStoragePath, audioLocalPath, "audio/mpeg");
    const audioAsset = await insertRow("assets", {
      type: "audio",
      filename: path.basename(audioLocalPath),
      storage_path: audioStoragePath,
      mime_type: "audio/mpeg",
      size_bytes: audioSize,
    });

    await insertRow("passages", {
      piece_id: piece.id,
      title: passage.title,
      description: passage.description,
      audio_asset_id: audioAsset.id,
      page: passage.page,
      x_pct: passage.xPct,
      y_pct: passage.yPct,
      width_pct: passage.widthPct,
      height_pct: passage.heightPct,
      sort_order: sortOrder++,
    });
    console.log(`  passage "${passage.title}" -> audio-asset ${audioAsset.id}`);
  }
}

async function main() {
  const pieces = JSON.parse(readFileSync(path.join(ROOT, "data", "pieces.json"), "utf8"));
  for (const piece of pieces) {
    await migratePiece(piece);
  }
  console.log("\nKlaar — alle stukken gemigreerd naar Supabase.");
}

main().catch((err) => {
  console.error("\nMigratie gestopt door een fout:");
  console.error(err.message);
  process.exit(1);
});
