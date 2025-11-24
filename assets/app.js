/* =========================================================
   app.js — v1.1.33
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
const scrollTopBtn = document.getElementById("scrollTopBtn");
const colToggleBtn = document.getElementById("colToggleBtn");

/* ---------------------------------------------------------
   Globals
--------------------------------------------------------- */

const REDGIFS_PROXY = "https://red.coffeemanhou.workers.dev/?id=";

let currentUser = null;
let afterToken = null;
let loadingMore = false;

let postMediaList = [];
const seenPostURLs = new Set();
let forcedMode = null;

/* ---------------------------------------------------------
   Version
--------------------------------------------------------- */

window.addEventListener("DOMContentLoaded", () => {
    const box = document.getElementById("js-version");
    if (box) box.textContent = "v1.1.33";
});

/* ---------------------------------------------------------
   Columns
--------------------------------------------------------- */

function applyColumnMode() {
    const grid = document.getElementById("results");
    grid.classList.remove("force-3-cols", "force-2-cols");

    if (forcedMode === "2") {
        grid.classList.add("force-2-cols");
        colToggleBtn.textContent = "Columns: 2";
    } else if (forcedMode === "3") {
        grid.classList.add("force-3-cols");
        colToggleBtn.textContent = "Columns: 3";
    } else {
        colToggleBtn.textContent = "Columns: 3";
    }
}

colToggleBtn.onclick = () => {
    forcedMode = (!forcedMode || forcedMode === "3") ? "2" : "3";
    applyColumnMode();
};

/* ---------------------------------------------------------
   Username extraction
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

    if (/^[A-Za-z0-9_-]+$/.test(text)) return text;

    return null;
}

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

        const json = await res.json();
        return json.mp4 || null;
    } catch {
        return null;
    }
}

/* ---------------------------------------------------------
   Media helpers
--------------------------------------------------------- */

function isGif(url) {
    return (
        url &&
        (url.endsWith(".gif") ||
         url.endsWith(".gifv") ||
         url.includes("gfycat") ||
         (url.includes("imgur") && url.includes("gif")))
    );
}

function convertGifToMP4(url) {
    if (url.endsWith(".gifv")) return url.replace(".gifv", ".mp4");
    if (url.endsWith(".gif")) return url.replace(".gif", ".mp4");
    return url;
}

/* ---------------------------------------------------------
   Title collapse
--------------------------------------------------------- */

function setupTitleBehavior(titleDiv) {
    const text = titleDiv.textContent.trim();
    if (!text) return;

    const test = document.createElement("div");
    test.style.position = "absolute";
    test.style.visibility = "hidden";
    test.style.whiteSpace = "nowrap";
    test.style.fontSize = window.getComputedStyle(titleDiv).fontSize;
    test.textContent = text;
    document.body.appendChild(test);

    const fullWidth = test.clientWidth;
    test.remove();

    if (fullWidth <= titleDiv.clientWidth) return;

    const arrow = document.createElement("span");
    arrow.className = "title-arrow";
    arrow.textContent = "⌄";
    titleDiv.appendChild(arrow);

    arrow.onclick = e => {
        e.stopPropagation();
        const expanded = titleDiv.classList.toggle("full");
        arrow.textContent = expanded ? "⌃" : "⌄";
        titleDiv.style.whiteSpace = expanded ? "normal" : "nowrap";
        titleDiv.style.maxHeight = expanded ? "400px" : "1.4em";
    };
}

/* ---------------------------------------------------------
   Ignore OF promotional posts
--------------------------------------------------------- */

function shouldIgnorePost(post) {
    const fields = [
        post.title,
        post.selftext,
        post.url
    ];

    for (const f of fields) {
        if (!f) continue;
        const t = f.toLowerCase();
        if (t.includes("onlyfans.com")) return true;
        if (t.includes("onlyfans")) return true;
    }
    return false;
}

/* ---------------------------------------------------------
   Clean BROKEN gallery
--------------------------------------------------------- */

