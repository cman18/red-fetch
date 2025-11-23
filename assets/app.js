/* =========================================================
   app.js
   Version: v1.1.11
   ========================================================= */

window.addEventListener("DOMContentLoaded", () => {
    const box = document.getElementById("js-version");
    if (box) box.textContent = "v1.1.11";
});

/* =========================================================
   REDGIFS DETECTION + SLUG EXTRACTION
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

    // unwrap reddit redirect
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
        let m = url.match(p);
        if (m) return m[1];
    }

    return null;
}

/* =========================================================
   REDGIFS VIDEO EXTRACTOR (DEBUG IFR METHOD)
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
        iframe.style.border = "2px solid cyan";
        iframe.style.zIndex = "999999";
        document.body.appendChild(iframe);

        let tries = 0;
        const maxTries = 50;

        const iv = setInterval(() => {
            try {
                const vid = iframe.contentDocument?.querySelector("video");
                if (vid && vid.src?.startsWith("https")) {
                    clearInterval(iv);
                    resolve(vid.src);
                }
            } catch (err) { }

            tries++;
            if (tries >= maxTries) {
                clearInterval(iv);
                resolve(null);
            }
        }, 350);
    });
}

/* =========================================================
   USERNAME EXTRACTION
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
        (url.includes("imgur.com") && url.match(/\.gifv?$/)) ||
        url.includes("gfycat")
    );
}

function convertGifToMP4(url) {
    if (url.includes("i.redd.it") && url.endsWith(".gif")) return url;
    if (url.includes("imgur.com") && url.endsWith(".gifv")) return url.replace(".gifv", ".mp4");
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
const results = document.getElementById("results");

const imgFilter = document.getElementById("imgFilter");
const vidFilter = document.getElementById("vidFilter");
const otherFilter = document.getElementById("otherFilter");

let postMediaList = [];
let postMediaIndex = {};

/* =========================================================
   LOAD POSTS
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

    let title = document.createElement("div");
    title.textContent = post.title;
    title.style.marginBottom = "12px";
    div.appendChild(title);

    let mediaBox = document.createElement("div");
    mediaBox.className = "tile-media";

    let url = post.url || "";
    let id = post.id;

    postMediaIndex[id] = postMediaList.length;

    /* ---------- HARD IMAGE FALLBACK (jpg/png/webp) ---------- */

    if (imgFilter.checked && url.match(/\.(jpg|jpeg|png|webp)$/i)) {
        appendMedia(mediaBox, div, url, "image", post);
        results.appendChild(div);
        return;
    }

    /* ---------- REDGIFS ---------- */

    if (imgFilter.checked && isRedgifsURL(url)) {
        const mp4 = await fetchRedgifsMP4(url);

        if (mp4) {
            appendMedia(mediaBox, div, mp4, "gif", post);
            results.appendChild(div);
            return;
        }

        let err = document.createElement("div");
        err.textContent = "Could not load RedGifs";
        err.style.color = "#faa";
        div.appendChild(err);
        results.appendChild(div);
        return;
    }

    /* ---------- YOUTUBE ---------- */

    if (otherFilter.checked &&
        (url.includes("youtube.com") || url.includes("youtu.be"))) {

        let id = null;
        let m1 = url.match(/v=([^&]+)/);
        if (m1) id = m1[1];
        let m2 = url.match(/youtu\.be\/([^?]+)/);
        if (!id && m2) id = m2[1];

        if (id) {
            appendIframe(mediaBox, div, `https://www.youtube.com/embed/${id}`);
            results.appendChild(div);
            return;
        }
    }

    /* ---------- VIMEO ---------- */
    if (otherFilter.checked && url.includes("vimeo.com")) {
        let m = url.match(/vimeo\.com\/(\d+)/);
        if (m) {
            appendIframe(mediaBox, div, `https://player.vimeo.com/video/${m[1]}`);
            results.appendChild(div);
            return;
        }
    }

    /* ---------- TWITCH CLIPS ---------- */
    if (otherFilter.checked && url.includes("twitch.tv")) {
        let m = url.match(/clip\/([^/?]+)/);
        if (m) {
            appendIframe(mediaBox, div,
                `https://clips.twitch.tv/embed?clip=${m[1]}&parent=localhost`);
            results.appendChild(div);
            return;
        }
    }

    /* ---------- PORNHUB ---------- */
    if (otherFilter.checked &&
        (url.includes("pornhub.com") || url.includes("phncdn.com"))) {
        let embed = url.replace("view_video.php?viewkey=", "embed/");
        appendIframe(mediaBox, div, embed);
        results.appendChild(div);
        return;
    }

    /* ---------- REDTUBE ---------- */
    if (otherFilter.checked && url.includes("redtube.com")) {
        let m = url.match(/redtube\.com\/(\d+)/);
        if (m) {
            appendIframe(mediaBox, div,
                `https://embed.redtube.com/?id=${m[1]}&bgcolor=000000`);
            results.appendChild(div);
            return;
        }
    }

    /* ---------- TWITTER/X ---------- */
    if (otherFilter.checked && url.includes("twitter.com")) {
        appendIframe(mediaBox, div,
            url.replace("twitter.com", "twitframe.com"));
        results.appendChild(div);
        return;
    }

    /* ---------- GIF ---------- */
    if (imgFilter.checked && isGif(url)) {
        const finalURL = convertGifToMP4(url);
        appendMedia(mediaBox, div, finalURL, "gif", post);
        results.appendChild(div);
        return;
    }

    /* ---------- REDDIT IMAGE VIA post_hint ---------- */
    if (imgFilter.checked && post.post_hint === "image") {
        appendMedia(mediaBox, div, url, "image", post);
        results.appendChild(div);
        return;
    }

    /* ---------- REDDIT VIDEO ---------- */
    if (
        vidFilter.checked &&
        post.is_video &&
        post.media?.reddit_video?.fallback_url
    ) {
        appendMedia(mediaBox, div, post.media.reddit_video.fallback_url, "video", post);
        results.appendChild(div);
        return;
    }

    /* ---------- FALLBACK ---------- */
    if (otherFilter.checked) {
        let a = document.createElement("a");
        a.href = url;
        a.textContent = url;
        a.target = "_blank";
        div.appendChild(a);
        results.appendChild(div);
    }
}

/* =========================================================
   APPEND MEDIA
   ========================================================= */

function appendMedia(mediaBox, container, src, type, post) {
    let el;

    if (type === "gif" && src.endsWith(".gif")) {
        el = document.createElement("img");
        el.src = src;
    } else if (type === "video" || type === "gif") {
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

    let urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.textContent = post.url;

    container.appendChild(mediaBox);
    container.appendChild(urlLine);

    postMediaList.push({
        type,
        src,
        postId: post.id
    });
}

/* =========================================================
   APPEND IFRAME
   ========================================================= */

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
    postMediaIndex = {};
};

copyBtn.onclick = () =>
    navigator.clipboard.writeText(input.value.trim());

zipBtn.onclick = () =>
    alert("ZIP downloads coming soon");

/* END app.js v1.1.11 */
