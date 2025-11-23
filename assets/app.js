/* =========================================================
   app.js
   Version: v1.1.12 — Adds Reddit Gallery Support
   ========================================================= */

window.addEventListener("DOMContentLoaded", () => {
    const box = document.getElementById("js-version");
    if (box) box.textContent = "v1.1.12";
});

/* =========================================================
   REDGIFS HELPERS
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
        let m = url.match(p);
        if (m) return m[1];
    }
    return null;
}

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
        const iv = setInterval(() => {
            try {
                const vid = iframe.contentDocument?.querySelector("video");
                if (vid && vid.src.startsWith("https")) {
                    clearInterval(iv);
                    resolve(vid.src);
                }
            } catch (e) {}

            tries++;
            if (tries > 50) {
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
        results.innerHTML =
            `<div class='post'>Error loading posts: ${err.message}</div>`;
    }
}

/* =========================================================
   RENDER POST + GALLERY SUPPORT
   ========================================================= */

async function renderPost(post) {
    const div = document.createElement("div");
    div.className = "post";

    const title = document.createElement("div");
    title.textContent = post.title;
    title.style.marginBottom = "12px";
    div.appendChild(title);

    const mediaBox = document.createElement("div");
    mediaBox.className = "tile-media";

    const url = post.url || "";

    /* ---------- 1. Reddit Gallery (NEW) ---------- */
    if (post.is_gallery && post.gallery_data && post.media_metadata) {
        const galleryItems =
            post.gallery_data.items.map(x => x.media_id).filter(Boolean);

        const images = galleryItems.map(id => {
            const item = post.media_metadata[id];
            if (!item) return null;
            let src = item.s?.u || item.s?.gif || item.s?.mp4;
            if (!src) return null;
            return src.replace(/&amp;/g, "&");
        }).filter(Boolean);

        if (images.length) {
            renderGallery(mediaBox, div, images, post);
            results.appendChild(div);
            return;
        }
    }

    /* ---------- 2. Direct Images (.jpg/.png/.webp) ---------- */
    if (imgFilter.checked && url.match(/\.(jpg|jpeg|png|webp)$/i)) {
        appendMedia(mediaBox, div, url, "image", post);
        results.appendChild(div);
        return;
    }

    /* ---------- 3. RedGifs ---------- */
    if (imgFilter.checked && isRedgifsURL(url)) {
        const mp4 = await fetchRedgifsMP4(url);
        if (mp4) {
            appendMedia(mediaBox, div, mp4, "gif", post);
            results.appendChild(div);
            return;
        }
        div.appendChild(errBox("Could not load RedGifs"));
        results.appendChild(div);
        return;
    }

    /* ---------- 4. YouTube ---------- */
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

    /* ---------- 5. Vimeo ---------- */
    if (otherFilter.checked && url.includes("vimeo.com")) {
        let m = url.match(/vimeo\.com\/(\d+)/);
        if (m) {
            appendIframe(mediaBox, div, `https://player.vimeo.com/video/${m[1]}`);
            results.appendChild(div);
            return;
        }
    }

    /* ---------- 6. Twitch ---------- */
    if (otherFilter.checked && url.includes("twitch.tv")) {
        let m = url.match(/clip\/([^/?]+)/);
        if (m) {
            appendIframe(mediaBox, div,
                `https://clips.twitch.tv/embed?clip=${m[1]}&parent=localhost`);
            results.appendChild(div);
            return;
        }
    }

    /* ---------- 7. Pornhub ---------- */
    if (otherFilter.checked &&
        (url.includes("pornhub.com") || url.includes("phncdn.com"))) {
        appendIframe(mediaBox, div,
            url.replace("view_video.php?viewkey=", "embed/"));
        results.appendChild(div);
        return;
    }

    /* ---------- 8. Redtube ---------- */
    if (otherFilter.checked && url.includes("redtube.com")) {
        let m = url.match(/redtube\.com\/(\d+)/);
        if (m) {
            appendIframe(mediaBox, div,
                `https://embed.redtube.com/?id=${m[1]}&bgcolor=000000`);
            results.appendChild(div);
            return;
        }
    }

    /* ---------- 9. Twitter/X ---------- */
    if (otherFilter.checked && url.includes("twitter.com")) {
        appendIframe(mediaBox, div,
            url.replace("twitter.com", "twitframe.com"));
        results.appendChild(div);
        return;
    }

    /* ---------- 10. GIF ---------- */
    if (imgFilter.checked && isGif(url)) {
        appendMedia(mediaBox, div, convertGifToMP4(url), "gif", post);
        results.appendChild(div);
        return;
    }

    /* ---------- 11. post_hint image ---------- */
    if (imgFilter.checked && post.post_hint === "image") {
        appendMedia(mediaBox, div, url, "image", post);
        results.appendChild(div);
        return;
    }

    /* ---------- 12. Reddit video ---------- */
    if (
        vidFilter.checked &&
        post.is_video &&
        post.media?.reddit_video?.fallback_url
    ) {
        appendMedia(mediaBox, div, post.media.reddit_video.fallback_url, "video", post);
        results.appendChild(div);
        return;
    }

    /* ---------- 13. Fallback ---------- */
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
   GALLERY RENDER + ARROWS
   ========================================================= */

function renderGallery(mediaBox, container, images, post) {
    let index = 0;

    const img = document.createElement("img");
    img.src = images[0];

    const left = document.createElement("div");
    left.className = "gallery-arrow-main gallery-arrow-main-left";
    left.textContent = "<";

    const right = document.createElement("div");
    right.className = "gallery-arrow-main gallery-arrow-main-right";
    right.textContent = ">";

    const update = () => {
        img.src = images[index];
    };

    left.onclick = (ev) => {
        ev.stopPropagation();
        index = (index - 1 + images.length) % images.length;
        update();
    };

    right.onclick = (ev) => {
        ev.stopPropagation();
        index = (index + 1) % images.length;
        update();
    };

    mediaBox.appendChild(img);
    mediaBox.appendChild(left);
    mediaBox.appendChild(right);

    // Add URL under tile
    let urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.textContent = post.url;

    container.appendChild(mediaBox);
    container.appendChild(urlLine);
}

/* =========================================================
   IFRAME + MEDIA HELPERS
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

/* END app.js v1.1.12 */
