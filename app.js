// ============================================================
// RedPull 011 — DEBUG VERSION WITH VISIBLE REDGIFS IFRAME (B1)
// ============================================================

// DOM elements
const input = document.getElementById("input");
const loadBtn = document.getElementById("loadBtn");
const clearBtn = document.getElementById("clearBtn");
const copyBtn = document.getElementById("copyBtn");
const zipBtn = document.getElementById("zipBtn");
const scrollTopBtn = document.getElementById("scrollTopBtn");
const results = document.getElementById("results");

// Filters
const imgFilter = document.getElementById("imgFilter");
const vidFilter = document.getElementById("vidFilter");
const otherFilter = document.getElementById("otherFilter");

// ============================================================
// REDGIFS DEBUG IFRAME EXTRACTOR (VISIBLE B1)
// ============================================================

async function fetchRedgifsMP4(url) {
    let idMatch = url.match(/\/([A-Za-z0-9]+)$/);
    if (!idMatch) return null;

    let slug = idMatch[1];

    return new Promise(resolve => {
        const iframe = document.createElement("iframe");
        iframe.src = `https://www.redgifs.com/ifr/${slug}`;

        // B1 Debug mode visible
        iframe.style.position = "fixed";
        iframe.style.bottom = "10px";
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
                if (vid && vid.src && vid.src.startsWith("https")) {
                    clearInterval(interval);
                    const mp4 = vid.src;

                    // KEEP the iframe visible for debugging — comment out to auto-remove later
                    // document.body.removeChild(iframe);

                    resolve(mp4);
                }
            } catch (e) {}

            checks++;
            if (checks > maxChecks) {
                clearInterval(interval);
                resolve(null);
            }
        }, 300);
    });
}

// ============================================================
// USERNAME EXTRACTION
// ============================================================
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

// ============================================================
// GIF DETECTION
// ============================================================
function isGif(url) {
    if (!url) return false;

    return (
        url.endsWith(".gif") ||
        url.endsWith(".gifv") ||
        (url.includes("imgur.com") && url.match(/\.gifv?$/)) ||
        url.includes("gfycat") ||
        url.includes("redgifs.com")
    );
}

function convertGifToMP4(url) {
    if (url.includes("imgur.com") && url.endsWith(".gifv")) {
        return url.replace(".gifv", ".mp4");
    }
    if (url.endsWith(".gif")) {
        return url.replace(".gif", ".mp4");
    }
    return url;
}

// ============================================================
// GLOBAL MEDIA NAVIGATION
// ============================================================
let postMediaList = [];
let postMediaIndex = {};
let currentIndex = 0;
let totalMediaCount = 0;

// ============================================================
// LOAD POSTS
// ============================================================
async function loadPosts() {
    results.innerHTML = "";
    postMediaList = [];
    postMediaIndex = {};
    currentIndex = 0;
    totalMediaCount = 0;

    const raw = input.value.trim();
    const username = extractUsername(raw);

    if (!username) {
        results.innerHTML = "<div class='post'>Invalid username or URL.</div>";
        return;
    }

    try {
        const url = `https://api.reddit.com/user/${username}/submitted?raw_json=1`;
        const res = await fetch(url);

        if (!res.ok) throw new Error("Reddit blocked fetch request");

        const data = await res.json();
        const posts = data.data.children;

        if (!posts.length) {
            results.innerHTML = "<div class='post'>No posts found.</div>";
            return;
        }

        for (let p of posts) {
            await renderPost(p.data);
        }

        totalMediaCount = postMediaList.length;

    } catch (err) {
        results.innerHTML = `<div class="post">Error loading posts: ${err.message}</div>`;
    }
}

