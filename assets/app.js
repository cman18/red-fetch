/* =========================================================
   app.js — Version v1.1.50
   • Fully fixed gallery extraction (universal extractor)
   • Supports ALL Reddit formats: s, p, o, x, gif, mp4, etc
   • Fixes black tiles / Text Post on gallery items
   • No UI changes
   ========================================================= */

/* ---------------------------------------------------------
   DOM references
--------------------------------------------------------- */
const results = document.getElementById("results");
const input = document.getElementById("input");
const loadBtn = document.getElementById("loadBtn");
const clearBtn = document.getElementById("clearBtn");
const copyBtn = document.getElementById("copyBtn");
const zipBtn = document.getElementById("zipBtn");
const colToggleBtn = document.getElementById("colToggleBtn");

const imagesChk = document.getElementById("imagesChk");
const videosChk = document.getElementById("videosChk");
const otherChk = document.getElementById("otherChk");

const scrollTopBtn = document.getElementById("scrollTopBtn");
const modeSelect = document.getElementById("modeSelect");

/* ---------------------------------------------------------
   Global state
--------------------------------------------------------- */
let currentTarget = null;
let afterToken = null;
let loadingMore = false;

const seenPostURLs = new Set();

/* ---------------------------------------------------------
   Universal Gallery Extractor
   Handles ALL Reddit formats
--------------------------------------------------------- */
function extractBestURL(meta) {
    if (!meta) return null;

    // Modern format
    if (meta.s?.u) return fixUrl(meta.s.u);
    if (meta.s?.gif) return fixUrl(meta.s.gif);
    if (meta.s?.mp4) return fixUrl(meta.s.mp4);

    // Preview list p[]
    if (meta.p?.length) {
        const last = meta.p[meta.p.length - 1];
        if (last?.u) return fixUrl(last.u);
    }

    // Original list o[]
    if (meta.o?.length) {
        const last = meta.o[meta.o.length - 1];
        if (last?.u) return fixUrl(last.u);
    }

    // Find ANY URL inside object
    for (const key in meta) {
        const val = meta[key];
        if (typeof val === "string" && val.includes("http")) {
            return fixUrl(val);
        }
        if (val && typeof val === "object") {
            for (const k2 in val) {
                if (typeof val[k2] === "string" && val[k2].includes("http")) {
                    return fixUrl(val[k2]);
                }
            }
        }
    }

    return null;
}

/* ---------------------------------------------------------
   URL cleaner
--------------------------------------------------------- */
function fixUrl(u) {
    if (!u) return null;
    u = u.replace(/&amp;/g, "&");

    if (u.includes("preview.redd.it")) {
        u = u.replace("preview.redd.it", "i.redd.it");
    }

    // Remove size parameters
    u = u.split("?")[0];

    return u;
}

/* ---------------------------------------------------------
   Video / GIF conversion
--------------------------------------------------------- */
function convertGifToMP4(url) {
    if (!url) return null;

    if (url.includes("i.imgur.com")) {
        return url.replace(".gifv", ".mp4").replace(".gif", ".mp4");
    }

    if (url.endsWith(".gifv")) return url.replace(".gifv", ".mp4");
    if (url.endsWith(".gif")) return url.replace(".gif", ".mp4");

    return null;
}

/* ---------------------------------------------------------
   Rendering
--------------------------------------------------------- */
async function renderPost(post) {
    if (!post || !post.url) return;

    if (seenPostURLs.has(post.url)) return;
    seenPostURLs.add(post.url);

    const wrap = document.createElement("div");
    wrap.className = "post";

    const titleDiv = document.createElement("div");
    titleDiv.className = "post-title";
    titleDiv.textContent = post.title || "";
    wrap.appendChild(titleDiv);

    const box = document.createElement("div");
    box.className = "tile-media";

    const url = post.url;

    /* Gallery */
    if (post.is_gallery && post.media_metadata) {
        const ids = post.gallery_data.items.map(i => i.media_id);

        const sources = ids.map(id => extractBestURL(post.media_metadata[id]))
                           .filter(Boolean);

        if (!sources.length) {
            box.innerHTML = `<div class="placeholder-media">Gallery Error</div>`;
            wrap.appendChild(box);
            addUrl(wrap, url);
            results.appendChild(wrap);
            return;
        }

        renderGallery(box, wrap, sources, post);
        return;
    }

    /* Image */
    if (url.match(/\.(jpg|jpeg|png|webp)$/i)) {
        appendMedia(box, wrap, url, "image", post);
        return;
    }

    /* GIF / GIFV */
    if (url.includes(".gif") || url.includes(".gifv")) {
        const mp4 = convertGifToMP4(url);
        if (mp4) {
            appendMedia(box, wrap, mp4, "gif", post);
            return;
        }
    }

    /* Reddit Video */
    if (post.is_video && post.media?.reddit_video?.fallback_url) {
        appendMedia(box, wrap, post.media.reddit_video.fallback_url, "video", post);
        return;
    }

    /* Otherwise text */
    appendTextPost(wrap, post);
}

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */
function addUrl(wrap, url) {
    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.innerHTML = `<a href="${url}" target="_blank">${url}</a>`;
    wrap.appendChild(urlLine);
}

