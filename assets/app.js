/* =========================================================
   app.js — Version v1.1.45
   • Fixed Reddit gallery parsing (no more black images)
   • Fixed preview.redd.it → i.redd.it conversion
   • Removed tracking params from gallery images
   • Fully compatible with your existing UI
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
const scrollTopBtn = document.getElementById("scrollTopBtn");
const modeSelect = document.getElementById("modeSelect");

const REDGIFS_PROXY = "https://red.coffeemanhou.workers.dev/?id=";

/* ---------------------------------------------------------
   Global State
--------------------------------------------------------- */

let currentUser = null;
let afterToken = null;
let loadingMore = false;
let forcedMode = "3";

const seenPostURLs = new Set();

/* ---------------------------------------------------------
   Helpers: Username extractor
--------------------------------------------------------- */

function extractUsername(text) {
    if (!text) return null;
    text = text.trim();

    let m = text.match(/\/u\/([^\/]+)/i);
    if (m) return m[1];

    m = text.match(/\bu\/([A-Za-z0-9_-]+)/i);
    if (m) return m[1];

    m = text.match(/reddit\.com\/user\/([^\/]+)/i);
    if (m) return m[1];

    if (/^[A-Za-z0-9_-]{2,30}$/.test(text)) return text;

    return null;
}

/* ---------------------------------------------------------
   Column Toggle
--------------------------------------------------------- */

function applyColumnMode() {
    results.classList.remove("force-2-cols", "force-3-cols");
    if (forcedMode === "2") {
        results.classList.add("force-2-cols");
        colToggleBtn.textContent = "Columns: 2";
    } else {
        results.classList.add("force-3-cols");
        colToggleBtn.textContent = "Columns: 3";
    }
}

colToggleBtn.onclick = () => {
    forcedMode = forcedMode === "3" ? "2" : "3";
    applyColumnMode();
};

/* ---------------------------------------------------------
   Redgifs
--------------------------------------------------------- */

function isRedgifsURL(url) {
    return url && url.includes("redgifs.com");
}

function extractRedgifsSlug(url) {
    if (!url) return null;

    try {
        if (url.includes("out.reddit.com")) {
            const dest = new URL(url).searchParams.get("url");
            if (dest) url = dest;
        }
    } catch {}

    const patterns = [
        /redgifs\.com\/watch\/([A-Za-z0-9]+)/,
        /redgifs\.com\/ifr\/([A-Za-z0-9]+)/,
        /redgifs\.com\/([A-Za-z0-9]+)$/
    ];

    for (const p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
    }
    return null;
}

async function fetchRedgifsMP4(url) {
    const slug = extractRedgifsSlug(url);
    if (!slug) return null;

    try {
        const res = await fetch(REDGIFS_PROXY + slug);
        if (!res.ok) return null;
        const json = await res.json();

        return json.mp4 || null;
    } catch {
        return null;
    }
}

/* ---------------------------------------------------------
   GIF Conversions
--------------------------------------------------------- */

function isGif(url) {
    return (
        url &&
        (url.endsWith(".gif") ||
            url.endsWith(".gifv") ||
            url.includes("gfycat") ||
            url.includes("gif"))
    );
}

function convertGifToMP4(url) {
    if (!url) return null;

    if (url.includes("i.imgur.com"))
        return url.replace(".gifv", ".mp4").replace(".gif", ".mp4");

    if (url.includes("gfycat.com")) {
        const id = url.split("/").pop().split("-")[0];
        return `https://giant.gfycat.com/${id}.mp4`;
    }

    if (url.endsWith(".gifv")) return url.replace(".gifv", ".mp4");
    if (url.endsWith(".gif")) return url.replace(".gif", ".mp4");

    return null;
}

/* ---------------------------------------------------------
   Title toggle
--------------------------------------------------------- */

function setupTitleBehavior(el) {
    const txt = el.textContent.trim();
    if (!txt) return;

    const m = document.createElement("div");
    m.style.position = "absolute";
    m.style.visibility = "hidden";
    m.style.whiteSpace = "nowrap";
    m.textContent = txt;
    document.body.appendChild(m);

    if (m.clientWidth > el.clientWidth) {
        const arrow = document.createElement("span");
        arrow.className = "title-arrow";
        arrow.textContent = "⌄";
        el.appendChild(arrow);

        arrow.onclick = (e) => {
            e.stopPropagation();
            const exp = el.classList.toggle("full");
            arrow.textContent = exp ? "⌃" : "⌄";
            el.style.whiteSpace = exp ? "normal" : "nowrap";
        };
    }

    m.remove();
}

