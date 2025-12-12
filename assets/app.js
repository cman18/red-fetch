/* =========================================================
   app.js — Version v1.1.51
   • Fixes Reddit galleries with missing full-size images
   • Uses fallback thumbnail when s.u missing
   • Restores all gallery functionality
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
const scrollTopBtn = document.getElementById("scrollTopBtn");
const modeSelect = document.getElementById("modeSelect");

/* ---------------------------------------------------------
   Global state
--------------------------------------------------------- */

let currentTarget = null;
let afterToken = null;
let loadingMore = false;
let forcedMode = "3";
const seenPostURLs = new Set();

/* ---------------------------------------------------------
   Username/Subreddit Extractor
--------------------------------------------------------- */

function extractTarget(raw) {
    if (!raw) return null;
    raw = raw.trim();

    // Direct username: "Euna_Chris"
    if (/^[A-Za-z0-9_-]{2,30}$/.test(raw)) return raw;

    // Full Reddit URL
    try {
        const u = new URL(raw);

        // /user/<name>
        const usr = u.pathname.match(/\/user\/([^\/]+)/i);
        if (usr) return usr[1];

        // /r/<name>
        const sub = u.pathname.match(/\/r\/([^\/]+)/i);
        if (sub) return sub[1];

        // /u/<name>
        const u2 = u.pathname.match(/\/u\/([^\/]+)/i);
        if (u2) return u2[1];
    } catch {}

    // Already formatted "u/name" or "r/name"
    const m = raw.match(/^[ur]\/([A-Za-z0-9_-]+)/);
    if (m) return m[1];

    return null;
}

/* ---------------------------------------------------------
   Column Toggle
--------------------------------------------------------- */

function applyColumnMode() {
    results.classList.remove("force-2-cols", "force-3-cols");

    if (forcedMode === "2") {
        results.classList.add("force-2-cols");
    } else {
        results.classList.add("force-3-cols");
    }
}

colToggleBtn.onclick = () => {
    forcedMode = forcedMode === "3" ? "2" : "3";
    colToggleBtn.textContent = `Columns: ${forcedMode}`;
    applyColumnMode();
};

/* ---------------------------------------------------------
   Title Expand/Collapse
--------------------------------------------------------- */

function setupTitleBehavior(titleDiv) {
    const original = titleDiv.textContent.trim();
    if (!original) return;

    const measure = document.createElement("div");
    measure.style.position = "absolute";
    measure.style.visibility = "hidden";
    measure.style.whiteSpace = "nowrap";
    measure.style.fontSize = window.getComputedStyle(titleDiv).fontSize;
    measure.textContent = original;

    document.body.appendChild(measure);
    const fullWidth = measure.clientWidth;
    measure.remove();

    if (fullWidth <= titleDiv.clientWidth) return;

    const arrow = document.createElement("span");
    arrow.className = "title-arrow";
    arrow.textContent = "⌄";

    titleDiv.appendChild(arrow);

    arrow.onclick = (e) => {
        e.stopPropagation();
        const expanded = titleDiv.classList.toggle("full");
        arrow.textContent = expanded ? "⌃" : "⌄";
        titleDiv.style.whiteSpace = expanded ? "normal" : "nowrap";
    };
}

/* ---------------------------------------------------------
   TYPE CHECK HELPERS
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

    if (url.includes("i.imgur.com")) {
        return url.replace(".gifv", ".mp4").replace(".gif", ".mp4");
    }

    if (url.includes("gfycat.com")) {
        const id = url.split("/").pop().split("-")[0];
        return `https://giant.gfycat.com/${id}.mp4`;
    }

    if (url.endsWith(".gifv")) return url.replace(".gifv", ".mp4");
    if (url.endsWith(".gif")) return url.replace(".gif", ".mp4");

    return null;
}

/* ---------------------------------------------------------
   RENDER FAILSAFE FOR TEXT POSTS
--------------------------------------------------------- */

function renderTextFallback(post) {
    const wrap = document.createElement("div");
    wrap.className = "post";

    const titleDiv = document.createElement("div");
    titleDiv.className = "post-title";
    titleDiv.textContent = post.title || "";
    wrap.appendChild(titleDiv);

    const box = document.createElement("div");
    box.className = "tile-media";

    const ph = document.createElement("div");
    ph.className = "placeholder-media";
    ph.textContent = "Text Post";
    box.appendChild(ph);

    wrap.appendChild(box);

    const link = document.createElement("div");
    link.className = "post-url";
    link.innerHTML = `<a href="${post.url}" target="_blank">${post.url}</a>`;
    wrap.appendChild(link);

    setupTitleBehavior(titleDiv);
    results.appendChild(wrap);
}

