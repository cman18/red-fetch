/* =========================================================
   app.js
   Version: v1.1.29 — Dedupe + Broken Gallery Fix + Redgifs
   ========================================================= */

window.addEventListener("DOMContentLoaded", async () => {
    const box = document.getElementById("js-version");
    if (box) box.textContent = "v1.1.29";

    /* Fetch Redgifs anonymous token at startup */
    try {
        const authRes = await fetch("https://api.redgifs.com/v2/auth/temporary", {
            method: "POST"
        });

        const authJson = await authRes.json();
        window.redgifsAuth = authJson.token;
    } catch (e) {
        window.redgifsAuth = null;
    }
});

/* =========================================================
   COLUMN TOGGLE
   ========================================================= */

const resultsGrid = document.getElementById("results");
const colToggleBtn = document.getElementById("colToggleBtn");
let forcedMode = null;

function applyColumnMode() {
    resultsGrid.classList.remove("force-3-cols", "force-2-cols");

    if (forcedMode === "2") {
        resultsGrid.classList.add("force-2-cols");
        colToggleBtn.textContent = "Columns: 2";
    } else if (forcedMode === "3") {
        resultsGrid.classList.add("force-3-cols");
        colToggleBtn.textContent = "Columns: 3";
    } else {
        colToggleBtn.textContent = "Columns: 3";
    }
}

colToggleBtn.onclick = () => {
    forcedMode = (forcedMode === "3" || forcedMode === null) ? "2" : "3";
    applyColumnMode();
};

/* =========================================================
   REDGIFS TOKEN + URL EXTRACTION
   ========================================================= */

function isRedgifsURL(url) {
    if (!url) return false;
    return url.includes("redgifs.com");
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

    for (let p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
    }
    return null;
}

async function fetchRedgifsMP4(url) {
    const slug = extractRedgifsSlug(url);
    if (!slug || !window.redgifsAuth) return null;

    try {
        const apiURL = `https://api.redgifs.com/v2/gifs/${slug}`;

        const res = await fetch(apiURL, {
            headers: {
                Authorization: `Bearer ${window.redgifsAuth}`
            }
        });

        if (!res.ok) return null;

        const json = await res.json();
        const hd = json?.gif?.urls?.hd;
        const sd = json?.gif?.urls?.sd;

        return hd || sd || null;
    } catch {
        return null;
    }
}

/* =========================================================
   USERNAME PARSER
   ========================================================= */

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

/* =========================================================
   GLOBAL DEDUPE SET
   ========================================================= */

const seenPostURLs = new Set();

/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const input  = document.getElementById("input");
const loadBtn = document.getElementById("loadBtn");
const clearBtn = document.getElementById("clearBtn");
const copyBtn  = document.getElementById("copyBtn");
const zipBtn   = document.getElementById("zipBtn");
const scrollTopBtn = document.getElementById("scrollTopBtn");

const imgFilter   = document.getElementById("imgFilter");
const vidFilter   = document.getElementById("vidFilter");
const otherFilter = document.getElementById("otherFilter");

let postMediaList = [];

/* =========================================================
   LOAD POSTS (dedupe built-in)
   ========================================================= */

async function loadPosts() {
    results.innerHTML = "";
    postMediaList = [];
    seenPostURLs.clear();

    const raw = input.value.trim();
    const username = extractUsername(raw);

    if (!username) {
        results.innerHTML = "<div class='post'>Invalid username or URL.</div>";
        return;
    }

    try {
        const url = `https://api.reddit.com/user/${username}/submitted?raw_json=1`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Reddit blocked fetch");

        const data = await res.json();
        const posts = data.data.children;

        if (!posts.length) {
            results.innerHTML = "<div class='post'>No posts found.</div>";
            return;
        }

        for (const p of posts) {
            const post = p.data;

            // NEW: DEDUPLICATION
            if (seenPostURLs.has(post.url)) continue;
            seenPostURLs.add(post.url);

            await renderPost(post);
        }

    } catch (err) {
        results.innerHTML = `<div class='post'>Error loading posts: ${err.message}</div>`;
    }
}

/* =========================================================
   TITLE STRIP
   ========================================================= */

function setupTitleBehavior(titleDiv) {
    const text = titleDiv.textContent.trim();
    if (!text) return;

    const measure = document.createElement("div");
    measure.style.position = "absolute";
    measure.style.visibility = "hidden";
    measure.style.whiteSpace = "nowrap";
    measure.style.fontSize = window.getComputedStyle(titleDiv).fontSize;
    measure.textContent = text;
    document.body.appendChild(measure);

    const fullWidth = measure.clientWidth;
    measure.remove();

    const containerWidth = titleDiv.clientWidth;
    if (fullWidth <= containerWidth) return;

    const arrow = document.createElement("span");
    arrow.className = "title-arrow";
    arrow.textContent = "⌄";

    titleDiv.appendChild(arrow);

    arrow.onclick = (e) => {
        e.stopPropagation();
        const expanded = titleDiv.classList.toggle("full");

        arrow.textContent = expanded ? "⌃" : "⌄";
        titleDiv.style.whiteSpace = expanded ? "normal" : "nowrap";
        titleDiv.style.maxHeight = expanded ? "400px" : "1.4em";
    };
}

