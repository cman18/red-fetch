/* =========================================================
   app.js
   Version: v1.1.8
   Description:
   - RedGifs extraction from Reddit posts
   - i.redd.it GIF fix (display as <img>)
   - YouTube embed support
   - Debug iframe
   - Version panel update
   ========================================================= */

// Inject JS version into debug panel
window.addEventListener("DOMContentLoaded", () => {
    const jsBox = document.getElementById("js-version");
    if (jsBox) jsBox.textContent = "v1.1.8";
});

/* =========================================================
   REDGIFS URL DETECTION + SLUG EXTRACTION
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

    // Unwrap Reddit redirect
    if (url.includes("out.reddit.com")) {
        const u = new URL(url);
        const dest = u.searchParams.get("url");
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

/* =========================================================
   REDGIFS DEBUG IFRAME EXTRACTOR
   ========================================================= */

async function fetchRedgifsMP4(url) {
    const slug = extractRedgifsSlug(url);
    if (!slug) return null;

    return new Promise(resolve => {
        const iframe = document.createElement("iframe");
        iframe.src = `https://www.redgifs.com/ifr/${slug}`;

        iframe.style.position = "fixed";
        iframe.style.bottom = "180px";
        iframe.style.left = "10px";
        iframe.style.width = "220px";
        iframe.style.height = "160px";
        iframe.style.border = "2px solid #0ff";
        iframe.style.zIndex = "999999";

        document.body.appendChild(iframe);

        let checks = 0;
        const maxChecks = 50;

        const interval = setInterval(() => {
            try {
                const vid = iframe.contentDocument?.querySelector("video");

                if (vid && vid.src?.startsWith("https")) {
                    clearInterval(interval);
                    resolve(vid.src);
                }
            } catch (e) {}

            checks++;
            if (checks >= maxChecks) {
                clearInterval(interval);
                resolve(null);
            }
        }, 350);
    });
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
const results = document.getElementById("results");

const imgFilter = document.getElementById("imgFilter");
const vidFilter = document.getElementById("vidFilter");
const otherFilter = document.getElementById("otherFilter");

/* =========================================================
   EXTRACT REDDIT USERNAME
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
   GIF DETECTION + REDDIT GIF FIX
   ========================================================= */

function isGif(url) {
    if (!url) return false;

    return (
        url.endsWith(".gif") ||
        url.endsWith(".gifv") ||
        (url.includes("imgur.com") && url.match(/\.gifv?$/)) ||
        url.includes("gfycat")
    );
}

function convertGifToMP4(url) {

    // Reddit i.redd.it GIFs must remain as GIF — no MP4 exists
    if (url.includes("i.redd.it") && url.endsWith(".gif")) {
        return url; // keep GIF
    }

    if (url.includes("imgur.com") && url.endsWith(".gifv"))
        return url.replace(".gifv", ".mp4");

    if (url.endsWith(".gif"))
        return url.replace(".gif", ".mp4");

    return url;
}

/* =========================================================
   GLOBAL MEDIA STATE
   ========================================================= */

let postMediaList = [];
let postMediaIndex = {};

/* =========================================================
   LOAD REDDIT POSTS
   ========================================================= */

async function loadPosts() {
    results.innerHTML = "";
    postMediaList = [];
    postMediaIndex = {};

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

        for (let p of posts) {
            await renderPost(p.data);
        }

    } catch (err) {
        results.innerHTML = `<div class="post">Error loading posts: ${err.message}</div>`;
    }
}

/* =========================================================
   RENDER POST
   ========================================================= */