// ============================================================
// RENDER POST
// ============================================================
async function renderPost(post) {

    let div = document.createElement("div");
    div.className = "post";

    let title = document.createElement("div");
    title.textContent = post.title;
    title.style.marginBottom = "12px";
    div.appendChild(title);

    let url = post.url || "";
    let postId = post.id;

    postMediaIndex[postId] = postMediaList.length;
    let mediaItems = [];

    // GALLERY POSTS
    if (post.is_gallery && post.gallery_data && imgFilter.checked) {

        let items = post.gallery_data.items;
        let images = items.map(i =>
            post.media_metadata[i.media_id].s.u.replace(/&amp;/g, "&")
        );

        images.forEach(src => {
            mediaItems.push({ type: "image", src: src, postId: postId });
        });

        addGalleryToDOM(div, mediaItems, post);
        return;
    }

    // REDGIFS FIX WITH DEBUG IFRAME
    if (imgFilter.checked && url.includes("redgifs.com")) {
        let mp4 = await fetchRedgifsMP4(url);

        if (mp4) {
            mediaItems.push({ type: "gif", src: mp4, postId: postId });
            addSingleMediaToDOM(div, mp4, "gif", post);
            return;
        }

        let err = document.createElement("div");
        err.textContent = "RedGifs failed to load";
        err.style.color = "#faa";
        div.appendChild(err);
        results.appendChild(div);
        return;
    }

    // GIF/GIFV
    if (imgFilter.checked && isGif(url)) {
        let mp4 = convertGifToMP4(url);

        mediaItems.push({ type: "gif", src: mp4, postId: postId });
        addSingleMediaToDOM(div, mp4, "gif", post);
        return;
    }

    // IMAGE POSTS
    if (imgFilter.checked && post.post_hint === "image" && url) {
        mediaItems.push({ type: "image", src: url, postId: postId });
        addSingleMediaToDOM(div, url, "image", post);
        return;
    }

    // VIDEO POSTS (REDDIT HOSTED)
    if (vidFilter.checked && post.is_video && post.media?.reddit_video?.fallback_url) {
        let vsrc = post.media.reddit_video.fallback_url;
        mediaItems.push({ type: "video", src: vsrc, postId: postId });
        addSingleMediaToDOM(div, vsrc, "video", post);
        return;
    }

    // OTHER LINKS
    if (otherFilter.checked) {
        let link = document.createElement("a");
        link.href = url;
        link.textContent = url;
        link.target = "_blank";
        div.appendChild(link);

        results.appendChild(div);
        return;
    }

    mediaItems.forEach(item => postMediaList.push(item));
}

// ============================================================
// ADD SINGLE MEDIA
// ============================================================
function addSingleMediaToDOM(div, src, type, post) {

    let el;

    if (type === "gif") {
        el = document.createElement("video");
        el.src = src;
        el.autoplay = true;
        el.loop = true;
        el.muted = true;
        el.controls = false;
    }
    else if (type === "video") {
        el = document.createElement("video");
        el.src = src;
        el.controls = true;
    }
    else {
        el = document.createElement("img");
        el.src = src;
    }

    el.onclick = () => openFullscreen(src, type === "image" ? "img" : "video");

    div.appendChild(el);

    let urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.textContent = post.url;
    div.appendChild(urlLine);

    results.appendChild(div);

    postMediaList.push({
        type: type,
        src: src,
        postId: post.id
    });
}

// ============================================================
// GALLERY & FULLSCREEN CODE (unchanged)
// ============================================================

function addGalleryToDOM( div, mediaItems, post ) {
    mediaItems.forEach(item => postMediaList.push(item));

    let current = 0;

    let img = document.createElement("img");
    img.src = mediaItems[current].src;
    img.onclick = () => openFullscreenGallery(mediaItems, current);

    div.appendChild(img);

    let left = document.createElement("div");
    left.className = "gallery-arrow-main gallery-arrow-main-left";
    left.textContent = "<";

    let right = document.createElement("div");
    right.className = "gallery-arrow-main gallery-arrow-main-right";
    right.textContent = ">";

    left.onclick = e => {
        e.stopPropagation();
        goGalleryStep(-1, img, mediaItems, post.id);
    };

    right.onclick = e => {
        e.stopPropagation();
        goGalleryStep(1, img, mediaItems, post.id);
    };

    div.appendChild(left);
    div.appendChild(right);

    let urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.textContent = post.url;
    div.appendChild(urlLine);

    results.appendChild(div);
}

function goGalleryStep(direction, imgElement, mediaItems, postId) {
    let startIndex = postMediaIndex[postId];
    if (startIndex === undefined) return;

    let currentSrc = imgElement.src;

    let globalIdx = postMediaList.findIndex(m => m.src === currentSrc);
    if (globalIdx === -1) globalIdx = startIndex;

    let nextIdx = globalIdx + direction;

    if (nextIdx < 0 || nextIdx >= postMediaList.length) return;

    imgElement.src = postMediaList[nextIdx].src;
}

