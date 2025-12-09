/* =========================================================
   app.js — Version v1.1.46
   • Full gallery fix (meta.s + meta.p fallback)
   • Stable URL cleaner with preview.redd.it safeguards
   • No UI changes
   • No logic removed
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
const imagesChk = document.getElementById("imagesChk");
const videosChk = document.getElementById("videosChk");
const otherChk = document.getElementById("otherChk");

/* ---------------------------------------------------------
   Global state
--------------------------------------------------------- */

const REDGIFS_PROXY = "https://red.coffeemanhou.workers.dev/?id=";

let currentTarget = null;
let afterToken = null;
let loadingMore = false;
let forcedMode = "3";

const seenPostURLs = new Set();

/* ---------------------------------------------------------
   Extract username or subreddit
--------------------------------------------------------- */

function extractTarget(raw) {
    if (!raw) return null;

    const t = raw.trim();

    if (modeSelect.value === "u") {
        const m1 = t.match(/\/u\/([^\/]+)/i);
        if (m1) return { type: "user", name: m1[1] };

        const m2 = t.match(/reddit\.com\/user\/([^\/]+)/i);
        if (m2) return { type: "user", name: m2[1] };

        if (/^[A-Za-z0-9_-]{2,30}$/.test(t))
            return { type: "user", name: t };

        return null;
    }

    if (modeSelect.value === "r") {
        const m1 = t.match(/\/r\/([^\/]+)/i);
        if (m1) return { type: "sub", name: m1[1] };

        const m2 = t.match(/reddit\.com\/r\/([^\/]+)/i);
        if (m2) return { type: "sub", name: m2[1] };

        if (/^[A-Za-z0-9_]{2,30}$/.test(t))
            return { type: "sub", name: t };

        return null;
    }

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
    forcedMode = forcedMode === "3" ? "2" : "3";
    applyColumnMode();
};

/* ---------------------------------------------------------
   Redgifs helpers
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

        const j = await res.json();
        return j.mp4 || null;
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

    if (url.includes("i.imgur.com"))
        return url.replace(".gifv", ".mp4").replace(".gif", ".mp4");

    if (url.includes("gfycat.com")) {
        const id = url.split("/").pop().split("-")[0];
        return "https://giant.gfycat.com/" + id + ".mp4";
    }

    if (url.endsWith(".gifv")) return url.replace(".gifv", ".mp4");
    if (url.endsWith(".gif")) return url.replace(".gif", ".mp4");

    return null;
}

/* ---------------------------------------------------------
   Title expansion
--------------------------------------------------------- */

function setupTitleBehavior(titleDiv) {
    const original = titleDiv.textContent.trim();
    if (!original) return;

    const temp = document.createElement("div");
    temp.style.position = "absolute";
    temp.style.visibility = "hidden";
    temp.style.whiteSpace = "nowrap";
    temp.style.fontSize = window.getComputedStyle(titleDiv).fontSize;
    temp.textContent = original;

    document.body.appendChild(temp);
    const fullW = temp.clientWidth;
    temp.remove();

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
   OnlyFans skip
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
   Text fallback
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

    const txt = document.createElement("div");
    txt.className = "placeholder-media";
    txt.textContent = "Text Post";

    box.appendChild(txt);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.innerHTML = "<a href='" + post.url + "' target='_blank'>" + post.url + "</a>";

    wrap.appendChild(box);
    wrap.appendChild(urlLine);

    setupTitleBehavior(titleDiv);
    results.appendChild(wrap);
}

/* ---------------------------------------------------------
   GALLERY URL FIX (v1.1.46 PATCH)
--------------------------------------------------------- */