/* ---------------------------------------------------------
   Gallery parsing — FIXED
--------------------------------------------------------- */

function extractGalleryURL(meta) {
    if (!meta) return null;

    let src = null;

    if (meta.s) {
        src = meta.s.u || meta.s.mp4 || meta.s.gif;
    }

    if (!src && meta.p?.length) {
        src = meta.p[meta.p.length - 1].u;
    }

    if (!src) return null;

    src = src.replace(/&amp;/g, "&");

    // Convert preview.redd.it → i.redd.it
    src = src.replace(/preview\.redd\.it/g, "i.redd.it");

    // Remove query params that break images
    src = src.replace(/\?.*$/, "");

    return src;
}

/* ---------------------------------------------------------
   Rendering posts
--------------------------------------------------------- */

async function renderPost(post) {
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

    const url = post.url || "";

    /* --- GALLERY FIXED --- */
    if (post.is_gallery && post.media_metadata && post.gallery_data) {
        const ids = post.gallery_data.items.map(i => i.media_id);

        const sources = ids
            .map(id => extractGalleryURL(post.media_metadata[id]))
            .filter(Boolean);

        if (sources.length) {
            renderGallery(box, wrap, sources, post, titleDiv);
            return;
        }
    }

    /* IMAGES */
    if (url.match(/\.(jpg|jpeg|png|webp)$/i)) {
        appendMedia(box, wrap, url, "image", post, titleDiv);
        return;
    }

    /* REDGIFS */
    if (isRedgifsURL(url)) {
        const mp4 = await fetchRedgifsMP4(url);
        if (mp4) {
            appendMedia(box, wrap, mp4, "gif", post, titleDiv);
            return;
        }
    }

    /* GIF */
    if (isGif(url)) {
        const mp4 = convertGifToMP4(url);
        if (mp4) {
            appendMedia(box, wrap, mp4, "gif", post, titleDiv);
            return;
        }
    }

    /* REDDIT VIDEO */
    if (post.is_video && post.media?.reddit_video?.fallback_url) {
        appendMedia(
            box,
            wrap,
            post.media.reddit_video.fallback_url,
            "video",
            post,
            titleDiv
        );
        return;
    }

    /* TEXT POST */
    renderTextFallback(post);
}

/* ---------------------------------------------------------
   appendMedia
--------------------------------------------------------- */

function createImage(src) {
    const el = document.createElement("img");
    el.src = src;
    return el;
}

function createVideo(src, auto) {
    const v = document.createElement("video");
    v.src = src;
    v.autoplay = auto;
    v.loop = auto;
    v.muted = auto;
    v.controls = !auto;
    return v;
}

function appendMedia(box, wrap, src, type, post, titleDiv) {
    const el =
        type === "image"
            ? createImage(src)
            : createVideo(src, type === "gif");

    el.style.cursor = "pointer";
    el.onclick = () => openLargeView(src);

    box.appendChild(el);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.innerHTML = `<a href="${post.url}" target="_blank">${post.url}</a>`;

    wrap.appendChild(box);
    wrap.appendChild(urlLine);

    setupTitleBehavior(titleDiv);
    results.appendChild(wrap);
}

/* ---------------------------------------------------------
   Gallery renderer
--------------------------------------------------------- */

function renderGallery(box, wrap, sources, post, titleDiv) {
    let idx = 0;

    const img = document.createElement("img");
    img.src = sources[idx];
    img.style.cursor = "pointer";
    img.onclick = () => openLargeView(sources[idx]);

    const left = document.createElement("div");
    left.className = "gallery-arrow-main gallery-arrow-main-left";
    left.textContent = "<";

    const right = document.createElement("div");
    right.className = "gallery-arrow-main gallery-arrow-main-right";
    right.textContent = ">";

    const update = () => {
        img.src = sources[idx];
    };

    left.onclick = (e) => {
        e.stopPropagation();
        idx = (idx - 1 + sources.length) % sources.length;
        update();
    };

    right.onclick = (e) => {
        e.stopPropagation();
        idx = (idx + 1) % sources.length;
        update();
    };

    box.appendChild(img);
    box.appendChild(left);
    box.appendChild(right);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.innerHTML = `<a href="${post.url}" target="_blank">${post.url}</a>`;
    wrap.appendChild(box);
    wrap.appendChild(urlLine);

    setupTitleBehavior(titleDiv);
    results.appendChild(wrap);
}