/* =========================================================
   GALLERY RECOVERY STEP
   ========================================================= */

function tryAggressiveGalleryRecovery(id) {
    if (!id) return null;

    return (
        `https://i.redd.it/${id}.jpg` ||
        `https://i.redd.it/${id}.png` ||
        `https://preview.redd.it/${id}.jpg` ||
        `https://preview.redd.it/${id}.png`
    );
}

/* =========================================================
   BROKEN GALLERY UI
   ========================================================= */

function renderBrokenGallery(mediaBox, container, post, titleDiv) {
    const box = document.createElement("div");
    box.className = "placeholder-media";
    box.textContent = "Gallery unavailable (Reddit sent broken data)";
    mediaBox.appendChild(box);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.textContent = post.url;

    container.appendChild(mediaBox);
    container.appendChild(urlLine);

    setupTitleBehavior(titleDiv);
    results.appendChild(container);
}

/* =========================================================
   RENDER POST
   ========================================================= */

async function renderPost(post) {
    const div = document.createElement("div");
    div.className = "post";

    const titleDiv = document.createElement("div");
    titleDiv.className = "post-title";
    titleDiv.textContent = post.title || "";
    div.appendChild(titleDiv);

    const mediaBox = document.createElement("div");
    mediaBox.className = "tile-media";

    const url = post.url || "";

    /* -------------------------
       GALLERY HANDLING (fixed)
       ------------------------- */

    if (post.is_gallery && post.media_metadata && post.gallery_data) {
        const ids = post.gallery_data.items.map(x => x.media_id);

        let imgs = ids.map(id => {
            const meta = post.media_metadata[id];
            if (!meta) return null;

            let src =
                meta?.s?.u ||
                meta?.s?.gif ||
                meta?.s?.mp4 ||
                (meta?.p?.length > 0 ? meta.p[meta.p.length - 1].u : null);

            if (src) return src.replace(/&amp;/g, "&");

            // aggressive fallback
            return tryAggressiveGalleryRecovery(id);
        });

        imgs = imgs.filter(Boolean);

        if (imgs.length) {
            renderGallery(mediaBox, div, imgs, post, titleDiv);
            return;
        }

        // broken metadata entirely
        renderBrokenGallery(mediaBox, div, post, titleDiv);
        return;
    }

    /* -------------------------
       DIRECT IMAGE
       ------------------------- */

    if (imgFilter.checked && url.match(/\.(jpg|jpeg|png|webp)$/i)) {
        appendMedia(mediaBox, div, url, "image", post, titleDiv);
        return;
    }

    /* -------------------------
       REDGIFS
       ------------------------- */

    if (imgFilter.checked && isRedgifsURL(url)) {
        const mp4 = await fetchRedgifsMP4(url);
        if (mp4) {
            appendMedia(mediaBox, div, mp4, "gif", post, titleDiv);
            return;
        }
    }

    /* ------------------------- */
    if (
        otherFilter.checked &&
        (url.includes("youtube.com") || url.includes("youtu.be"))
    ) {
        let id = null;
        const m1 = url.match(/v=([^&]+)/);
        if (m1) id = m1[1];

        const m2 = url.match(/youtu\.be\/([^?]+)/);
        if (!id && m2) id = m2[1];

        if (id) {
            appendIframe(mediaBox, div,
                `https://www.youtube.com/embed/${id}`,
                titleDiv
            );
            return;
        }
    }

    /* ------------------------- */

    if (imgFilter.checked && isGif(url)) {
        appendMedia(mediaBox, div, convertGifToMP4(url), "gif", post, titleDiv);
        return;
    }

    if (imgFilter.checked && post.post_hint === "image") {
        appendMedia(mediaBox, div, url, "image", post, titleDiv);
        return;
    }

    /* ------------------------- */

    if (
        vidFilter.checked &&
        post.is_video &&
        post.media?.reddit_video?.fallback_url
    ) {
        appendMedia(
            mediaBox,
            div,
            post.media.reddit_video.fallback_url,
            "video",
            post,
            titleDiv
        );
        return;
    }

    /* -------------------------
       TEXT POST
       ------------------------- */

    const ph = document.createElement("div");
    ph.className = "placeholder-media";
    ph.textContent = "Text Post";
    mediaBox.appendChild(ph);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.textContent = url;

    div.appendChild(mediaBox);
    div.appendChild(urlLine);

    setupTitleBehavior(titleDiv);
    results.appendChild(div);
}

/* =========================================================
   RENDER GALLERY
   ========================================================= */