function renderCollapsedBrokenGallery(post) {
    const div = document.createElement("div");
    div.className = "post";

    const title = document.createElement("div");
    title.className = "post-title";
    title.textContent = post.title || "";
    div.appendChild(title);

    const media = document.createElement("div");
    media.className = "tile-media";

    const ph = document.createElement("div");
    ph.className = "placeholder-media";
    ph.textContent = "Text Post";

    media.appendChild(ph);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.textContent = post.url;

    div.appendChild(media);
    div.appendChild(urlLine);

    setupTitleBehavior(title);
    results.appendChild(div);
}

/* ---------------------------------------------------------
   Fullscreen viewer
--------------------------------------------------------- */

let fullscreenOverlay = null;
let fullscreenImg = null;
let fullscreenImages = [];
let fullscreenIndex = 0;

function openFullscreenGallery(images, start) {
    fullscreenImages = images;
    fullscreenIndex = start;

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
}

function closeFullscreenGallery() {
    if (!fullscreenOverlay) return;
    fullscreenOverlay.remove();
    fullscreenOverlay = null;
}

/* ---------------------------------------------------------
   Append media
--------------------------------------------------------- */

function appendMedia(mediaBox, container, src, type, post, titleDiv) {
    const el =
        type === "image" ? createImage(src) :
        type === "video" ? createVideo(src) :
        type === "gif"   ? createVideo(src, true) :
        null;

    mediaBox.appendChild(el);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.textContent = post.url;

    container.appendChild(mediaBox);
    container.appendChild(urlLine);

    setupTitleBehavior(titleDiv);

    postMediaList.push({ type, src, postId: post.id });
}

function createImage(src) {
    const i = document.createElement("img");
    i.src = src;
    return i;
}

function createVideo(src, autoplay = false) {
    const v = document.createElement("video");
    v.src = src;
    v.controls = !autoplay;
    v.autoplay = autoplay;
    v.loop = autoplay;
    v.muted = autoplay;
    return v;
}

function appendIframe(mediaBox, container, src, titleDiv) {
    const f = document.createElement("iframe");
    f.src = src;
    f.allow = "autoplay; encrypted-media";
    mediaBox.appendChild(f);
    container.appendChild(mediaBox);
    setupTitleBehavior(titleDiv);
}