async function renderPost(post) {
    let div = document.createElement("div");
    div.className = "post";

    // Title
    let title = document.createElement("div");
    title.textContent = post.title;
    title.style.marginBottom = "12px";
    div.appendChild(title);

    let url = post.url || "";
    let id = post.id;

    postMediaIndex[id] = postMediaList.length;

    /* ----- REDGIFS ----- */
    if (imgFilter.checked && isRedgifsURL(url)) {
        const mp4 = await fetchRedgifsMP4(url);

        if (mp4) {
            addSingleMediaToDOM(div, mp4, "gif", post);
            return;
        }

        const err = document.createElement("div");
        err.textContent = "Could not load RedGifs";
        err.style.color = "#faa";
        div.appendChild(err);
        results.appendChild(div);
        return;
    }

    /* ----- YOUTUBE ----- */
    if (
        otherFilter.checked &&
        (url.includes("youtube.com") || url.includes("youtu.be"))
    ) {
        let videoId = null;

        const m1 = url.match(/v=([^&]+)/);
        if (m1) videoId = m1[1];

        const m2 = url.match(/youtu\.be\/([^?]+)/);
        if (!videoId && m2) videoId = m2[1];

        if (videoId) {
            const iframe = document.createElement("iframe");
            iframe.width = "100%";
            iframe.height = "260";
            iframe.src = `https://www.youtube.com/embed/${videoId}`;
            iframe.frameBorder = "0";
            iframe.allow =
                "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
            iframe.allowFullscreen = true;

            div.appendChild(iframe);
            results.appendChild(div);
            return;
        }
    }

    /* ----- GIF / GIFV ----- */
    if (imgFilter.checked && isGif(url)) {
        const finalURL = convertGifToMP4(url);
        addSingleMediaToDOM(div, finalURL, "gif", post);
        return;
    }

    /* ----- IMAGE ----- */
    if (imgFilter.checked && post.post_hint === "image") {
        addSingleMediaToDOM(div, url, "image", post);
        return;
    }

    /* ----- REDDIT VIDEO ----- */
    if (
        vidFilter.checked &&
        post.is_video &&
        post.media?.reddit_video?.fallback_url
    ) {
        const vsrc = post.media.reddit_video.fallback_url;
        addSingleMediaToDOM(div, vsrc, "video", post);
        return;
    }

    /* ----- LINK FALLBACK ----- */
    if (otherFilter.checked) {
        const link = document.createElement("a");
        link.href = url;
        link.textContent = url;
        link.target = "_blank";
        div.appendChild(link);
        results.appendChild(div);
        return;
    }
}

/* =========================================================
   ADD MEDIA TO DOM
   ========================================================= */

function addSingleMediaToDOM(div, src, type, post) {
    let el;

    // NEW: Properly display real .gif files as images
    if (type === "gif" && src.endsWith(".gif")) {
        el = document.createElement("img");
        el.src = src;
    }

    // Videos + MP4-based "GIFs"
    else if (type === "gif" || type === "video") {
        el = document.createElement("video");
        el.src = src;
        el.controls = type === "video";
        el.autoplay = type === "gif";
        el.loop = type === "gif";
        el.muted = type === "gif";
    }

    // Standard images
    else {
        el = document.createElement("img");
        el.src = src;
    }

    el.onclick = () =>
        openFullscreen(src, type === "image" ? "img" : "video");

    div.appendChild(el);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.textContent = post.url;
    div.appendChild(urlLine);

    results.appendChild(div);

    postMediaList.push({
        type,
        src,
        postId: post.id
    });
}

/* =========================================================
   FULLSCREEN VIEWER
   ========================================================= */

function openFullscreen(src, type) {
    const overlay = document.createElement("div");
    overlay.className = "fullscreen-media";

    let el;

    if (type === "img") {
        el = document.createElement("img");
        el.src = src;
    } else {
        el = document.createElement("video");
        el.src = src;
        el.autoplay = true;
        el.controls = true;
    }

    overlay.appendChild(el);
    overlay.onclick = () => overlay.remove();

    document.body.appendChild(overlay);
}

/* =========================================================
   BUTTON ACTIONS
   ========================================================= */

scrollTopBtn.onclick = () =>
    window.scrollTo({ top: 0, behavior: "smooth" });

loadBtn.onclick = loadPosts;

clearBtn.onclick = () => {
    input.value = "";
    results.innerHTML = "";
    postMediaList = [];
    postMediaIndex = {};
};

copyBtn.onclick = () =>
    navigator.clipboard.writeText(input.value.trim());

zipBtn.onclick = () =>
    alert("ZIP downloads coming soon");

/* =========================================================
   END app.js v1.1.8
   ========================================================= */
