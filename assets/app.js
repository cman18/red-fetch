/* =========================================================
   app.js — Version v1.1.40
   • SAFE auto-version injection
   • Cloudflare Worker Reddit Proxy
   • Packaged-media MP4 support
   • Gallery arrows restored
   • Modal enlarge view
   • GIF/MP4 conversions & Redgifs proxy
   ========================================================= */


/* ---------------------------------------------------------
   SAFE VERSION INJECTION (GitHub Pages compatible)
--------------------------------------------------------- */

(function injectVersionSafe() {
    try {
        const scripts = document.getElementsByTagName("script");
        const lastScript = scripts[scripts.length - 1];

        fetch(lastScript.src)
            .then(r => r.text())
            .then(txt => {
                const firstLine = txt.split("\n")[0];
                const match = firstLine.match(/Version (v[0-9.]+)/);
                if (!match) return;

                const el = document.querySelector("h1");
                if (el) {
                    el.innerHTML = `Red Fetch <span style="color:#83f3df;">${match[1]}</span>`;
                }
            });
    } catch (e) {
        console.warn("Version injection skipped.", e);
    }
})();


/* ---------------------------------------------------------
   DOM references
--------------------------------------------------------- */

const results = document.getElementById("results");
const input