/* ---------------------------------------------------------
   Gallery render
--------------------------------------------------------- */

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

    left.onclick = e => {
        e.stopPropagation();
        index = (index - 1 + images.length) % images.length;
        update();
    };

    right.onclick = e => {
        e.stopPropagation();
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

/* ---------------------------------------------------------
   Broken gallery fallback
--------------------------------------------------------- */

function tryAggressiveGalleryRecovery(id) {
    return id ? `https://i.redd.it/${id}.jpg` : null;
}

/* ---------------------------------------------------------
   Main render
--------------------------------------------------------- */

async function renderPost(post) {

    if (shouldIgnorePost(post)) return;

    if (seenPostURLs.has(post.url)) return;
    seenPostURLs.add(post.url);

    const div = document.createElement("div");
    div.className = "post";

    const titleDiv = document.createElement("div");
    titleDiv.className = "post-title";
    titleDiv.textContent = post.title || "";
    div.appendChild(titleDiv);

    const mediaBox = document.createElement("div");
    mediaBox.className = "tile-media";

    const url = post.url || "";

    /* --------- GALLERY --------- */

    if (post.is_gallery &&
        post.media_metadata &&
        post.gallery_data) {

        const ids = post.gallery_data.items.map(i => i.media_id);

        const imgs = ids.map(id => {
            const meta = post.media_metadata[id];
            if (!meta) return null;

            let src =
                meta?.s?.u ||
                meta?.s?.gif ||
                meta?.s?.mp4 ||
                (meta?.p?.length ? meta.p[meta.p.length - 1].u : null);

            return src ? src.replace(/&amp;/g, "&") :
                tryAggressiveGalleryRecovery(id);
        }).filter(Boolean);

        if (!imgs.length) {
            renderCollapsedBrokenGallery(post);
            return;
        }

        renderGallery(mediaBox, div, imgs, post, titleDiv);
        return;
    }

    /* --------- IMAGE --------- */

    if (url.match(/\.(jpg|jpeg|png|webp)$/i)) {
        appendMedia(mediaBox, div, url, "image", post, titleDiv);
        return;
    }

    /* --------- REDGIFS --------- */

    if (isRedgifsURL(url)) {
        const mp4 = await fetchRedgifsMP4(url);
        if (mp4) {
            appendMedia(mediaBox, div, mp4, "gif", post, titleDiv);
            return;
        }
    }

    /* --------- YOUTUBE --------- */

    if (url.includes("youtube") || url.includes("youtu.be")) {
        let id = null;
        let m = url.match(/v=([^&]+)/);
        if (m) id = m[1];

        m = url.match(/youtu\.be\/([^?]+)/);
        if (!id && m) id = m[1];

        if (id) {
            appendIframe(
                mediaBox, div,
                `https://www.youtube.com/embed/${id}`,
                titleDiv
            );
            return;
        }
    }

    /* --------- GIF --------- */

    if (isGif(url)) {
        appendMedia(mediaBox, div, convertGifToMP4(url), "gif", post, titleDiv);
        return;
    }

    /* --------- REDDIT VIDEO --------- */

    if (post.is_video && post.media?.reddit_video?.fallback_url) {
        appendMedia(
            mediaBox, div,
            post.media.reddit_video.fallback_url,
            "video",
            post, titleDiv
        );
        return;
    }

    /* --------- IMAGE (post_hint) --------- */

    if (post.post_hint === "image") {
        appendMedia(mediaBox, div, url, "image", post, titleDiv);
        return;
    }

    /* --------- TEXT / OTHER --------- */

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

/* ---------------------------------------------------------
   Load posts
--------------------------------------------------------- */

loadBtn.onclick = async () => {
    results.innerHTML = "";
    seenPostURLs.clear();
    postMediaList = [];
    afterToken = null;
    loadingMore = false;

    const txt = input.value.trim();
    const user = extractUsername(txt);

    if (!user) {
        results.innerHTML = "<div class='post'>Invalid username or URL.</div>";
        return;
    }

    currentUser = user;

    try {
        const baseURL =
            `https://api.reddit.com/user/${user}/submitted?raw_json=1`;

        const res = await fetch(baseURL);
        if (!res.ok) throw 0;

        const json = await res.json();
        afterToken = json.data.after;

        for (const p of json.data.children) {
            await renderPost(p.data);
        }

    } catch {
        results.innerHTML = "<div class='post'>Failed loading posts.</div>";
    }
};

/* ---------------------------------------------------------
   Infinite scroll
--------------------------------------------------------- */

window.addEventListener("scroll", async () => {
    if (
        !loadingMore &&
        afterToken &&
        currentUser &&
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 1200
    ) {
        loadingMore = true;

        try {
            const url =
                `https://api.reddit.com/user/${currentUser}/submitted?raw_json=1&after=${afterToken}`;

            const res = await fetch(url);
            if (res.ok) {
                const json = await res.json();
                afterToken = json.data.after;

                for (const p of json.data.children) {
                    await renderPost(p.data);
                }
            }
        } catch {}

        loadingMore = false;
    }
});

/* ---------------------------------------------------------
   Buttons
--------------------------------------------------------- */

scrollTopBtn.onclick = () =>
    window.scrollTo({ top: 0, behavior: "smooth" });

clearBtn.onclick = () => {
    input.value = "";
    results.innerHTML = "";
    seenPostURLs.clear();
    postMediaList = [];
    currentUser = null;
    afterToken = null;
};

copyBtn.onclick = () =>
    navigator.clipboard.writeText(input.value.trim());

zipBtn.onclick = () =>
    alert("ZIP downloads coming soon");

/* =========================================================
   END app.js v1.1.33
   ========================================================= */
