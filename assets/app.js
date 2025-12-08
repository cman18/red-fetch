/* =========================================================
   app.js — Version v1.1.40
   • Stable version label (no auto-fetch)
   • Packaged Reddit videos supported
   • Redgifs proxy support
   • Gallery arrows restored
   • Modal enlarge view for images + videos
   • iPad-friendly tap handlers
   ========================================================= */


/* ---------------------------------------------------------
   Inject version into header safely
--------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
    const h = document.querySelector("h1");
    if (h) h.innerHTML = `Red Fetch <span style="color:#83f3df;">v1.1.40</span>`;
});


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

let currentUser = null;
let afterToken = null;
let loadingMore = false;
let forcedMode = null;

const seenPostURLs = new Set();
const REDGIFS_PROXY = "https://red.coffeemanhou.workers.dev/?id=";


/* ---------------------------------------------------------
   Tap handler (fixes iPad click)
--------------------------------------------------------- */

function addTap(el, fn) {
    el.onclick = fn;
    el.ontouchend = fn;
}


/* ---------------------------------------------------------
   Username parsing
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
   Column toggle
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
    forcedMode = forcedMode === "2" ? "3" : "2";
    applyColumnMode();
};


/* ---------------------------------------------------------
   REDGIFS utilities
--------------------------------------------------------- */

function isRedgifsURL(url) {
    return url && url.includes("redgifs.com");
}

function extractRedgifsSlug(url) {
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

        const data = await res.json();
        return data.mp4 || null;
    } catch {
        return null;
    }
}


/* ---------------------------------------------------------
   GIF → MP4 conversion
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
   Title collapse
--------------------------------------------------------- */

function setupTitleBehavior(div) {
    const text = div.textContent.trim();
    if (!text) return;

    const measure = document.createElement("div");
    measure.style.position = "absolute";
    measure.style.visibility = "hidden";
    measure.style.whiteSpace = "nowrap";
    measure.style.fontSize = window.getComputedStyle(div).fontSize;
    measure.textContent = text;

    document.body.appendChild(measure);
    const fullW = measure.clientWidth;
    measure.remove();

    if (fullW <= div.clientWidth) return;

    const arrow = document.createElement("span");
    arrow.className = "title-arrow";
    arrow.textContent = "⌄";
    div.appendChild(arrow);

    arrow.onclick = (e) => {
        e.stopPropagation();
        const expanded = div.classList.toggle("full");
        arrow.textContent = expanded ? "⌃" : "⌄";
        div.style.whiteSpace = expanded ? "normal" : "nowrap";
    };
}


/* ---------------------------------------------------------
   Create media elements
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


/* ---------------------------------------------------------
   Modal enlarge view
--------------------------------------------------------- */

function openLarge(src) {
    const wrap = document.createElement("div");
    wrap.className = "large-view";

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

    wrap.appendChild(el);

    const closeBtn = document.createElement("div");
    closeBtn.className = "large-view-close";
    closeBtn.textContent = "✕";

    closeBtn.onclick = () => wrap.remove();
    wrap.onclick = e => { if (e.target === wrap) wrap.remove(); };

    wrap.appendChild(closeBtn);
    document.body.appendChild(wrap);
}


/* ---------------------------------------------------------
   appendMedia
--------------------------------------------------------- */

function appendMedia(box, wrap, src, type, post, titleDiv) {
    const el = type === "image"
        ? createImage(src)
        : createVideo(src, type === "gif");

    el.style.cursor = "pointer";
    addTap(el, () => openLarge(src));

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
   GALLERY (with arrows on main page)
--------------------------------------------------------- */

function renderGallery(box, wrap, list, post, titleDiv) {
    let idx = 0;

    const img = document.createElement("img");
    img.src = list[idx];
    img.style.cursor = "pointer";
    addTap(img, () => openLarge(list[idx]));

    const left = document.createElement("div");
    left.className = "gallery-arrow-main gallery-arrow-main-left";
    left.textContent = "<";

    const right = document.createElement("div");
    right.className = "gallery-arrow-main gallery-arrow-main-right";
    right.textContent = ">";

    const update = () => img.src = list[idx];

    left.onclick = e => {
        e.stopPropagation();
        idx = (idx - 1 + list.length) % list.length;
        update();
    };

    right.onclick = e => {
        e.stopPropagation();
        idx = (idx + 1) % list.length;
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
   MAIN renderPost
--------------------------------------------------------- */

async function renderPost(post) {
    if (!post || seenPostURLs.has(post.url)) return;
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

            let s = meta.s?.u || meta.s?.mp4 || meta.s?.gif;
            if (!s && meta.p?.length)
                s = meta.p[meta.p.length - 1].u;

            return s ? s.replace(/&amp;/g,"&") : null;
        }).filter(Boolean);

        return renderGallery(box, wrap, sources, post, titleDiv);
    }

    /* IMAGES */
    if (url.match(/\.(jpg|jpeg|png|webp)$/i))
        return appendMedia(box, wrap, url, "image", post, titleDiv);

    /* REDGIFS */
    if (isRedgifsURL(url)) {
        const mp4 = await fetchRedgifsMP4(url);
        if (mp4) return appendMedia(box, wrap, mp4, "gif", post, titleDiv);
    }

    /* GIF → MP4 */
    if (isGif(url)) {
        const mp4 = convertGifToMP4(url);
        if (mp4) return appendMedia(box, wrap, mp4, "gif", post, titleDiv);
    }

    /* REDDIT PACKAGED MEDIA */
    if (post.secure_media?.reddit_video?.fallback_url) {
        return appendMedia(
            box, wrap,
            post.secure_media.reddit_video.fallback_url,
            "video",
            post, titleDiv
        );
    }

    /* TEXT FALLBACK */
    const t = document.createElement("div");
    t.textContent = "Text Post";
    box.appendChild(t);
    wrap.appendChild(box);
    results.appendChild(wrap);
}


/* ---------------------------------------------------------
   Infinite scroll
--------------------------------------------------------- */

async function loadMore() {
    if (!currentUser || loadingMore || !afterToken) return;

    loadingMore = true;

    try {
        const url = `https://api.reddit.com/user/${currentUser}/submitted?raw_json=1&after=${afterToken}`;
        const res = await fetch(url);
        if (!res.ok) throw 0;

        const data = await res.json();
        afterToken = data.data.after;

        for (const child of data.data.children)
            await renderPost(child.data);

    } catch {}

    loadingMore = false;
}

window.addEventListener("scroll", async () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1200)
        await loadMore();
});


/* ---------------------------------------------------------
   Load button
--------------------------------------------------------- */

loadBtn.onclick = async () => {
    results.innerHTML = "";
    seenPostURLs.clear();
    afterToken = null;
    currentUser = null;

    const raw = input.value.trim();
    const user = extractUsername(raw);

    if (!user) {
        results.innerHTML = "<div class='post'>Invalid user</div>";
        return;
    }

    currentUser = user;

    try {
        const url = `https://api.reddit.com/user/${user}/submitted?raw_json=1`;
        const res = await fetch(url);
        if (!res.ok) throw 0;

        const data = await res.json();
        afterToken = data.data.after;

        for (const child of data.data.children)
            await renderPost(child.data);

    } catch {
        results.innerHTML = "<div class='post'>Failed loading posts</div>";
    }
};


/* ---------------------------------------------------------
   Other buttons
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
    alert("ZIP download coming later.");

scrollTopBtn.onclick = () =>
    window.scrollTo({ top: 0, behavior: "smooth" });

