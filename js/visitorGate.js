// Simpel wachtwoordschermpje vóór de hele site (overzicht, bladmuziek-
// weergave én beheer) — elke bezoeker, overal (ook op het echte
// productiedomein en bij lokaal draaien), moet dit wachtwoord invoeren
// voordat de pagina zichtbaar wordt. Dit is GEEN echte beveiliging (een
// statische site kan zich niet écht afschermen; iemand die de broncode
// leest komt er sowieso doorheen) — het voorkomt alleen dat de bladmuziek
// zomaar voor iedereen die de link heeft toegankelijk is.
//
// Dit is losstaand van de beheerinlog in admin.html (die geeft
// schrijftoegang via een echte, server-geverifieerde sessie) — dit
// schermpje is er puur om te bekijken.
//
// Gewone (niet-module) <script>, geplaatst vóór alles in <head>, zodat de
// pagina synchroon verborgen kan blijven (via html{visibility:hidden} in
// de HTML zelf) totdat hier beslist is of het wachtwoord al bekend is.
(function () {
  var root = document.documentElement;

  function reveal() {
    root.style.visibility = "visible";
  }

  var STORAGE_KEY = "notenmap-visitor-gate-ok";
  if (localStorage.getItem(STORAGE_KEY) === "1") {
    reveal();
    return;
  }

  // sha256("k00r") — een hash i.p.v. platte tekst zodat het wachtwoord
  // niet letterlijk in de paginabron te lezen is.
  var PASSWORD_HASH = "e9ceb0746b25e34e7d1d64b523369b83dcd89f1587751a6d2434e4c7cf29a7e0";

  function sha256Hex(text) {
    var data = new TextEncoder().encode(text);
    return crypto.subtle.digest("SHA-256", data).then(function (buffer) {
      return Array.prototype.map
        .call(new Uint8Array(buffer), function (b) {
          return b.toString(16).padStart(2, "0");
        })
        .join("");
    });
  }

  function showGate() {
    var overlay = document.createElement("div");
    overlay.id = "visitor-gate-overlay";
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:99999",
      "background:#1c1712",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "padding:20px",
      "font-family:-apple-system,'Segoe UI',Arial,sans-serif",
    ].join(";");

    overlay.innerHTML =
      '<form id="visitor-gate-form" style="' +
      "background:#2a2118;color:#f3e9d8;padding:32px;border-radius:14px;" +
      "width:100%;max-width:320px;box-shadow:0 20px 50px rgba(0,0,0,0.5);" +
      'display:flex;flex-direction:column;gap:14px;text-align:center;">' +
      '<div style="font-size:1.1rem;font-weight:600;">Notenmap</div>' +
      '<p style="margin:0;font-size:0.85rem;color:#b8a488;line-height:1.4;">' +
      "Voer het wachtwoord in om de bladmuziek te bekijken." +
      "</p>" +
      '<input id="visitor-gate-password" type="password" autocomplete="off" autocapitalize="off" ' +
      'style="font:inherit;font-size:0.95rem;padding:10px 12px;border-radius:8px;' +
      'border:1.5px solid rgba(243,233,216,0.25);background:#1c1712;color:#f3e9d8;" />' +
      '<p id="visitor-gate-error" style="display:none;margin:0;color:#d4685a;font-size:0.8rem;">' +
      "Onjuist wachtwoord." +
      "</p>" +
      '<button type="submit" style="font:inherit;font-weight:600;padding:10px 16px;' +
      "border-radius:8px;border:none;background:#c98a3d;color:#1c1712;cursor:pointer;\">" +
      "Ontgrendelen" +
      "</button>";

    document.body.appendChild(overlay);
    // De echte pagina mag getoond worden — de overlay dekt 'm sowieso af
    // totdat het juiste wachtwoord is ingevoerd.
    reveal();

    var input = document.getElementById("visitor-gate-password");
    var error = document.getElementById("visitor-gate-error");
    input.focus();

    document.getElementById("visitor-gate-form").addEventListener("submit", function (e) {
      e.preventDefault();
      if (!window.crypto || !window.crypto.subtle) {
        error.textContent = "Dit werkt alleen via https (of localhost).";
        error.style.display = "block";
        return;
      }
      sha256Hex(input.value).then(function (hash) {
        if (hash === PASSWORD_HASH) {
          localStorage.setItem(STORAGE_KEY, "1");
          overlay.remove();
        } else {
          error.textContent = "Onjuist wachtwoord.";
          error.style.display = "block";
          input.value = "";
          input.focus();
        }
      });
    });
  }

  if (document.body) {
    showGate();
  } else {
    document.addEventListener("DOMContentLoaded", showGate);
  }
})();
