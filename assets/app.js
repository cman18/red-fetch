/* =========================================================
   app.js — Version v1.2.1
   COMPLETE RESTORE + FIXES
   • Includes ALL logic from 1.1.51 (≈460 lines)
   • Fixes gallery posts that failed to display
   • Improves Redgifs handling through Worker
   • Adds error tracing for broken media_metadata
   • Adds mobile-safe tapping for enlarge
   • Adds filters (Images / Videos / Other)
   • Maintains tile layout, columns toggle
   • Adds version injector for index.html
   ========================================================= */

/* ---------------------------------------------------------
   VERSION INJECTOR (affects version box only)
--------------------------------------------------------- */
(function injectVersion() {
    const match = document.currentScript.text.match(/Version (v[0-9.]+)/);
    if (!match) return;

    const ver = match[1];

    const box = document.querySelector("#versionBox");
    if (box) {
        box.innerHTML =
            `<span>Index v${ver.replace("v","")}</span>` +
            `<span>CSS v${ver.replace("v","")}</span>` +
            `<span>JS ${ver}</span>`;
    }
})();

/* ---------------------------------------------------------
   DOM ELEMENT REFERENCES
--------------------------------------------------------- */

const results       = document.getElementById("results");
const input         = document.getElementById("input");
const loadBtn       = document.getElementById("loadBtn");
const clearBtn      = document.getElementById("clearBtn");
const copyBtn       = document.getElementById("copyBtn");
const zipBtn        = document.getElementById("zipBtn");
const colToggleBtn  = document.getElementById("colToggleBtn");
const scrollTopBtn  = document.getElementById("scrollTopBtn");
const imagesChk     = document.getElementById("imagesChk");
const videosChk     = document.getElementById("videosChk");
const otherChk      = document.getElementById("otherChk");
const modeSelect    = document.getElementById("modeSelect");

/* ---------------------------------------------------------
   GLOBAL STATE
--------------------------------------------------------- */

let currentUser = null;
let afterToken  = null;
let loadingMore = false;
let forcedMode  = "3";

const seenPostURLs = new Set();

/* Redgifs Worker Proxy */
const REDGIFS_PROXY = "https://red.coffeemanhou.workers.dev/rg/";

/* ---------------------------------------------------------
   SAFE TAP HANDLER FOR MOBILE
--------------------------------------------------------- */
function addTap(el, handler) {
    el.onclick = handler;
    el.ontouchstart = handler;
}

/* ---------------------------------------------------------
   USERNAME / SUBREDDIT EXTRACTOR
--------------------------------------------------------- */
function extractTarget(raw) {
    if (!raw) return null;

    raw = raw.trim();

    if (/reddit\.com\/user\/([^\/]+)/i.test(raw))
        return raw.match(/reddit\.com\/user\/([^\/]+)/i)[1];

    if (/reddit\.com\/r\/([^\/]+)/i.test(raw))
        return raw.match(/reddit\.com\/r\/([^\/]+)/i)[1];

    if (/^u\/([A-Za-z0-9_-]+)/i.test(raw))
        return raw.replace("u/","");

    if (/^r\/([A-Za-z0-9_-]+)/i.test(raw))
        return raw.replace("r/","");

    if (/^[A-Za-z0-9_-]{2,40}$/.test(raw))
        return raw;

    return null;
}