function openFullscreenGallery(mediaItems, index) {
    const overlay = document.createElement("div");
    overlay.className = "fullscreen-media";

    let current = index;

    let el = buildFullscreenElement(mediaItems[current]);
    overlay.appendChild(el);

    let left = document.createElement("div");
    left.className = "gallery-arrow gallery-arrow-left";
    left.textContent = "<";

    let right = document.createElement("div");
    right.className = "gallery-arrow gallery-arrow-right";
    right.textContent = ">";

    left.onclick = e => {
        e.stopPropagation();
        current = (current - 1 + mediaItems.length) % mediaItems.length;
        updateFullscreenMedia(overlay, mediaItems[current]);
    };

    right.onclick = e => {
        e.stopPropagation();
        current = (current + 1) % mediaItems.length;
        updateFullscreenMedia(overlay, mediaItems[current]);
    };

    overlay.appendChild(left);
    overlay.appendChild(right);

    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
}

function buildFullscreenElement(media) {
    let el;

    if (media.type === "image") {
        el = document.createElement("img");
        el.src = media.src;
    } else {
        el = document.createElement("video");
        el.src = media.src;
        el.controls = true;
        el.autoplay = true;
    }

    return el;
}

function updateFullscreenMedia(overlay, media) {
    overlay.innerHTML = "";

    let el = buildFullscreenElement(media);
    overlay.appendChild(el);

    let left = document.createElement("div");
    left.className = "gallery-arrow gallery-arrow-left";
    left.textContent = "<";
    overlay.appendChild(left);

    let right = document.createElement("div");
    right.className = "gallery-arrow gallery-arrow-right";
    right.textContent = ">";
    overlay.appendChild(right);

    left.onclick = e => {
        e.stopPropagation();
        let idx = postMediaList.findIndex(m => m.src === media.src);
        if (idx > 0) updateFullscreenMedia(overlay, postMediaList[idx - 1]);
    };

    right.onclick = e => {
        e.stopPropagation();
        let idx = postMediaList.findIndex(m => m.src === media.src);
        if (idx < postMediaList.length - 1)
            updateFullscreenMedia(overlay, postMediaList[idx + 1]);
    };
}

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
        el.controls = true;
        el.autoplay = true;
    }

    overlay.appendChild(el);

    overlay.onclick = () => overlay.remove();

    document.body.appendChild(overlay);
}

// ============================================================
// SCROLL & BUTTONS
// ============================================================
scrollTopBtn.onclick = () => {
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
};

loadBtn.onclick = loadPosts;

clearBtn.onclick = () => {
    input.value = "";
    results.innerHTML = "";
    postMediaList = [];
    postMediaIndex = {};
    currentIndex = 0;
    totalMediaCount = 0;
};

copyBtn.onclick = () => {
    navigator.clipboard.writeText(input.value.trim());
};

zipBtn.onclick = () => {
    alert("ZIP downloads coming soon");
};

// ============================================================
// FULLSCREEN SWIPE SUPPORT
// ============================================================
let touchStartX = 0;
let touchEndX = 0;

function handleSwipe() {
    const distance = touchEndX - touchStartX;

    if (Math.abs(distance) < 50) return;

    const overlay = document.querySelector(".fullscreen-media");
    if (!overlay) return;

    const mediaEl = overlay.querySelector("img, video");
    if (!mediaEl) return;

    const currentSrc = mediaEl.src;
    const idx = postMediaList.findIndex(m => m.src === currentSrc);

    if (idx === -1) return;

    if (distance < 0 && idx < postMediaList.length - 1) {
        updateFullscreenMedia(overlay, postMediaList[idx + 1]);
    }
    else if (distance > 0 && idx > 0) {
        updateFullscreenMedia(overlay, postMediaList[idx - 1]);
    }
}

document.addEventListener("touchstart", function (e) {
    if (!document.querySelector(".fullscreen-media")) return;
    touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener("touchend", function (e) {
    if (!document.querySelector(".fullscreen-media")) return;
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
});