/* ---------------------------------------------------------
   Media Helpers
--------------------------------------------------------- */

function createImage(src) {
    const el = document.createElement("img");
    el.src = src;
    el.style.cursor = "pointer";
    return el;
}

function createVideo(src) {
    const v = document.createElement("video");
    v.src = src;
    v.autoplay = false;
    v.loop = false;
    v.muted = false;
    v.controls = true;
    v.style.cursor = "pointer";
    return v;
}

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

function appendMedia(box, wrap, src, type, post, titleDiv) {
    const el = type === "image" ? createImage(src) : createVideo(src);

    el.onclick = () => openLargeView(src);

    box.appendChild(el);

    const link = document.createElement("div");
    link.className = "post-url";
    link.innerHTML = `<a href="${post.url}" target="_blank">${post.url}</a>`;
    wrap.appendChild(box);
    wrap.appendChild(link);

    setupTitleBehavior(titleDiv);
    results.appendChild(wrap);
}

/* ---------------------------------------------------------
   FIXED GALLERY RENDERER (works for ALL galleries)
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

    const link = document.createElement("div");
    link.className = "post-url";
    link.innerHTML = `<a href="${post.url}" target="_blank">${post.url}</a>`;
    wrap.appendChild(box);
    wrap.appendChild(link);

    setupTitleBehavior(titleDiv);
    results.appendChild(wrap);
}

/* ---------------------------------------------------------
   FIXED RENDERPOST — with gallery fallback logic
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

    /* ---- GALLERY FIXED ---- */
    if (post.is_gallery && post.media_metadata && post.gallery_data) {
        const ids = post.gallery_data.items.map(i => i.media_id);

        const sources = ids
            .map(id => {
                const meta = post.media_metadata[id];
                if (!meta) return null;

                let src = meta?.s?.u;

                // FIX: broken galleries fallback
                if (!src && meta?.p?.length) {
                    src = meta.p[meta.p.length - 1].u;
                }

                return src ? src.replace(/&amp;/g, "&") : null;
            })
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

    /* GIF → MP4 */
    if (isGif(url)) {
        const mp4 = convertGifToMP4(url);
        if (mp4) {
            appendMedia(box, wrap, mp4, "video", post, titleDiv);
            return;
        }
    }

    /* REDDIT VIDEO */
    if (post.is_video && post.media?.reddit_video?.fallback_url) {
        appendMedia(box, wrap, post.media.reddit_video.fallback_url, "video", post, titleDiv);
        return;
    }

    /* FALLBACK */
    renderTextFallback(post);
}

/* ---------------------------------------------------------
   Infinite Scroll
--------------------------------------------------------- */

async function loadMore() {
    if (loadingMore || !afterToken || !currentTarget) return;

    loadingMore = true;

    try {
        const res = await fetch(
            `https://api.reddit.com/user/${currentTarget}/submitted?raw_json=1&after=${afterToken}`
        );
        const data = await res.json();

        afterToken = data.data.after;

        for (const child of data.data.children) {
            await renderPost(child.data);
        }
    } catch {}

    loadingMore = false;
}

window.addEventListener("scroll", () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1200) {
        loadMore();
    }
});

/* ---------------------------------------------------------
   LOAD POSTS
--------------------------------------------------------- */

loadBtn.onclick = async () => {
    results.innerHTML = "";
    seenPostURLs.clear();
    afterToken = null;

    const raw = input.value.trim();
    const target = extractTarget(raw);

    if (!target) {
        results.innerHTML = `<div class="post">Invalid input.</div>`;
        return;
    }

    currentTarget = target;

    try {
        const url = `https://api.reddit.com/user/${target}/submitted?raw_json=1`;
        const res = await fetch(url);
        const data = await res.json();

        afterToken = data.data.after;

        for (const child of data.data.children) {
            await renderPost(child.data);
        }
    } catch {
        results.innerHTML = `<div class="post">Failed loading posts</div>`;
    }
};

/* ---------------------------------------------------------
   BUTTONS
--------------------------------------------------------- */

clearBtn.onclick = () => {
    input.value = "";
    results.innerHTML = "";
};

copyBtn.onclick = () => navigator.clipboard.writeText(input.value.trim());

scrollTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });

zipBtn.onclick = () => alert("ZIP downloads coming later");

/* END app.js v1.1.51 */