/* ---------------------------------------------------------
   COLUMN MODE
--------------------------------------------------------- */
function applyColumnMode() {
    results.classList.remove("force-2-cols","force-3-cols");

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
   REDGIFS HELPERS
--------------------------------------------------------- */

function isRedgifsURL(url) {
    return url && url.includes("redgifs.com");
}

function extractRedgifsSlug(url) {
    if (!url) return null;

    if (url.includes("out.reddit.com")) {
        try {
            const out = new URL(url).searchParams.get("url");
            if (out) url = out;
        } catch {}
    }

    const patterns = [
        /redgifs\.com\/watch\/([^\/]+)/,
        /redgifs\.com\/ifr\/([^\/]+)/,
        /redgifs\.com\/([^\/]+)$/
    ];

    for (let p of patterns) {
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
    } catch (err) {
        console.warn("Redgifs worker failed", err);
        return null;
    }
}

/* ---------------------------------------------------------
   GIF → MP4 CONVERSIONS
--------------------------------------------------------- */
function isGifURL(url) {
    if (!url) return false;
    return (
        url.endsWith(".gif") ||
        url.endsWith(".gifv") ||
        url.includes("gif") ||
        url.includes("gfycat")
    );
}

function convertGif(url) {
    if (!url) return null;

    if (url.includes("i.imgur.com"))
        return url.replace(".gifv",".mp4").replace(".gif",".mp4");

    if (url.includes("gfycat.com")) {
        const id = url.split("/").pop().split("-")[0];
        return `https://giant.gfycat.com/${id}.mp4`;
    }

    if (url.endsWith(".gifv")) return url.replace(".gifv",".mp4");
    if (url.endsWith(".gif"))  return url.replace(".gif",".mp4");

    return null;
}

/* ---------------------------------------------------------
   TITLE EXPANDER
--------------------------------------------------------- */
function setupTitleBehavior(el) {
    const text = el.textContent.trim();
    if (!text) return;

    const m = document.createElement("div");
    m.style.position = "absolute";
    m.style.visibility = "hidden";
    m.style.whiteSpace = "nowrap";
    m.style.fontSize = window.getComputedStyle(el).fontSize;
    m.textContent = text;

    document.body.appendChild(m);
    const wide = m.clientWidth;
    m.remove();

    if (wide <= el.clientWidth) return;

    const arrow = document.createElement("span");
    arrow.className = "title-arrow";
    arrow.textContent = "⌄";

    el.appendChild(arrow);

    arrow.onclick = (e) => {
        e.stopPropagation();
        const expanded = el.classList.toggle("full");
        arrow.textContent = expanded ? "⌃" : "⌄";
        el.style.whiteSpace = expanded ? "normal" : "nowrap";
    };
}

/* ---------------------------------------------------------
   ONLYFANS FILTER
--------------------------------------------------------- */
function skipOF(post) {
    const t = (post.title||"").toLowerCase();
    const s = (post.selftext||"").toLowerCase();
    const u = (post.url||"").toLowerCase();

    return (
        t.includes("onlyfans") ||
        s.includes("onlyfans") ||
        u.includes("onlyfans.com")
    );
}

/* ---------------------------------------------------------
   TEXT FALLBACK CARD
--------------------------------------------------------- */
function renderText(post) {
    const wrap = document.createElement("div");
    wrap.className = "post";

    const title = document.createElement("div");
    title.className = "post-title";
    title.textContent = post.title || "";
    wrap.appendChild(title);

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

    setupTitleBehavior(title);
    results.appendChild(wrap);
}

/* ---------------------------------------------------------
   MEDIA ELEMENT CREATORS
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
   LARGE VIEW MODAL
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

    const close = document.createElement("div");
    close.className = "large-view-close";
    close.textContent = "✕";

    addTap(close, () => modal.remove());
    modal.appendChild(close);

    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };

    document.body.appendChild(modal);
}

/* ---------------------------------------------------------
   APPEND MEDIA TILE
--------------------------------------------------------- */
function appendMedia(box, wrap, src, type, post, title) {

    if (!src) {
        console.warn("Missing media source for:", post);
        renderText(post);
        return;
    }

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

    setupTitleBehavior(title);
    results.appendChild(wrap);
}

/* ---------------------------------------------------------
   GALLERY RENDERER (ROBUST)
--------------------------------------------------------- */
function renderGallery(box, wrap, sources, post, title) {

    if (!sources || !sources.length) {
        console.warn("Gallery missing sources for:", post);
        renderText(post);
        return;
    }

    let idx = 0;

    const img = document.createElement("img");
    img.src = sources[0];
    img.style.cursor = "pointer";

    addTap(img, () => openLarge(sources[idx]));

    const left = document.createElement("div");
    left.className = "gallery-arrow-main gallery-arrow-main-left";
    left.textContent = "<";

    const right = document.createElement("div");
    right.className = "gallery-arrow-main gallery-arrow-main-right";
    right.textContent = ">";

    left.onclick = (e) => {
        e.stopPropagation();
        idx = (idx - 1 + sources.length) % sources.length;
        img.src = sources[idx];
    };

    right.onclick = (e) => {
        e.stopPropagation();
        idx = (idx + 1) % sources.length;
        img.src = sources[idx];
    };

    box.appendChild(img);
    box.appendChild(left);
    box.appendChild(right);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.innerHTML = `<a href="${post.url}" target="_blank">${post.url}</a>`;

    wrap.appendChild(box);
    wrap.appendChild(urlLine);

    setupTitleBehavior(title);
    results.appendChild(wrap);
}

/* ---------------------------------------------------------
   RENDER POST CONTROLLER
--------------------------------------------------------- */
async function renderPost(post) {

    if (skipOF(post)) return;
    if (seenPostURLs.has(post.url)) return;
    seenPostURLs.add(post.url);

    const wrap = document.createElement("div");
    wrap.className = "post";

    const title = document.createElement("div");
    title.className = "post-title";
    title.textContent = post.title || "";
    wrap.appendChild(title);

    const box = document.createElement("div");
    box.className = "tile-media";

    const url = post.url || "";

    /* FILTER APPLICATION */
    const isImg   = /\.(jpg|jpeg|png|webp)$/i.test(url);
    const isVid   = post.is_video || url.endsWith(".mp4") || url.includes("youtu");
    const isOther = !isImg && !isVid;

    if (!imagesChk.checked && isImg)   return;
    if (!videosChk.checked && isVid)   return;
    if (!otherChk.checked && isOther)  return;

    /* ---- GALLERY ---- */
    if (post.is_gallery && post.media_metadata && post.gallery_data) {

        const ids = post.gallery_data.items.map(i => i.media_id);

        const srcs = ids.map(id => {
            const meta = post.media_metadata[id];
            if (!meta) return null;

            let src = meta.s?.u || meta.s?.gif || meta.s?.mp4;
            if (!src && meta.p?.length)
                src = meta.p[meta.p.length - 1].u;

            return src ? src.replace(/&amp;/g,"&") : null;
        }).filter(Boolean);

        if (!srcs.length) {
            console.warn("Gallery had no valid items", post);
            renderText(post);
            return;
        }

        renderGallery(box, wrap, srcs, post, title);
        return;
    }

    /* ---- IMAGE ---- */
    if (isImg) {
        appendMedia(box, wrap, url, "image", post, title);
        return;
    }

    /* ---- REDGIFS ---- */
    if (isRedgifsURL(url)) {
        const mp4 = await fetchRedgifsMP4(url);
        if (mp4) {
            appendMedia(box, wrap, mp4, "gif", post, title);
            return;
        }
        console.warn("Redgifs fetch failed", url);
    }

    /* ---- GIF TO MP4 ---- */
    if (isGifURL(url)) {
        const mp4 = convertGif(url);
        if (mp4) {
            appendMedia(box, wrap, mp4, "gif", post, title);
            return;
        }
    }

    /* ---- REDDIT VIDEO ---- */
    if (post.is_video && post.media?.reddit_video?.fallback_url) {
        appendMedia(
            box,
            wrap,
            post.media.reddit_video.fallback_url,
            "video",
            post,
            title
        );
        return;
    }

    /* ---- YOUTUBE ---- */
    if (url.includes("youtu")) {
        const id =
            (url.match(/v=([^&]+)/)||[])[1] ||
            (url.match(/youtu\.be\/([^?]+)/)||[])[1];

        if (id) {
            const iframe = document.createElement("iframe");
            iframe.src = `https://www.youtube.com/embed/${id}`;
            iframe.allow = "autoplay; encrypted-media";
            iframe.style.width = "100%";
            iframe.style.height = "100%";
            iframe.style.border = "none";

            box.appendChild(iframe);

            const urlLine = document.createElement("div");
            urlLine.className = "post-url";
            urlLine.innerHTML = `<a href="${url}" target="_blank">${url}</a>`;

            wrap.appendChild(box);
            wrap.appendChild(urlLine);

            setupTitleBehavior(title);
            results.appendChild(wrap);
            return;
        }
    }

    /* ---- TEXT FALLBACK ---- */
    renderText(post);
}

/* ---------------------------------------------------------
   SCROLL TO TOP
--------------------------------------------------------- */
scrollTopBtn.onclick = () =>
    window.scrollTo({top:0,behavior:"smooth"});

/* ---------------------------------------------------------
   INFINITE SCROLL LOADER
--------------------------------------------------------- */
async function loadMore() {
    if (loadingMore || !afterToken || !currentUser) return;

    loadingMore = true;

    try {
        const mode = modeSelect.value === "r" ? "r" : "user";
        const url =
            `https://api.reddit.com/${mode}/${currentUser}/submitted?raw_json=1&after=${afterToken}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("API error");

        const json = await res.json();

        afterToken = json.data.after;

        for (let c of json.data.children)
            await renderPost(c.data);

    } catch (err) {
        console.warn("Infinite scroll failed:", err);
    }

    loadingMore = false;
}

window.addEventListener("scroll", async () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1200)
        await loadMore();
});

/* ---------------------------------------------------------
   LOAD BUTTON PRIMARY PROCESS
--------------------------------------------------------- */
loadBtn.onclick = async () => {
    results.innerHTML = "";
    seenPostURLs.clear();
    afterToken = null;

    const raw = input.value.trim();
    let target = extractTarget(raw);

    if (!target) {
        results.innerHTML = "<div class='post'>Invalid username / subreddit.</div>";
        return;
    }

    currentUser = target;

    try {
        const mode = modeSelect.value === "r" ? "r" : "user";
        const url = `https://api.reddit.com/${mode}/${target}/submitted?raw_json=1`;

        const res = await fetch(url);
        if (!res.ok) throw new Error();

        const data = await res.json();
        afterToken = data.data.after;

        for (let c of data.data.children)
            await renderPost(c.data);

    } catch (err) {
        console.error("LOAD FAILED", err);
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
};

copyBtn.onclick = () =>
    navigator.clipboard.writeText(input.value.trim());

zipBtn.onclick = () =>
    alert("ZIP downloads coming later");

/* END OF FILE v1.2.1 */
