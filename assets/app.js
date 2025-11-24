/* =========================================================
   app.js — Version v1.1.34
   ========================================================= */

/* -------------------- DOM -------------------- */

const results = document.getElementById("results");
const input = document.getElementById("input");
const loadBtn = document.getElementById("loadBtn");
const clearBtn = document.getElementById("clearBtn");
const copyBtn = document.getElementById("copyBtn");
const zipBtn = document.getElementById("zipBtn");
const scrollTopBtn = document.getElementById("scrollTopBtn");
const resultsGrid = document.getElementById("results");
const colToggleBtn = document.getElementById("colToggleBtn");

/* -------------------- Globals -------------------- */

const REDGIFS_PROXY = "https://red.coffeemanhou.workers.dev/?id=";

let afterToken = null;
let loadingMore = false;
let currentUser = null;
let forcedMode = null;
let postMediaList = [];
const seenPostURLs = new Set();

/* -------------------- Column Toggle -------------------- */

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
    forcedMode = (!forcedMode || forcedMode === "3") ? "2" : "3";
    applyColumnMode();
};

/* -------------------- Username Parsing -------------------- */

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

/* -------------------- Redgifs helpers -------------------- */

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

/* -------------------- Helpers -------------------- */

function isGif(url) {
    return (
        url &&
        (url.endsWith(".gif") ||
         url.endsWith(".gifv") ||
         url.includes("gfycat") ||
         (url.includes("imgur.com") && url.includes("gif")))
    );
}

function convertGifToMP4(url) {
    if (url.endsWith(".gifv")) return url.replace(".gifv", ".mp4");
    if (url.endsWith(".gif")) return url.replace(".gif", ".mp4");
    return url;
}

/* -------------------- Title collapse -------------------- */

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
        titleDiv.style.maxHeight = expanded ? "400px" : "1.4em";
    };
}

/* -------------------- OnlyFans filter -------------------- */

function shouldSkipOF(post) {
    const t = (post.title || "").toLowerCase();
    const s = (post.selftext || "").toLowerCase();
    const u = (post.url || "").toLowerCase();

    if (t.includes("onlyfans") || s.includes("onlyfans") || u.includes("onlyfans.com"))
        return true;

    return false;
}

/* -------------------- Broken gallery fallback -------------------- */

function renderCollapsedBrokenGallery(post) {
    const div = document.createElement("div");
    div.className = "post";

    const titleDiv = document.createElement("div");
    titleDiv.className = "post-title";
    titleDiv.textContent = post.title || "";
    div.appendChild(titleDiv);

    const mediaBox = document.createElement("div");
    mediaBox.className = "tile-media";

    const placeholder = document.createElement("div");
    placeholder.className = "placeholder-media";
    placeholder.textContent = "Text Post";
    mediaBox.appendChild(placeholder);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.innerHTML = `<a href="${post.url}" target="_blank">${post.url}</a>`;

    div.appendChild(mediaBox);
    div.appendChild(urlLine);

    setupTitleBehavior(titleDiv);
    results.appendChild(div);
}

/* -------------------- Render Post -------------------- */

async function renderPost(post) {
    if (shouldSkipOF(post)) return;

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

    /* ------- REAL GALLERY ------- */
    if (post.is_gallery && post.media_metadata && post.gallery_data) {
        const ids = post.gallery_data.items.map(x => x.media_id);

        const imgs = ids.map(id => {
            const meta = post.media_metadata[id];
            if (!meta) return null;

            let src = meta?.s?.u || meta?.s?.gif || meta?.s?.mp4;

            if (!src && meta?.p?.length) {
                src = meta.p[meta.p.length - 1].u;
            }

            if (src) return src.replace(/&amp;/g, "&");

            return id ? `https://i.redd.it/${id}.jpg` : null;
        }).filter(Boolean);

        if (!imgs.length) {
            renderCollapsedBrokenGallery(post);
            return;
        }

        renderGallery(mediaBox, div, imgs, post, titleDiv);
        return;
    }

    /* ------- IMAGE ------- */
    if (url.match(/\.(jpg|jpeg|png|webp)$/i)) {
        appendMedia(mediaBox, div, url, "image", post, titleDiv);
        return;
    }

    /* ------- REDGIFS ------- */
    if (isRedgifsURL(url)) {
        const mp4 = await fetchRedgifsMP4(url);
        if (mp4) {
            appendMedia(mediaBox, div, mp4, "gif", post, titleDiv);
            return;
        }
    }

    /* ------- YOUTUBE ------- */
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
        let id = null;

        const m1 = url.match(/v=([^&]+)/);
        if (m1) id = m1[1];

        const m2 = url.match(/youtu\.be\/([^?]+)/);
        if (!id && m2) id = m2[1];

        if (id) {
            appendIframe(mediaBox, div, `https://www.youtube.com/embed/${id}`, titleDiv);
            return;
        }
    }

    /* ------- GIF ------- */
    if (isGif(url)) {
        appendMedia(mediaBox, div, convertGifToMP4(url), "gif", post, titleDiv);
        return;
    }

    /* ------- REDDIT VIDEO ------- */
    if (post.is_video && post.media?.reddit_video?.fallback_url) {
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

    /* ------- NORMAL IMAGE HINT ------- */
    if (post.post_hint === "image") {
        appendMedia(mediaBox, div, url, "image", post, titleDiv);
        return;
    }

    /* ------- TEXT POST ------- */
    const placeholder = document.createElement("div");
    placeholder.className = "placeholder-media";
    placeholder.textContent = "Text Post";
    mediaBox.appendChild(placeholder);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.innerHTML = `<a href="${url}" target="_blank">${url}</a>`;

    div.appendChild(mediaBox);
    div.appendChild(urlLine);

    setupTitleBehavior(titleDiv);
    results.appendChild(div);
}

