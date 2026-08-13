const STORAGE_KEY = "aura:chunk-recovery";

export function createChunkRecoveryScript(releaseId) {
  const release = JSON.stringify(String(releaseId || "unknown"));
  const storageKey = JSON.stringify(STORAGE_KEY);
  return `
(function () {
  var RELEASE = ${release};
  var STORAGE_KEY = ${storageKey};

  function describesChunkFailure(value) {
    var text = "";
    try {
      text = String(value && (value.message || value.name || value.stack) || value || "");
    } catch (_) {}
    return /ChunkLoadError|Loading chunk [^ ]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(text);
  }

  function isChunkFailure(event) {
    var target = event && event.target;
    var source = target && (target.src || target.href) || "";
    return describesChunkFailure(event && event.error) ||
      describesChunkFailure(event && event.reason) ||
      describesChunkFailure(event && event.message) ||
      /\\/_next\\/static\\/(?:chunks|css)\\//i.test(String(source));
  }

  function mountFallback() {
    function mount() {
      if (!document.body || document.getElementById("aura-chunk-fallback")) return;
      var panel = document.createElement("section");
      panel.id = "aura-chunk-fallback";
      panel.setAttribute("role", "alertdialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-labelledby", "aura-chunk-fallback-title");
      panel.innerHTML = '<div style="width:min(32rem,calc(100% - 2rem));border:1px solid rgba(24,37,32,.18);border-radius:1.25rem;background:#f7f5ee;box-shadow:0 1.5rem 5rem rgba(14,28,22,.2);padding:clamp(1.5rem,5vw,2.5rem);color:#15241d;font-family:Manrope,system-ui,sans-serif"><p style="margin:0 0 .7rem;font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;color:#08785f">Aura Homes</p><h1 id="aura-chunk-fallback-title" style="margin:0;font-size:clamp(1.55rem,5vw,2.25rem);line-height:1.05;letter-spacing:-.035em">Aura updated while this page was open.</h1><p style="margin:1rem 0 1.25rem;max-width:38rem;font-size:.95rem;line-height:1.6;color:rgba(21,36,29,.72)">Your locally saved project is still on this device. Reload to connect this page to the current interactive release.</p><button data-aura-retry type="button" style="min-height:2.75rem;border:0;border-radius:999px;background:#08785f;color:white;padding:.7rem 1.15rem;font:600 .88rem Manrope,system-ui,sans-serif;cursor:pointer">Reload Aura</button></div>';
      panel.setAttribute("style", "position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(239,239,231,.9);padding:1rem;backdrop-filter:blur(10px)");
      document.documentElement.setAttribute("data-aura-static-fallback", "true");
      document.body.appendChild(panel);
      var retry = panel.querySelector("[data-aura-retry]");
      if (retry) retry.addEventListener("click", function () {
        try { window.sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
        window.location.reload();
      });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
    else mount();
  }

  function recover(event) {
    if (!isChunkFailure(event)) return;
    var alreadyTried = true;
    try {
      alreadyTried = window.sessionStorage.getItem(STORAGE_KEY) === RELEASE;
      if (!alreadyTried) window.sessionStorage.setItem(STORAGE_KEY, RELEASE);
    } catch (_) {}
    if (!alreadyTried) window.location.reload();
    else mountFallback();
  }

  window.addEventListener("error", recover, true);
  window.addEventListener("unhandledrejection", recover);
})();`.trim();
}
