#!/usr/bin/env node
// Eenmalig opschoonscript: zet PDF's die nog "plat" in de pdfs-bucket
// staan (van vóór de mapstructuur-per-stuk) om naar `<stuk-id>/<bestand>`,
// en werkt de assets-tabel bij. Mp3's stonden al in zo'n submap.
//
// Geen npm-installatie nodig — gebruikt alleen de ingebouwde fetch van
// Node 18+.
//
// Gebruik:  node scripts/reorganize_pdf_paths.mjs

const SUPABASE_URL = "https://gtwsjpkuyiaxeaqmcvgs.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0d3NqcGt1eWlheGVhcW1jdmdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0OTc3MTQsImV4cCI6MjEwNDA3MzcxNH0.LmMbW4mDdSbM5l52XAWktJdRn-u-45D1lkj83P2xhVU";

const headersJson = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function selectAll(table, query = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, { headers: headersJson });
  if (!res.ok) throw new Error(`Ophalen van ${table} mislukt (${res.status}): ${await res.text()}`);
  return res.json();
}

async function main() {
  const pdfAssets = await selectAll("assets", "?type=eq.pdf");
  const pieces = await selectAll("pieces");
  const pieceByPdfAsset = new Map(pieces.filter((p) => p.pdf_asset_id).map((p) => [p.pdf_asset_id, p]));

  let moved = 0;
  for (const asset of pdfAssets) {
    if (asset.storage_path.includes("/")) {
      console.log(`Overslaan: "${asset.filename}" staat al in een map.`);
      continue;
    }
    const piece = pieceByPdfAsset.get(asset.id);
    if (!piece) {
      console.log(`Overslaan: "${asset.filename}" hoort bij geen enkel stuk.`);
      continue;
    }

    const newPath = `${piece.id}/${asset.filename}`;
    console.log(`\n${asset.storage_path}  ->  ${newPath}`);

    console.log("  downloaden…");
    const downloadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/public/pdfs/${asset.storage_path}`);
    if (!downloadRes.ok) throw new Error(`Download mislukt (${downloadRes.status})`);
    const bytes = Buffer.from(await downloadRes.arrayBuffer());

    console.log("  uploaden naar nieuwe plek…");
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/pdfs/${newPath}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/pdf",
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!uploadRes.ok) throw new Error(`Upload mislukt (${uploadRes.status}): ${await uploadRes.text()}`);

    console.log("  database bijwerken…");
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/assets?id=eq.${asset.id}`, {
      method: "PATCH",
      headers: headersJson,
      body: JSON.stringify({ storage_path: newPath }),
    });
    if (!patchRes.ok) throw new Error(`Database bijwerken mislukt (${patchRes.status}): ${await patchRes.text()}`);

    console.log("  oud bestand opruimen…");
    const removeRes = await fetch(`${SUPABASE_URL}/storage/v1/object/remove/pdfs`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: [asset.storage_path] }),
    });
    if (!removeRes.ok) {
      console.warn(`  Waarschuwing: oud bestand kon niet verwijderd worden (${removeRes.status})`);
    }

    console.log("  klaar.");
    moved++;
  }

  console.log(`\n${moved} PDF('s) verplaatst naar een map per stuk.`);
}

main().catch((err) => {
  console.error("\nGestopt door een fout:");
  console.error(err.message);
  process.exit(1);
});
