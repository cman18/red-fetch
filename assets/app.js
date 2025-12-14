/* =========================================================
   app.js — Version v1.2.6
   FULLY CLEANED + VALIDATED + WORKING RELEASE
   ---------------------------------------------------------
   - Gallery support (JSON + HTML fallback)
   - Redgifs proxy via Cloudflare Worker
   - Imgur GIFV → MP4, Gfycat → MP4
   - Reddit video support
   - YouTube embed
   - SAFE-TAP enlarge modal (prevents accidental touches)
   - Full error output on screen (iPad friendly)
   - Infinite scroll
   - OnlyFans filter
   - Duplicate filter
   - UI unchanged from v1.2.5 layout
   ========================================================= */


/* ---------------------------------------------------------
   VERSION BOX AUTO-INJECTOR
--------------------------------------------------------- */
(function injectVersion() {
    const match = document.currentScript.text.match(/Version (v[0-9.]+)/);
    if (!match) return;

    const ver = match[1];
    const box = document.querySelector("#versionBox");
    if (box) {
        box.innerHTML = `
            <span>Index ${ver}</span> •
            <span>CSS ${ver}</span> •
            <span>JS ${ver}</span>
        `;
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

const REDGIFS_PROXY = "https://red.coffeemanhou.workers.dev/rg/";
const REDDIT_GALLERY_PROXY = "https://red.coffeemanhou.workers.dev/gallery?url=";


/* ---------------------------------------------------------
   SAFE-TAP HANDLER (prevents accidental enlarge)
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
   EXTRACT TARGET
--------------------------------------------------------- */
function extractTarget(raw) {
    if (!raw) return null;
    raw = raw.trim();

    if (/reddit\.com\/user\/([^\/]+)/i.test(raw))
        return raw.match(/reddit\.com\/user\/([^\/]+)/i)[1];

    if (/reddit\.com\/r\/([^\/]+)/i.test(raw))
        return raw.match(/reddit\.com\/r\/([^\/]+)/i)[1];

    if (/^u\/([A-Za-z0-9_-]+)/.test(raw))
        return raw.replace("u/","");

    if (/^r\/([A-Za-z0-9_-]+)/.test(raw))
        return raw.replace("r/","");

    if (/^[A-Za-z0-9_-]{2,40}$/.test(raw))
        return raw;

    return null;
}


/* ---------------------------------------------------------
   COLUMN TOGGLE
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
    forcedMode = (forcedMode === "3") ? "2" : "3";
    applyColumnMode();
};


/* ---------------------------------------------------------
   REDGIFS HANDLING
--------------------------------------------------------- */
function isRedgifsURL(url) {
    return url && url.includes("redgifs.com");
}

function extractRedgifsSlug(url) {
    if (!url) return null;

    // unwrap outbound reddit links
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
        return json.mp4 ?? null;

    } catch {
        return null;
    }
}


/* ---------------------------------------------------------
   GIF → MP4 LOGIC
--------------------------------------------------------- */
function isGifURL(url) {
    return url &&
        (url.endsWith(".gif") ||
         url.endsWith(".gifv") ||
         url.includes("gfycat") ||
         url.includes("gif"));
}

function convertGif(url) {
    if (!url) return null;

    if (url.includes("i.imgur.com"))
        return url.replace(".gifv",".mp4").replace(".gif",".mp4");

    if (url.includes("gfycat")) {
        const id = url.split("/").pop().split("-")[0];
        return `https://giant.gfycat.com/${id}.mp4`;
    }

    if (url.endsWith(".gifv")) return url.replace(".gifv",".mp4");
    if (url.endsWith(".gif"))  return url.replace(".gif",".mp4");

    return null;
}


/* ---------------------------------------------------------
   TITLE EXPAND
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
    const fullWidth = m.clientWidth;
    m.remove();

    if (fullWidth <= el.clientWidth) return;

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
   TEXT FALLBACK
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
        el.autoplay = true;
        el.loop = true;
        el.controls = true;
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
   APPEND MEDIA TILE
--------------------------------------------------------- */
function appendMedia(box, wrap, src, type, post, title) {

    if (!src) {
        results.innerHTML += `
            <div class='post' style="padding:12px; color:#f88;">
                Missing media for ${post.url}
            </div>`;
        return;
    }

    const el =
        type === "image"
        ? createImage(src)
        : createVideo(src, type === "gif");

    el.style.cursor = "pointer";
    addSafeTap(el, () => openLarge(src));

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
   GALLERY (JSON-BASED)
--------------------------------------------------------- */
function renderGallery(box, wrap, sources, post, title) {

    if (!sources || !sources.length) {
        results.innerHTML += `
            <div class='post' style='padding:12px; color:#f88;'>
                Gallery contains no usable images.<br>${post.url}
            </div>`;
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

    setupTitleBehavior(title);
    results.appendChild(wrap);
}


/* ---------------------------------------------------------
   RENDER POST
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

    const isImg = /\.(jpg|jpeg|png|webp)$/i.test(url);
    const isVid = post.is_video || url.endsWith(".mp4") || url.includes("youtu");
    const isOther = !isImg && !isVid;

    if (!imagesChk.checked && isImg) return;
    if (!videosChk.checked && isVid) return;
    if (!otherChk.checked && isOther) return;

    /* GALLERY: JSON method first */
    if (post.is_gallery && post.media_metadata && post.gallery_data) {

        const ids = post.gallery_data.items.map(i => i.media_id);

        const sources = ids.map(id => {
            const meta = post.media_metadata[id];
            if (!meta) return null;

            let src = meta.s?.u || meta.s?.gif || meta.s?.mp4;

            if (!src && meta.p?.length)
                src = meta.p[meta.p.length - 1].u;

            return src ? src.replace(/&amp;/g,"&") : null;
        }).filter(Boolean);

        if (sources.length > 0) {
            renderGallery(box, wrap, sources, post, title);
            return;
        }
    }

    /* FALLBACK: HTML scrape via Worker for broken galleries */
    if (post.url.includes("/gallery/")) {
        try {
            const res = await fetch(REDDIT_GALLERY_PROXY + encodeURIComponent(post.url));
            const json = await res.json();

            if (json?.images?.length)
                return renderGallery(box, wrap, json.images, post, title);

        } catch {}
    }

    /* IMAGE */
    if (isImg) {
        appendMedia(box, wrap, url, "image", post, title);
        return;
    }

    /* REDGIFS */
    if (isRedgifsURL(url)) {
        const mp4 = await fetchRedgifsMP4(url);
        if (mp4) {
            appendMedia(box, wrap, mp4, "gif", post, title);
            return;
        }
    }

    /* GIF → MP4 */
    if (isGifURL(url)) {
        const mp4 = convertGif(url);
        if (mp4) {
            appendMedia(box, wrap, mp4, "gif", post, title);
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
            title
        );
        return;
    }

    /* YOUTUBE */
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

    /* TEXT */
    renderText(post);
}


/* ---------------------------------------------------------
   SCROLL TO TOP
--------------------------------------------------------- */
scrollTopBtn.onclick = () =>
    window.scrollTo({ top: 0, behavior: "smooth" });


/* ---------------------------------------------------------
   INFINITE SCROLL
--------------------------------------------------------- */
async function loadMore() {
    if (loadingMore || !afterToken || !currentUser) return;

    loadingMore = true;

    try {
        const mode = modeSelect.value === "r" ? "r" : "user";

        const url =
            `https://api.reddit.com/${mode}/${currentUser}/submitted?raw_json=1&after=${afterToken}`;

        const res = await fetch(url);

        if (!res.ok) {
            results.innerHTML += `
                <div class='post' style="padding:12px; color:#f88;">
                    Infinite scroll error ${res.status}
                </div>`;
            loadingMore = false;
            return;
        }

        const json = await res.json();
        if (!json?.data?.children) {
            results.innerHTML += `
                <div class='post' style="padding:12px; color:#f88;">
                    Unexpected Reddit response.
                </div>`;
            loadingMore = false;
            return;
        }

        afterToken = json.data.after;

        for (const c of json.data.children)
            await renderPost(c.data);

    } catch (err) {
        results.innerHTML += `
            <div class='post' style="padding:12px; color:#f88;">
                Infinite scroll network error:<br>${err}
            </div>`;
    }

    loadingMore = false;
}

window.addEventListener("scroll", async () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1200)
        await loadMore();
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
        results.innerHTML = `
            <div class='post' style="padding:12px; color:#f88;">
                Invalid username or subreddit.
            </div>`;
        return;
    }

    currentUser = target;

    const mode = modeSelect.value === "r" ? "r" : "user";
    const url =
        `https://api.reddit.com/${mode}/${target}/submitted?raw_json=1`;

    try {
        const res = await fetch(url);

        if (!res.ok) {
            results.innerHTML = `
                <div class='post' style="padding:12px; color:#f88;">
                    Reddit error ${res.status}
                </div>`;
            return;
        }

        const json = await res.json();
        if (!json?.data?.children) {
            results.innerHTML =
                `<div class='post' style="padding:12px; color:#f88;">
                    Unexpected Reddit response.
                </div>`;
            return;
        }

        afterToken = json.data.after;

        for (const c of json.data.children)
            await renderPost(c.data);

    } catch (err) {
        results.innerHTML = `
            <div class='post' style="padding:12px; color:#f88;">
                Network failure loading posts:<br>${err}
            </div>`;
    }
};


/* ---------------------------------------------------------
   MISC BUTTONS
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

exampleBtn.onclick = () => {
    input.value = "https://www.reddit.com/user/Euna_Chris/submitted/";
    loadBtn.click();
};


/* END OF FILE v1.2.6 */