/* -------------------- Gallery Renderer -------------------- */

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
    urlLine.innerHTML = `<a href="${post.url}" target="_blank">${post.url}</a>`;

    container.appendChild(mediaBox);
    container.appendChild(urlLine);

    setupTitleBehavior(titleDiv);
    results.appendChild(container);
}

/* -------------------- Fullscreen gallery -------------------- */

let fullscreenOverlay = null;
let fullscreenImg = null;
let fullscreenImages = [];
let fullscreenIndex = 0;

function openFullscreenGallery(images, startIndex) {
    fullscreenImages = images;
    fullscreenIndex = startIndex;

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

/* -------------------- Media helpers -------------------- */

function appendMedia(mediaBox, container, src, type, post, titleDiv) {
    const el =
        type === "video" || type === "gif"
            ? createVideo(src, type)
            : createImage(src);

    mediaBox.appendChild(el);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.innerHTML = `<a href="${post.url}" target="_blank">${post.url}</a>`;

    container.appendChild(mediaBox);
    container.appendChild(urlLine);

    setupTitleBehavior(titleDiv);

    postMediaList.push({ type, src, postId: post.id });
}

function createVideo(src, type) {
    const v = document.createElement("video");
    v.src = src;
    v.controls = (type === "video");
    v.autoplay = (type === "gif");
    v.loop = (type === "gif");
    v.muted = (type === "gif");
    return v;
}

function createImage(src) {
    const i = document.createElement("img");
    i.src = src;
    return i;
}

function appendIframe(mediaBox, container, src, titleDiv) {
    const iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.allow = "autoplay; encrypted-media";
    mediaBox.appendChild(iframe);

    container.appendChild(mediaBox);
    setupTitleBehavior(titleDiv);
}

/* -------------------- Scroll-To-Top -------------------- */

scrollTopBtn.onclick = () =>
    window.scrollTo({ top: 0, behavior: "smooth" });

/* -------------------- Infinite Scroll -------------------- */

async function loadMorePosts() {
    if (loadingMore || !afterToken || !currentUser) return;

    loadingMore = true;

    try {
        const url =
            `https://api.reddit.com/user/${currentUser}/submitted?raw_json=1&after=${afterToken}`;

        const res = await fetch(url);
        if (!res.ok) return;

        const data = await res.json();
        afterToken = data.data.after;

        for (const p of data.data.children) {
            await renderPost(p.data);
        }
    } catch {}

    loadingMore = false;
}

window.addEventListener("scroll", async () => {
    const nearBottom =
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 1200;

    if (nearBottom) await loadMorePosts();
});

/* -------------------- Load Posts -------------------- */

loadBtn.onclick = async () => {
    results.innerHTML = "";
    seenPostURLs.clear();
    postMediaList = [];
    afterToken = null;
    loadingMore = false;

    const raw = input.value.trim();
    const username = extractUsername(raw);

    if (!username) {
        results.innerHTML = "<div class='post'>Invalid username or URL.</div>";
        return;
    }

    currentUser = username;

    try {
        const url = `https://api.reddit.com/user/${username}/submitted?raw_json=1`;
        const res = await fetch(url);

        if (!res.ok) throw new Error();

        const data = await res.json();
        afterToken = data.data.after;

        for (const p of data.data.children) {
            await renderPost(p.data);
        }

    } catch {
        results.innerHTML = "<div class='post'>Failed loading posts.</div>";
    }
};

/* -------------------- Misc -------------------- */

clearBtn.onclick = () => {
    input.value = "";
    results.innerHTML = "";
    seenPostURLs.clear();
    postMediaList = [];
    currentUser = null;
    afterToken = null;
    forcedMode = null;
    colToggleBtn.textContent = "Columns: 3";
    applyColumnMode();
};

copyBtn.onclick = () =>
    navigator.clipboard.writeText(input.value.trim());

zipBtn.onclick = () =>
    alert("ZIP downloads coming soon");

/* END v1.1.34 */
