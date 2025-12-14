/* =========================================================
   app.js — Version v1.2.6
   iOS FIX + Worker Routing + UI Tap Safety + Gallery Fix
   ========================================================= */


/* ---------------------------------------------------------
   VERSION BOX AUTO-INJECTOR
--------------------------------------------------------- */
(function injectVersion() {
    const match = document.currentScript.text.match(/Version (v[\d.]+)/);
    if (!match) return;

    const ver = match[1];
    const box = document.querySelector("#versionBox");
    if (box) {
        box.innerHTML =
            `Index ${ver} • CSS ${ver} • JS ${ver}`;
    }
})();


/* ---------------------------------------------------------
   DOM ELEMENTS
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
const exampleBtn    = document.getElementById("exampleBtn");


/* ---------------------------------------------------------
   GLOBAL STATE
--------------------------------------------------------- */
let currentUser = null;
let afterToken = null;
let loadingMore = false;
let forcedMode = "3";

const seenPostURLs = new Set();

const WORKER = "https://red.coffeemanhou.workers.dev";
const RG_PROXY = WORKER + "/rg/";
const R_PROXY  = WORKER + "/reddit/";
const GAL_PROXY = WORKER + "/gallery?url=";


/* ---------------------------------------------------------
   SAFE TAP HANDLER — prevents accidental enlarge on iPad
--------------------------------------------------------- */
function addSafeTap(el, handler) {
    el.onclick = (ev) => {
        const rect = el.getBoundingClientRect();
        const x = ev.clientX - rect.left;

        if (x >= rect.width * 0.2 && x <= rect.width * 0.8)
            handler();
    };

    el.ontouchend = (ev) => {
        const t = ev.changedTouches[0];
        const rect = el.getBoundingClientRect();
        const x = t.clientX - rect.left;

        if (x >= rect.width * 0.2 && x <= rect.width * 0.8)
            handler();
    };
}


/* ---------------------------------------------------------
   EXTRACT USER OR SUBREDDIT
--------------------------------------------------------- */
function extractTarget(raw) {
    if (!raw) return null;
    raw = raw.trim();

    if (/reddit\.com\/user\/([^\/]+)/i.test(raw))
        return raw.match(/reddit\.com\/user\/([^\/]+)/i)[1];

    if (/reddit\.com\/r\/([^\/]+)/i.test(raw))
        return raw.match(/reddit\.com\/r\/([^\/]+)/i)[1];

    if (/^u\/([\w-]+)/i.test(raw))
        return raw.replace("u/","");

    if (/^r\/([\w-]+)/i.test(raw))
        return raw.replace("r/","");

    if (/^[\w-]{2,40}$/.test(raw))
        return raw;

    return null;
}


/* ---------------------------------------------------------
   APPLY COLUMN MODE
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
            const u = new URL(url).searchParams.get("url");
            if (u) url = u;
        } catch {}
    }

    const patterns = [
        /redgifs\.com\/watch\/([^\/]+)/,
        /redgifs\.com\/ifr\/([^\/]+)/,
        /redgifs\.com\/([^\/]+)$/
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
        const res = await fetch(RG_PROXY + slug);
        if (!res.ok) return null;

        const json = await res.json();
        return json.mp4 || null;

    } catch {
        return null;
    }
}


/* ---------------------------------------------------------
   GIF + GIFV CONVERSION
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
    if (url.includes("i.imgur.com"))
        return url.replace(".gifv",".mp4").replace(".gif",".mp4");

    if (url.includes("gfycat")) {
        const id = url.split("/").pop().split("-")[0];
        return `https://giant.gfycat.com/${id}.mp4`;
    }

    if (url.endsWith(".gifv")) return url.replace(".gifv",".mp4");
    if (url.endsWith(".gif")) return url.replace(".gif",".mp4");

    return null;
}


/* ---------------------------------------------------------
   FALLBACK TEXT POST
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

    results.appendChild(wrap);
}


/* ---------------------------------------------------------
   MODAL VIEW
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
    addSafeTap(close, () => modal.remove());
    modal.appendChild(close);

    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };

    document.body.appendChild(modal);
}


/* ---------------------------------------------------------
   GALLERY RENDERER
--------------------------------------------------------- */
function renderGallery(box, wrap, sources, post, title) {
    if (!sources?.length) {
        wrap.innerHTML = `<div class="post" style="padding:14px;color:#f88">Gallery parse failed<br>${post.url}</div>`;
        results.appendChild(wrap);
        return;
    }

    let idx = 0;

    const img = document.createElement("img");
    img.src = sources[idx];
    img.style.cursor = "pointer";
    addSafeTap(img, () => openLarge(sources[idx]));

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
    results.appendChild(wrap);
}


