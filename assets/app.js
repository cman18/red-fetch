/* =========================================================
   app.js — Version v1.1.35 (Patched)
   • Perfect 4:5 tile fill
   • Fullscreen restored for ALL media
   • Redgifs Worker MP4
   • Imgur GIF/GIFV → MP4
   • Gfycat → MP4
   • Reddit GIF → MP4
   • Full gallery support
   • Title collapse
   • OF filtering
   • Infinite scrolling
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

/* ---------------------------------------------------------
   Global state
--------------------------------------------------------- */

const REDGIFS_PROXY = "https://red.coffeemanhou.workers.dev/?id=";

let currentUser = null;
let afterToken = null;
let loadingMore = false;
let forcedMode = null;

let postMediaList = [];
const seenPostURLs = new Set();

/* ---------------------------------------------------------
   Username extractor
--------------------------------------------------------- */

function extractUsername(text) {
    if (!text) return null;
    text = text.trim();

    let m = text.match(/\/u\/([^\/]+)/i);
    if (m) return m[1];

    m = text.match(/reddit\.com\/user\/([^\/]+)/i);
    if (m) return m[1];

    m = text.match(/\bu\/([A-Za-z0-9_-]+)/i);
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
    forcedMode = (forcedMode === "3" || forcedMode === null) ? "2" : "3";
    applyColumnMode();
};

/* ---------------------------------------------------------
   Redgifs utilities
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
        const res = await fetch(REDGIFS_PROXY + slug, {
            headers: { "Cache-Control": "no-cache" }
        });

        if (!res.ok) return null;

        const json = await res.json();
        return json.mp4 || null;
    } catch {
        return null;
    }
}

/* ---------------------------------------------------------
   GIF handling
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
   Title expand/collapse
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
    const fullW = measure.clientWidth;
    measure.remove();

    if (fullW <= titleDiv.clientWidth) return;

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
   OnlyFans filter
--------------------------------------------------------- */

function shouldSkipOF(post) {
    const t = (post.title || "").toLowerCase();
    const s = (post.selftext || "").toLowerCase();
    const u = (post.url || "").toLowerCase();

    return (
        t.includes("onlyfans") ||
        s.includes("onlyfans") ||
        u.includes("onlyfans.com")
    );
}

/* ---------------------------------------------------------
   Text fallback card
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

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.innerHTML = `<a href="${post.url}" target="_blank">${post.url}</a>`;

    wrap.appendChild(box);
    wrap.appendChild(urlLine);

    setupTitleBehavior(titleDiv);
    results.appendChild(wrap);
}

/* ---------------------------------------------------------
   MAIN RENDER
--------------------------------------------------------- */

async function renderPost(post) {
    if (shouldSkipOF(post)) return;

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

    /* GALLERY */
    if (post.is_gallery && post.media_metadata && post.gallery_data) {
        const ids = post.gallery_data.items.map(i => i.media_id);

        const sources = ids.map(id => {
            const meta = post.media_metadata[id];
            if (!meta) return null;

            let src = meta?.s?.u || meta?.s?.gif || meta?.s?.mp4;
            if (!src && meta?.p?.length)
                src = meta.p[meta.p.length - 1].u;

            return src ? src.replace(/&amp;/g, "&") : null;
        }).filter(Boolean);

        if (!sources.length) {
            renderTextFallback(post);
            return;
        }

        renderGallery(box, wrap, sources, post, titleDiv);
        return;
    }

    /* IMAGE */
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

    /* IMGUR GIF/GIFV, GFYCAT, ETC */
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

    /* YOUTUBE */
    if (url.includes("youtu")) {
        const id =
            (url.match(/v=([^&]+)/) || [])[1] ||
            (url.match(/youtu\.be\/([^?]+)/) || [])[1];

        if (id) {
            const iframe = document.createElement("iframe");
            iframe.src = `https://www.youtube.com/embed/${id}`;
            iframe.allow = "autoplay; encrypted-media";
            iframe.style.width = "100%";
            iframe.style.height = "100%";
            iframe.style.border = "none";

            box.appendChild(iframe);

            wrap.appendChild(box);

            const urlLine = document.createElement("div");
            urlLine.className = "post-url";
            urlLine.innerHTML = `<a href="${url}" target="_blank">${url}</a>`;
            wrap.appendChild(urlLine);

            setupTitleBehavior(titleDiv);
            results.appendChild(wrap);
            return;
        }
    }

    /* TEXT POST FALLBACK */
    renderTextFallback(post);
}

/* ---------------------------------------------------------
   Media helpers
--------------------------------------------------------- */

function createImage(src) {
    const el = document.createElement("img");
    el.src = src;
    return el;
}

function createVideo(src, isGif) {
    const v = document.createElement("video");
    v.src = src;
    v.autoplay = isGif;
    v.loop = isGif;
    v.muted = isGif;
    v.controls = !isGif;
    return v;
}