function extractGalleryURL(meta) {
    if (!meta) return null;

    let src = null;

    if (meta.s)
        src = meta.s.u || meta.s.gif || meta.s.mp4 || null;

    if (!src && meta.p && meta.p.length)
        src = meta.p[meta.p.length - 1].u;

    if (!src) return null;

    src = src.replace(/&amp;/g, "&");

    if (src.includes("preview.redd.it"))
        src = src.replace("preview.redd.it", "i.redd.it");

    src = src.split("?")[0];

    return src;
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

    if (post.is_gallery && post.media_metadata && post.gallery_data) {
        const ids = post.gallery_data.items.map(i => i.media_id);
        const sources = ids.map(id => extractGalleryURL(post.media_metadata[id])).filter(Boolean);

        if (!sources.length) {
            renderTextFallback(post);
            return;
        }

        renderGallery(box, wrap, sources, post, titleDiv);
        return;
    }

    if (url.match(/\.(jpg|jpeg|png|webp)$/i)) {
        appendMedia(box, wrap, url, "image", post, titleDiv);
        return;
    }

    if (isRedgifsURL(url)) {
        const mp4 = await fetchRedgifsMP4(url);
        if (mp4) {
            appendMedia(box, wrap, mp4, "gif", post, titleDiv);
            return;
        }
    }

    if (isGif(url)) {
        const mp4 = convertGifToMP4(url);
        if (mp4) {
            appendMedia(box, wrap, mp4, "gif", post, titleDiv);
            return;
        }
    }

    if (post.is_video && post.media && post.media.reddit_video) {
        appendMedia(box, wrap, post.media.reddit_video.fallback_url, "video", post, titleDiv);
        return;
    }

    renderTextFallback(post);
}

/* ---------------------------------------------------------
   MEDIA helpers
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

function appendMedia(box, wrap, src, type, post, titleDiv) {
    const el = type === "image" ? createImage(src) : createVideo(src, type === "gif");

    el.style.cursor = "pointer";
    el.onclick = () => openLargeView(src);

    box.appendChild(el);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.innerHTML = "<a href='" + post.url + "' target='_blank'>" + post.url + "</a>";

    wrap.appendChild(box);
    wrap.appendChild(urlLine);
    setupTitleBehavior(titleDiv);
    results.appendChild(wrap);
}

/* ---------------------------------------------------------
   GALLERY MAIN VIEW
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
    urlLine.innerHTML = "<a href='" + post.url + "' target='_blank'>" + post.url + "</a>";

    wrap.appendChild(box);
    wrap.appendChild(urlLine);
    setupTitleBehavior(titleDiv);
    results.appendChild(wrap);
}

/* ---------------------------------------------------------
   LARGE VIEW
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
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    document.body.appendChild(modal);
}

/* ---------------------------------------------------------
   Scroll to Top
--------------------------------------------------------- */

scrollTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });

/* ---------------------------------------------------------
   Infinite scroll
--------------------------------------------------------- */

async function loadMore() {
    if (loadingMore || !afterToken || !currentTarget) return;

    loadingMore = true;

    try {
        let url =
            currentTarget.type === "user"
                ? "https://api.reddit.com/user/" + currentTarget.name + "/submitted?raw_json=1&after=" + afterToken
                : "https://api.reddit.com/r/" + currentTarget.name + "/hot?raw_json=1&after=" + afterToken;

        const res = await fetch(url);
        if (!res.ok) return;

        const j = await res.json();
        afterToken = j.data.after;

        for (const child of j.data.children)
            await renderPost(child.data);
    } catch {}

    loadingMore = false;
}

window.addEventListener("scroll", async () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1200)
        await loadMore();
});

/* ---------------------------------------------------------
   LOAD BUTTON
--------------------------------------------------------- */

loadBtn.onclick = async () => {
    results.innerHTML = "";
    seenPostURLs.clear();
    afterToken = null;
    currentTarget = null;

    const raw = input.value.trim();
    const t = extractTarget(raw);

    if (!t) {
        results.innerHTML = "<div class='post'>Invalid input.</div>";
        return;
    }

    currentTarget = t;

    try {
        const url =
            t.type === "user"
                ? "https://api.reddit.com/user/" + t.name + "/submitted?raw_json=1"
                : "https://api.reddit.com/r/" + t.name + "/hot?raw_json=1";

        const res = await fetch(url);
        if (!res.ok) throw new Error();

        const j = await res.json();
        afterToken = j.data.after;

        for (const child of j.data.children)
            await renderPost(child.data);
    } catch {
        results.innerHTML = "<div class='post'>Failed loading posts.</div>";
    }
};

/* ---------------------------------------------------------
   OTHER BUTTONS
--------------------------------------------------------- */

clearBtn.onclick = () => {
    input.value = "";
    results.innerHTML = "";
    seenPostURLs.clear();
    afterToken = null;
    currentTarget = null;
};

copyBtn.onclick = () => navigator.clipboard.writeText(input.value.trim());
zipBtn.onclick = () => alert("ZIP coming later");

/* END v1.1.46 */
