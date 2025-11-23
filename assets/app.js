/* =========================================================
   app.js
   Version: v1.1.22 — S1 (3:4), A2, C1, R1+R2, T1
   ========================================================= */

window.addEventListener("DOMContentLoaded", () => {
    const box = document.getElementById("js-version");
    if (box) box.textContent = "v1.1.22";
});

/* =========================================================
   COLUMN TOGGLE (R2 + O1)
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
    if (forcedMode === "3" || forcedMode === null) {
        forcedMode = "2";
    } else {
        forcedMode = "3";
    }
    applyColumnMode();
};

/* =========================================================
   REDGIFS HELPERS (POPUP REMOVED)
   ========================================================= */

function isRedgifsURL(url) {
    if (!url) return false;
    return (
        url.includes("redgifs.com") ||
        url.includes("v2.redgifs.com") ||
        (url.includes("out.reddit.com") && url.includes("redgifs"))
    );
}

function extractRedgifsSlug(url) {
    if (!url) return null;

    if (url.includes("out.reddit.com")) {
        const dest = new URL(url).searchParams.get("url");
        if (dest) url = dest;
    }

    const patterns = [
        /redgifs\.com\/watch\/([A-Za-z0-9]+)/,
        /redgifs\.com\/ifr\/([A-Za-z0-9]+)/,
        /\/([A-Za-z0-9]+)$/
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
        const api = `https://api.redgifs.com/v2/gifs/${slug}`;
        const res = await fetch(api);
        if (!res.ok) return null;

        const data = await res.json();
        return data?.gif?.urls?.hd || data?.gif?.urls?.sd || null;
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
   FILETYPE HELPERS
   ========================================================= */

function isGif(url) {
    if (!url) return false;
    return (
        url.endsWith(".gif") ||
        url.endsWith(".gifv") ||
        url.includes("gfycat") ||
        (url.includes("imgur.com") && url.match(/\.gifv?$/))
    );
}

function convertGifToMP4(url) {
    if (url.endsWith(".gifv")) return url.replace(".gifv", ".mp4");
    if (url.endsWith(".gif")) return url.replace(".gif", ".mp4");
    return url;
}

/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const input = document.getElementById("input");
const loadBtn = document.getElementById("loadBtn");
const clearBtn = document.getElementById("clearBtn");
const copyBtn = document.getElementById("copyBtn");
const zipBtn = document.getElementById("zipBtn");
const scrollTopBtn = document.getElementById("scrollTopBtn");

const imgFilter = document.getElementById("imgFilter");
const vidFilter = document.getElementById("vidFilter");
const otherFilter = document.getElementById("otherFilter");

let postMediaList = [];

/* =========================================================
   LOAD POSTS
   ========================================================= */

async function loadPosts() {
    results.innerHTML = "";
    postMediaList = [];

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
            await renderPost(p.data);
        }

    } catch (err) {
        results.innerHTML = `<div class='post'>Error loading posts: ${err.message}</div>`;
    }
}

/* =========================================================
   RENDER POST — S1 (3:4 crop-to-fill)
   ========================================================= */