/* ---------------------------------------------------------
   Large View (modal)
--------------------------------------------------------- */

function openLargeView(src) {
    const modal = document.createElement("div");
    modal.className = "large-view";

    let el;
    if (src.endsWith(".mp4")) {
        el = document.createElement("video");
        el.src = src;
        el.controls = true;
        el.autoplay = true;
        el.loop = true;
        el.muted = false;
    } else {
        el = document.createElement("img");
        el.src = src;
    }

    modal.appendChild(el);

    const closeBtn = document.createElement("div");
    closeBtn.className = "large-view-close";
    closeBtn.textContent = "✕";
    closeBtn.onclick = () => modal.remove();

    modal.appendChild(closeBtn);
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };

    document.body.appendChild(modal);
}

/* ---------------------------------------------------------
   Text fallback
--------------------------------------------------------- */

function renderTextFallback(post) {
    const wrap = document.createElement("div");
    wrap.className = "post";

    const titleDiv = document.createElement("div");
    titleDiv.className = "post-title";
    titleDiv.textContent = post.title || "";

    const box = document.createElement("div");
    box.className = "tile-media";

    const ph = document.createElement("div");
    ph.className = "placeholder-media";
    ph.textContent = "Text Post";

    box.appendChild(ph);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.innerHTML = `<a href="${post.url}" target="_blank">${post.url}</a>`;

    wrap.appendChild(titleDiv);
    wrap.appendChild(box);
    wrap.appendChild(urlLine);

    setupTitleBehavior(titleDiv);
    results.appendChild(wrap);
}

/* ---------------------------------------------------------
   Scroll-to-top
--------------------------------------------------------- */

scrollTopBtn.onclick = () =>
    window.scrollTo({ top: 0, behavior: "smooth" });

/* ---------------------------------------------------------
   Infinite Scroll
--------------------------------------------------------- */

async function loadMore() {
    if (loadingMore || !afterToken || !currentUser) return;
    loadingMore = true;

    try {
        const url =
            modeSelect.value === "u"
                ? `https://api.reddit.com/user/${currentUser}/submitted?raw_json=1&after=${afterToken}`
                : `https://api.reddit.com/r/${currentUser}/hot?raw_json=1&after=${afterToken}`;

        const res = await fetch(url);
        if (!res.ok) return;

        const data = await res.json();
        afterToken = data.data.after;

        for (const child of data.data.children) {
            await renderPost(child.data);
        }
    } catch {}

    loadingMore = false;
}

window.addEventListener("scroll", async () => {
    const near =
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 1200;

    if (near) await loadMore();
});

/* ---------------------------------------------------------
   Load Button
--------------------------------------------------------- */

loadBtn.onclick = async () => {
    results.innerHTML = "";
    seenPostURLs.clear();
    afterToken = null;
    currentUser = null;

    const raw = input.value.trim();

    if (!raw) {
        results.innerHTML = `<div class="post">No input provided.</div>`;
        return;
    }

    if (modeSelect.value === "u") {
        const user = extractUsername(raw);
        if (!user) {
            results.innerHTML =
                `<div class="post">Invalid username or URL.</div>`;
            return;
        }
        currentUser = user;
    } else {
        currentUser = raw.replace(/[^A-Za-z0-9_+]/g, "");
    }

    try {
        const url =
            modeSelect.value === "u"
                ? `https://api.reddit.com/user/${currentUser}/submitted?raw_json=1`
                : `https://api.reddit.com/r/${currentUser}/hot?raw_json=1`;

        const res = await fetch(url);
        if (!res.ok) throw new Error();

        const data = await res.json();
        afterToken = data.data.after;

        for (const child of data.data.children) {
            await renderPost(child.data);
        }
    } catch {
        results.innerHTML = `<div class="post">Failed loading posts.</div>`;
    }
};

/* ---------------------------------------------------------
   Buttons
--------------------------------------------------------- */

clearBtn.onclick = () => {
    input.value = "";
    results.innerHTML = "";
    seenPostURLs.clear();
    afterToken = null;
    currentUser = null;
};

copyBtn.onclick = () =>
    navigator.clipboard.writeText(input.value.trim());

zipBtn.onclick = () =>
    alert("ZIP downloads coming later");

/* END v1.1.45 */