/* ---------------------------------------------------------
   ⭐ FIXED — Fullscreen restore for ALL media
--------------------------------------------------------- */

function appendMedia(box, wrap, src, type, post, titleDiv) {
    const el =
        type === "image"
            ? createImage(src)
            : createVideo(src, type === "gif");

    /* FULLSCREEN CLICK FIX */
    el.style.cursor = "pointer";
    el.onclick = () => openFullscreenSingle(src);

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
    img.onclick = () => openFullscreenGallery(sources, idx);

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
   Fullscreen — Single media
--------------------------------------------------------- */

function openFullscreenSingle(src) {
    const wrap = document.createElement("div");
    wrap.className = "fullscreen-media";

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

    wrap.appendChild(el);

    wrap.onclick = () => wrap.remove();

    document.body.appendChild(wrap);
}

/* ---------------------------------------------------------
   Fullscreen — Gallery mode
--------------------------------------------------------- */

let fsWrap = null;
let fsImg = null;
let fsIdx = 0;
let fsSources = [];

function openFullscreenGallery(list, index) {
    fsSources = list;
    fsIdx = index;

    fsWrap = document.createElement("div");
    fsWrap.className = "fullscreen-media";

    fsImg = document.createElement("img");
    fsImg.src = list[index];

    const left = document.createElement("div");
    left.className = "gallery-arrow gallery-arrow-left";
    left.textContent = "<";

    const right = document.createElement("div");
    right.className = "gallery-arrow gallery-arrow-right";
    right.textContent = ">";

    left.onclick = (e) => {
        e.stopPropagation();
        fsIdx = (fsIdx - 1 + fsSources.length) % fsSources.length;
        fsImg.src = fsSources[fsIdx];
    };

    right.onclick = (e) => {
        e.stopPropagation();
        fsIdx = (fsIdx + 1) % fsSources.length;
        fsImg.src = fsSources[fsIdx];
    };

    fsWrap.onclick = () => closeFullscreenGallery();

    fsWrap.appendChild(fsImg);
    fsWrap.appendChild(left);
    fsWrap.appendChild(right);

    document.body.appendChild(fsWrap);
    document.addEventListener("keydown", fsKeyHandler);
}

function closeFullscreenGallery() {
    if (!fsWrap) return;

    fsWrap.remove();
    fsWrap = null;
    fsImg = null;
    fsSources = [];
    fsIdx = 0;

    document.removeEventListener("keydown", fsKeyHandler);
}

function fsKeyHandler(e) {
    if (e.key === "Escape") closeFullscreenGallery();

    if (e.key === "ArrowRight") {
        fsIdx = (fsIdx + 1) % fsSources.length;
        fsImg.src = fsSources[fsIdx];
    }

    if (e.key === "ArrowLeft") {
        fsIdx = (fsIdx - 1 + fsSources.length) % fsSources.length;
        fsImg.src = fsSources[fsIdx];
    }
}

/* ---------------------------------------------------------
   Scroll-to-top
--------------------------------------------------------- */

scrollTopBtn.onclick = () =>
    window.scrollTo({ top: 0, behavior: "smooth" });

/* ---------------------------------------------------------
   Infinite scroll
--------------------------------------------------------- */

async function loadMore() {
    if (loadingMore || !afterToken || !currentUser) return;

    loadingMore = true;

    try {
        const url =
            `https://api.reddit.com/user/${currentUser}/submitted?raw_json=1&after=${afterToken}`;

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
    const nearBottom =
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 1200;

    if (nearBottom) await loadMore();
});

/* ---------------------------------------------------------
   LOAD BUTTON
--------------------------------------------------------- */

loadBtn.onclick = async () => {
    results.innerHTML = "";
    seenPostURLs.clear();
    postMediaList = [];
    afterToken = null;
    currentUser = null;

    const raw = input.value.trim();
    const user = extractUsername(raw);

    if (!user) {
        results.innerHTML =
            "<div class='post'>Invalid username or URL.</div>";
        return;
    }

    currentUser = user;

    try {
        const url = `https://api.reddit.com/user/${user}/submitted?raw_json=1`;
        const res = await fetch(url);
        if (!res.ok) throw new Error();

        const data = await res.json();
        afterToken = data.data.after;

        for (const child of data.data.children) {
            await renderPost(child.data);
        }
    } catch {
        results.innerHTML =
            "<div class='post'>Failed loading posts.</div>";
    }
};

/* ---------------------------------------------------------
   OTHER BUTTONS
--------------------------------------------------------- */

clearBtn.onclick = () => {
    input.value = "";
    results.innerHTML = "";
    seenPostURLs.clear();
    postMediaList = [];
    afterToken = null;
    currentUser = null;
};

copyBtn.onclick = () =>
    navigator.clipboard.writeText(input.value.trim());

zipBtn.onclick = () =>
    alert("ZIP downloads coming later");

/* END v1.1.35-patched */