/* ---------------------------------------------------------
   RENDER INDIVIDUAL POST
--------------------------------------------------------- */
async function renderPost(post) {

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

    /* FILTERS */
    const isImg = /\.(jpg|jpeg|png|webp)$/i.test(url);
    const isVid = post.is_video || url.endsWith(".mp4");
    const isOther = !isImg && !isVid;

    if (!imagesChk.checked && isImg) return;
    if (!videosChk.checked && isVid) return;
    if (!otherChk.checked && isOther) return;

    /* GALLERY */
    if (post.is_gallery && post.gallery_data && post.media_metadata) {
        const ids = post.gallery_data.items.map(i => i.media_id);
        const sources = ids.map(id => {
            const meta = post.media_metadata[id];
            if (!meta) return null;
            let src = meta.s?.u || meta.s?.mp4 || meta.s?.gif;
            if (!src && meta.p?.length)
                src = meta.p[meta.p.length - 1].u;
            return src?.replace(/&amp;/g,"&");
        }).filter(Boolean);

        renderGallery(box, wrap, sources, post, title);
        return;
    }

    /* IMAGE */
    if (isImg) {
        const el = document.createElement("img");
        el.src = url;
        el.style.cursor = "pointer";
        addSafeTap(el, () => openLarge(url));
        box.appendChild(el);
        finish();
        return;
    }

    /* REDGIFS */
    if (isRedgifsURL(url)) {
        const mp4 = await fetchRedgifsMP4(url);
        if (mp4) {
            const v = document.createElement("video");
            v.src = mp4;
            v.autoplay = true;
            v.loop = true;
            v.muted = true;
            v.controls = false;
            addSafeTap(v, () => openLarge(mp4));
            box.appendChild(v);
            finish();
            return;
        }
    }

    /* GIF → MP4 */
    if (isGifURL(url)) {
        const mp4 = convertGif(url);
        if (mp4) {
            const v = document.createElement("video");
            v.src = mp4;
            v.autoplay = true;
            v.loop = true;
            v.muted = true;
            addSafeTap(v, () => openLarge(mp4));
            box.appendChild(v);
            finish();
            return;
        }
    }

    /* REDDIT NATIVE VIDEO */
    if (post.is_video && post.media?.reddit_video?.fallback_url) {
        const v = document.createElement("video");
        v.src = post.media.reddit_video.fallback_url;
        v.controls = true;
        addSafeTap(v, () => openLarge(v.src));
        box.appendChild(v);
        finish();
        return;
    }

    /* FALLBACK */
    renderText(post);
    return;

    function finish() {
        const urlLine = document.createElement("div");
        urlLine.className = "post-url";
        urlLine.innerHTML = `<a href="${url}" target="_blank">${url}</a>`;
        wrap.appendChild(box);
        wrap.appendChild(urlLine);
        results.appendChild(wrap);
    }
}


/* ---------------------------------------------------------
   INFINITE SCROLL
--------------------------------------------------------- */
async function loadMore() {
    if (loadingMore || !afterToken || !currentUser) return;
    loadingMore = true;

    const mode = modeSelect.value === "r" ? "r" : "user";
    const fullURL =
        `https://api.reddit.com/${mode}/${currentUser}/submitted?raw_json=1&after=${afterToken}`;
    const encoded = encodeURIComponent(fullURL);

    try {
        const res = await fetch(R_PROXY + encoded);
        const json = await res.json();

        afterToken = json?.data?.after;

        for (let c of json.data.children)
            await renderPost(c.data);

    } catch (err) {
        results.innerHTML += `<div class="post" style="color:#f88;padding:12px">
            Infinite scroll error: ${err}
        </div>`;
    }

    loadingMore = false;
}

window.addEventListener("scroll", () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1200)
        loadMore();
});


/* ---------------------------------------------------------
   MAIN LOAD BUTTON — NOW USES WORKER
--------------------------------------------------------- */
loadBtn.onclick = async () => {

    results.innerHTML = "";
    seenPostURLs.clear();
    afterToken = null;

    const raw = input.value.trim();
    const target = extractTarget(raw);

    if (!target) {
        results.innerHTML =
            `<div class="post" style="color:#f88;padding:12px">Invalid user or subreddit</div>`;
        return;
    }

    currentUser = target;

    const mode = modeSelect.value === "r" ? "r" : "user";

    const fullURL =
        `https://api.reddit.com/${mode}/${target}/submitted?raw_json=1`;
    const encoded = encodeURIComponent(fullURL);

    try {
        const res = await fetch(R_PROXY + encoded);
        const json = await res.json();

        afterToken = json?.data?.after;

        for (let c of json.data.children)
            await renderPost(c.data);

    } catch (err) {
        results.innerHTML =
            `<div class="post" style="color:#f88;padding:12px">
                Network failure loading posts:<br>${err}
            </div>`;
    }
};


/* ---------------------------------------------------------
   EXAMPLE BUTTON
--------------------------------------------------------- */
exampleBtn.onclick = () => {
    input.value = "https://www.reddit.com/user/Euna_Chris/submitted/";
    loadBtn.click();
};


/* ---------------------------------------------------------
   CLEAR / COPY
--------------------------------------------------------- */
clearBtn.onclick = () => {
    input.value = "";
    results.innerHTML = "";
    seenPostURLs.clear();
};

copyBtn.onclick = () =>
    navigator.clipboard.writeText(input.value.trim());

zipBtn.onclick = () =>
    alert("ZIP downloads coming soon");


/* END v1.2.6 */