function appendTextPost(wrap, post) {
    const box = document.createElement("div");
    box.className = "tile-media";
    box.innerHTML = `<div class="placeholder-media">Text Post</div>`;
    wrap.appendChild(box);
    addUrl(wrap, post.url);
    results.appendChild(wrap);
}

/* ---------------------------------------------------------
   Image / Video / GIF Renderer
--------------------------------------------------------- */
function appendMedia(box, wrap, src, type, post) {
    let el;
    if (type === "image") {
        el = document.createElement("img");
        el.src = src;
    } else {
        el = document.createElement("video");
        el.src = src;
        el.autoplay = type === "gif";
        el.loop = type === "gif";
        el.muted = type === "gif";
        el.controls = true;
    }

    el.style.cursor = "pointer";
    el.onclick = () => openLarge(src);

    box.appendChild(el);
    wrap.appendChild(box);
    addUrl(wrap, post.url);
    results.appendChild(wrap);
}

/* ---------------------------------------------------------
   Large View
--------------------------------------------------------- */
function openLarge(src) {
    const modal = document.createElement("div");
    modal.className = "large-view";

    let el;
    if (src.endsWith(".mp4")) {
        el = document.createElement("video");
        el.src = src;
        el.controls = true;
        el.autoplay = true;
        el.loop = true;
    } else {
        el = document.createElement("img");
        el.src = src;
    }

    modal.appendChild(el);

    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
}

/* ---------------------------------------------------------
   Gallery Renderer
--------------------------------------------------------- */
function renderGallery(box, wrap, sources, post) {
    let idx = 0;

    const img = document.createElement("img");
    img.src = sources[0];
    img.style.cursor = "pointer";
    img.onclick = () => openLarge(sources[idx]);

    const left = document.createElement("div");
    left.className = "gallery-arrow-main gallery-arrow-main-left";
    left.textContent = "<";

    const right = document.createElement("div");
    right.className = "gallery-arrow-main gallery-arrow-main-right";
    right.textContent = ">";

    const update = () => { img.src = sources[idx]; };

    left.onclick = (e) => { e.stopPropagation(); idx = (idx - 1 + sources.length) % sources.length; update(); };
    right.onclick = (e) => { e.stopPropagation(); idx = (idx + 1) % sources.length; update(); };

    box.appendChild(img);
    box.appendChild(left);
    box.appendChild(right);

    wrap.appendChild(box);
    addUrl(wrap, post.url);
    results.appendChild(wrap);
}

/* ---------------------------------------------------------
   Load Posts
--------------------------------------------------------- */
loadBtn.onclick = async () => {
    results.innerHTML = "";
    seenPostURLs.clear();
    afterToken = null;

    const mode = modeSelect.value;
    const value = input.value.trim();

    if (!value) return;

    let target;
    if (mode === "u") target = `https://api.reddit.com/user/${value}/submitted?raw_json=1`;
    else target = `https://api.reddit.com/r/${value}/hot?raw_json=1`;

    currentTarget = target;

    try {
        const res = await fetch(target);
        const data = await res.json();

        afterToken = data.data.after;

        for (const child of data.data.children) {
            await renderPost(child.data);
        }
    } catch (e) {
        results.innerHTML = `<div class="post">Failed loading posts</div>`;
    }
};

/* ---------------------------------------------------------
   Infinite Scroll
--------------------------------------------------------- */
window.addEventListener("scroll", async () => {
    if (loadingMore || !afterToken) return;

    const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 1200;
    if (!nearBottom) return;

    loadingMore = true;

    const next = currentTarget + "&after=" + afterToken;

    try {
        const res = await fetch(next);
        const data = await res.json();

        afterToken = data.data.after;

        for (const child of data.data.children) {
            await renderPost(child.data);
        }
    } catch {}

    loadingMore = false;
});

/* ---------------------------------------------------------
   Buttons
--------------------------------------------------------- */
clearBtn.onclick = () => { input.value = ""; results.innerHTML = ""; };
copyBtn.onclick = () => navigator.clipboard.writeText(input.value.trim());
zipBtn.onclick = () => alert("ZIP coming soon");
scrollTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });

