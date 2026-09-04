// Eén gedeelde Supabase-client voor de hele app (homepage, viewer, beheer).
// Verwacht dat js/vendor/supabase/supabase.js al geladen is als gewoon
// <script>-tag (zet de globale `supabase.createClient` klaar) — zo blijft
// de site vrij van externe CDN's, net als bij pdf.js.
//
// Gebruikt de publieke "anon" key — bedoeld om openbaar te zijn, de
// toegangsregels (RLS/storage policies) in supabase/schema.sql bepalen
// wat daarmee mag.

const SUPABASE_URL = "https://gtwsjpkuyiaxeaqmcvgs.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0d3NqcGt1eWlheGVhcW1jdmdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0OTc3MTQsImV4cCI6MjEwNDA3MzcxNH0.LmMbW4mDdSbM5l52XAWktJdRn-u-45D1lkj83P2xhVU";

// Zonder dit kan de browser een gewone (niet-harde) verversing soms
// beantwoorden met een gecachte data-aanvraag, waardoor bijvoorbeeld
// een net versleepte volgorde niet meteen zichtbaar is.
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: (url, options = {}) => fetch(url, { ...options, cache: "no-store" }),
  },
});

export const PDF_BUCKET = "pdfs";
export const AUDIO_BUCKET = "audio";

export function publicUrlFor(bucket, storagePath) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return data.publicUrl;
}