function renderGallery(mediaBox, container, images, post, titleDiv) {
    let index = 0;

    const img = document.createElement("img");
    img.src = images[0];
    img.onclick = () => openFullscreenGallery(images, index);

    const left = document.createElement("div");
    left.className = "gallery-arrow-main gallery-arrow-main-left";
    left.textContent = "<";

    const right = document.createElement("div");
    right.className = "gallery-arrow-main gallery-arrow-main-right";
    right.textContent = ">";

    const update = () => { img.src = images[index]; };

    left.onclick = ev => {
        ev.stopPropagation();
        index = (index - 1 + images.length) % images.length;
        update();
    };

    right.onclick = ev => {
        ev.stopPropagation();
        index = (index + 1) % images.length;
        update();
    };

    mediaBox.appendChild(img);
    mediaBox.appendChild(left);
    mediaBox.appendChild(right);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.textContent = post.url;

    container.appendChild(mediaBox);
    container.appendChild(urlLine);

    setupTitleBehavior(titleDiv);
    results.appendChild(container);
}

/* =========================================================
   FULLSCREEN GALLERY
   ========================================================= */

let fullscreenOverlay = null;
let fullscreenImg = null;
let fullscreenIndex = 0;
let fullscreenImages = [];

function openFullscreenGallery(images, startIndex) {
    fullscreenImages = images;
    fullscreenIndex = startIndex || 0;

    fullscreenOverlay = document.createElement("div");
    fullscreenOverlay.className = "fullscreen-media";

    fullscreenImg = document.createElement("img");
    fullscreenImg.src = fullscreenImages[fullscreenIndex];

    const left = document.createElement("div");
    left.className = "gallery-arrow gallery-arrow-left";
    left.textContent = "<";

    const right = document.createElement("div");
    right.className = "gallery-arrow gallery-arrow-right";
    right.textContent = ">";

    left.onclick = e => {
        e.stopPropagation();
        fullscreenIndex =
            (fullscreenIndex - 1 + fullscreenImages.length) %
            fullscreenImages.length;
        fullscreenImg.src = fullscreenImages[fullscreenIndex];
    };

    right.onclick = e => {
        e.stopPropagation();
        fullscreenIndex =
            (fullscreenIndex + 1) % fullscreenImages.length;
        fullscreenImg.src = fullscreenImages[fullscreenIndex];
    };

    fullscreenOverlay.onclick = () => closeFullscreenGallery();

    fullscreenOverlay.appendChild(fullscreenImg);
    fullscreenOverlay.appendChild(left);
    fullscreenOverlay.appendChild(right);

    document.body.appendChild(fullscreenOverlay);

    document.addEventListener("keydown", fullscreenKeyHandler);
}

function closeFullscreenGallery() {
    if (!fullscreenOverlay) return;
    fullscreenOverlay.remove();
    fullscreenOverlay = null;
    fullscreenImg = null;
    fullscreenImages = [];
    fullscreenIndex = 0;
    document.removeEventListener("keydown", fullscreenKeyHandler);
}

function fullscreenKeyHandler(e) {
    if (e.key === "Escape") return closeFullscreenGallery();

    if (e.key === "ArrowRight") {
        fullscreenIndex =
            (fullscreenIndex + 1) % fullscreenImages.length;
        fullscreenImg.src = fullscreenImages[fullscreenIndex];
    }

    if (e.key === "ArrowLeft") {
        fullscreenIndex =
            (fullscreenIndex - 1 + fullscreenImages.length) %
            fullscreenImages.length;
        fullscreenImg.src = fullscreenImages[fullscreenIndex];
    }
}

/* =========================================================
   MEDIA + IFRAMES
   ========================================================= */

function appendMedia(mediaBox, container, src, type, post, titleDiv) {
    let el;

    if (type === "video" || type === "gif") {
        el = document.createElement("video");
        el.src = src;
        el.controls = type === "video";
        el.autoplay = type === "gif";
        el.loop = type === "gif";
        el.muted = type === "gif";
    } else {
        el = document.createElement("img");
        el.src = src;
    }

    mediaBox.appendChild(el);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.textContent = post.url;

    container.appendChild(mediaBox);
    container.appendChild(urlLine);

    setupTitleBehavior(titleDiv);

    postMediaList.push({ type, src, postId: post.id });
}

function appendIframe(mediaBox, container, src, titleDiv) {
    const iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.allow = "autoplay; encrypted-media";
    mediaBox.appendChild(iframe);

    container.appendChild(mediaBox);
    setupTitleBehavior(titleDiv);
}

/* =========================================================
   BUTTONS
   ========================================================= */

scrollTopBtn.onclick = () =>
    window.scrollTo({ top: 0, behavior: "smooth" });

loadBtn.onclick = loadPosts;

clearBtn.onclick = () => {
    input.value = "";
    results.innerHTML = "";
    postMediaList = [];
    forcedMode = null;
    colToggleBtn.textContent = "Columns: 3";
    applyColumnMode();
};

copyBtn.onclick = () =>
    navigator.clipboard.writeText(input.value.trim());

zipBtn.onclick = () =>
    alert("ZIP downloads coming soon");

/* END app.js v1.1.29 */