async function renderPost(post) {
    const div = document.createElement("div");
    div.className = "post";

    /* title */
    const title = document.createElement("div");
    title.className = "post-title";
    title.textContent = post.title || "(no title)";
    div.appendChild(title);

    const mediaBox = document.createElement("div");
    mediaBox.className = "tile-media"; // 3:4 enforced

    const url = post.url || "";

    /* ---------- Reddit Gallery ---------- */
    if (post.is_gallery && post.media_metadata && post.gallery_data) {
        const ids = post.gallery_data.items.map(x => x.media_id).filter(Boolean);

        const imgs = ids.map(id => {
            const meta = post.media_metadata[id];
            if (!meta?.s) return null;
            let src = meta.s.u || meta.s.gif || meta.s.mp4;
            return src ? src.replace(/&amp;/g, "&") : null;
        }).filter(Boolean);

        if (imgs.length) {
            renderGallery(mediaBox, div, imgs, post);
            results.appendChild(div);
            return;
        }
    }

    /* ---------- Direct Image ---------- */
    if (imgFilter.checked && url.match(/\.(jpg|jpeg|png|webp)$/i)) {
        appendMedia(mediaBox, div, url, "image", post);
        results.appendChild(div);
        return;
    }

    /* ---------- Redgifs ---------- */
    if (imgFilter.checked && isRedgifsURL(url)) {
        const mp4 = await fetchRedgifsMP4(url);
        if (mp4) {
            appendMedia(mediaBox, div, mp4, "gif", post);
            results.appendChild(div);
            return;
        }
    }

    /* ---------- YouTube ---------- */
    if (otherFilter.checked &&
        (url.includes("youtube.com") || url.includes("youtu.be"))) {

        let id = null;
        let m1 = url.match(/v=([^&]+)/);
        if (m1) id = m1[1];
        let m2 = url.match(/youtu\.be\/([^?]+)/);
        if (!id && m2) id = m2[1];

        if (id) {
            appendIframe(mediaBox, div,
                `https://www.youtube.com/embed/${id}`);
            results.appendChild(div);
            return;
        }
    }

    /* ---------- Vimeo ---------- */
    if (otherFilter.checked && url.includes("vimeo.com")) {
        const m = url.match(/vimeo\.com\/(\d+)/);
        if (m) {
            appendIframe(mediaBox, div,
                `https://player.vimeo.com/video/${m[1]}`);
            results.appendChild(div);
            return;
        }
    }

    /* ---------- Twitch ---------- */
    if (otherFilter.checked && url.includes("twitch.tv")) {
        const m = url.match(/clip\/([^\/]+)/);
        if (m) {
            appendIframe(mediaBox, div,
                `https://clips.twitch.tv/embed?clip=${m[1]}&parent=localhost`);
            results.appendChild(div);
            return;
        }
    }

    /* ---------- RedTube ---------- */
    if (otherFilter.checked && url.includes("redtube.com")) {
        const m = url.match(/redtube\.com\/(\d+)/);
        if (m) {
            appendIframe(mediaBox, div,
                `https://embed.redtube.com/?id=${m[1]}&bgcolor=000000`);
            results.appendChild(div);
            return;
        }
    }

    /* ---------- PornHub ---------- */
    if (otherFilter.checked &&
        (url.includes("pornhub.com") || url.includes("phncdn.com"))) {

        appendIframe(mediaBox, div,
            url.replace("view_video.php?viewkey=", "embed/"));
        results.appendChild(div);
        return;
    }

    /* ---------- Twitter/X ---------- */
    if (otherFilter.checked && url.includes("twitter.com")) {
        appendIframe(mediaBox, div,
            url.replace("twitter.com", "twitframe.com"));
        results.appendChild(div);
        return;
    }

    /* ---------- GIF ---------- */
    if (imgFilter.checked && isGif(url)) {
        appendMedia(mediaBox, div, convertGifToMP4(url), "gif", post);
        results.appendChild(div);
        return;
    }

    /* ---------- post_hint: image ---------- */
    if (imgFilter.checked && post.post_hint === "image") {
        appendMedia(mediaBox, div, url, "image", post);
        results.appendChild(div);
        return;
    }

    /* ---------- Reddit Video ---------- */
    if (
        vidFilter.checked &&
        post.is_video &&
        post.media?.reddit_video?.fallback_url
    ) {
        appendMedia(mediaBox, div,
            post.media.reddit_video.fallback_url, "video", post);
        results.appendChild(div);
        return;
    }

    /* =====================================================
       TEXT-ONLY POST (T1)
       ===================================================== */

    const placeholder = document.createElement("div");
    placeholder.className = "placeholder-media";
    placeholder.textContent = "Text Post";

    mediaBox.appendChild(placeholder);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.textContent = url;

    div.appendChild(mediaBox);
    div.appendChild(urlLine);

    results.appendChild(div);
}

/* =========================================================
   GALLERY (main page)
   ========================================================= */

function renderGallery(mediaBox, container, images, post) {
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

    const update = () => {
        img.src = images[index];
    };

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
}

/* =========================================================
   FULLSCREEN GALLERY
   ========================================================= */

let fullscreenOverlay = null;
let fullscreenImg = null;
let fullscreenIndex = 0;
let fullscreenImages = [];

function openFullscreenGallery(images, startIndex = 0) {
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
    if (e.key === "Escape") {
        closeFullscreenGallery();
        return;
    }
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
   Generic Media + Iframe
   ========================================================= */

function appendMedia(mediaBox, container, src, type, post) {
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

    postMediaList.push({ type, src, postId: post.id });
}

function appendIframe(mediaBox, container, src) {
    const iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.allow = "autoplay; encrypted-media";
    mediaBox.appendChild(iframe);
    container.appendChild(mediaBox);
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
    alert("ZIP downloads will be added soon");

/* END app.js v1.1.22 */
