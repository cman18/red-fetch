// ============================================================
// RedPull 007p app.js
// PART 1 OF 4
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
// GIF DETECTION AND GIFV/IMGUR/GFYCAT HANDLING
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
// REDGIFS SUPPORT
// ============================================================
async function fetchRedgifsMP4(url) {
    let idMatch = url.match(/\/([A-Za-z0-9]+)$/);
    if (!idMatch) return null;

    let id = idMatch[1];
    let apiURL = "https://api.redgifs.com/v2/gifs/" + id;

    try {
        let res = await fetch(apiURL);
        if (!res.ok) return null;

        let data = await res.json();
        if (!data || !data.gif || !data.gif.urls) return null;

        return (
            data.gif.urls.hd ||
            data.gif.urls.sd ||
            data.gif.urls.mobile ||
            null
        );

    } catch (e) {
        return null;
    }
}


// ============================================================
// GLOBAL MEDIA NAVIGATION (ACROSS POSTS + GALLERIES)
// ============================================================
let postMediaList = [];     // Flat list of all media from all posts
let postMediaIndex = {};    // map postId -> start index in postMediaList
let currentIndex = 0;       // current index for gallery arrow navigation
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

        // Render posts sequentially
        for (let p of posts) {
            await renderPost(p.data);
        }

        totalMediaCount = postMediaList.length;

    } catch (err) {
        results.innerHTML = `<div class="post">Error loading posts: ${err.message}</div>`;
    }
}
//
//
// RENDER POST (images, videos, galleries, redgifs, gifs)
// This builds per-post UI elements AND feeds into the global media list
//
//
async function renderPost(post) {
    let div = document.createElement("div");
    div.className = "post";

    // Post title
    let title = document.createElement("div");
    title.textContent = post.title;
    title.style.marginBottom = "12px";
    div.appendChild(title);

    let url = post.url || "";
    let postId = post.id;

    // Track where this post's media begins in postMediaList
    postMediaIndex[postId] = postMediaList.length;

    // STORE ALL MEDIA FOR CROSS POST NAVIGATION
    let mediaItems = []; // list of media objects { type, src, postId }

    //
    // 1. GALLERY SUPPORT
    //
    if (post.is_gallery && post.gallery_data && imgFilter.checked) {
        let items = post.gallery_data.items;
        let images = items.map(i =>
            post.media_metadata[i.media_id].s.u.replace(/&amp;/g, "&")
        );

        images.forEach(src => {
            mediaItems.push({
                type: "image",
                src: src,
                postId: postId
            });
        });

        addGalleryToDOM(div, mediaItems, post); // draws preview + arrows
        return; // STOP HERE (we handled everything)
    }

    //
    // 2. REDGIFS SUPPORT
    //
    if (imgFilter.checked && url.includes("redgifs.com")) {
        let mp4 = await fetchRedgifsMP4(url);
        if (mp4) {
            mediaItems.push({
                type: "gif",
                src: mp4,
                postId: postId
            });

            addSingleMediaToDOM(div, mp4, "gif", post);
            return;
        }
    }

    //
    // 3. GIF SUPPORT (imgur gifv, reddit gif, gif)
    //
    if (imgFilter.checked && isGif(url)) {
        let mp4 = convertGifToMP4(url);

        mediaItems.push({
            type: "gif",
            src: mp4,
            postId: postId
        });

        addSingleMediaToDOM(div, mp4, "gif", post);
        return;
    }

    //
    // 4. NORMAL IMAGE
    //
    if (imgFilter.checked && post.post_hint === "image" && url) {
        mediaItems.push({
            type: "image",
            src: url,
            postId: postId
        });

        addSingleMediaToDOM(div, url, "image", post);
        return;
    }

    //
    // 5. NORMAL VIDEO
    //
    if (vidFilter.checked && post.is_video && post.media?.reddit_video?.fallback_url) {
        let vsrc = post.media.reddit_video.fallback_url;

        mediaItems.push({
            type: "video",
            src: vsrc,
            postId: postId
        });

        addSingleMediaToDOM(div, vsrc, "video", post);
        return;
    }

    //
    // 6. OTHER LINKS
    //
    if (otherFilter.checked) {
        let link = document.createElement("a");
        link.href = url;
        link.textContent = url;
        link.target = "_blank";
        div.appendChild(link);
        results.appendChild(div);
        return;
    }

    //
    // Add every media item to the master list
    //
    mediaItems.forEach(item => postMediaList.push(item));
}


//
// ADD SINGLE IMAGE OR VIDEO TO DOM
//
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
        el.muted = false;
    }
    else {
        el = document.createElement("img");
        el.src = src;
    }

    // Click to fullscreen
    el.onclick = () => openFullscreen(src, type === "image" ? "img" : "video");

    // Inject media
    div.appendChild(el);

    // ADD URL UNDER POST
    let urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.textContent = post.url;
    div.appendChild(urlLine);

    results.appendChild(div);

    // Add to global track
    postMediaList.push({
        type: type,
        src: src,
        postId: post.id
    });
}


//
// ADD GALLERY PREVIEW + ARROWS TO DOM
//
function addGalleryToDOM(div, mediaItems, post) {

    // Add to global track
    mediaItems.forEach(item => postMediaList.push(item));

    // Show first thumbnail
    let current = 0;

    let img = document.createElement("img");
    img.src = mediaItems[current].src;

    img.onclick = () => openFullscreenGallery(mediaItems, current);

    div.appendChild(img);

    //
    // LEFT ARROW
    //
    let left = document.createElement("div");
    left.className = "gallery-arrow-main gallery-arrow-main-left";
    left.textContent = "<";

    left.onclick = (e) => {
        e.stopPropagation();
        goGalleryStep(-1, img, mediaItems, post.id);
    };

    //
    // RIGHT ARROW
    //
    let right = document.createElement("div");
    right.className = "gallery-arrow-main gallery-arrow-main-right";
    right.textContent = ">";

    right.onclick = (e) => {
        e.stopPropagation();
        goGalleryStep(1, img, mediaItems, post.id);
    };

    div.appendChild(left);
    div.appendChild(right);

    // URL under post
    let urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.textContent = post.url;
    div.appendChild(urlLine);

    results.appendChild(div);
}
//
//
// CROSS-POST GALLERY NAVIGATION (MAIN PAGE ARROWS)
//
//

// Move gallery preview image left or right
function goGalleryStep(direction, imgElement, mediaItems, postId) {

    // Find index of first media of this post in global list
    let startIndex = postMediaIndex[postId];

    // Find the current index of the displayed media within global list
    let currentSrc = imgElement.src;
    let globalIdx = postMediaList.findIndex(m => m.src === currentSrc);

    if (globalIdx === -1) globalIdx = startIndex;

    // Move
    let nextIdx = globalIdx + direction;

    // Stop at boundaries
    if (nextIdx < 0 || nextIdx >= postMediaList.length) return;

    // Set new preview src
    imgElement.src = postMediaList[nextIdx].src;
}


//
// FULLSCREEN GALLERY VIEWER
//
function openFullscreenGallery(mediaItems, index) {

    const overlay = document.createElement("div");
    overlay.className = "fullscreen-media";

    let current = index;

    let media = mediaItems[current];
    let el;

    if (media.type === "image") {
        el = document.createElement("img");
        el.src = media.src;
    }
    else {
        el = document.createElement("video");
        el.src = media.src;
        el.controls = true;
        el.autoplay = true;
    }

    overlay.appendChild(el);

    // Left arrow
    let left = document.createElement("div");
    left.className = "gallery-arrow gallery-arrow-left";
    left.textContent = "<";

    left.onclick = (e) => {
        e.stopPropagation();
        current = current - 1;

        if (current < 0)
            current = mediaItems.length - 1;

        updateFullscreenMedia(overlay, mediaItems[current]);
    };

    // Right arrow
    let right = document.createElement("div");
    right.className = "gallery-arrow gallery-arrow-right";
    right.textContent = ">";

    right.onclick = (e) => {
        e.stopPropagation();
        current = (current + 1) % mediaItems.length;
        updateFullscreenMedia(overlay, mediaItems[current]);
    };

    overlay.appendChild(left);
    overlay.appendChild(right);

    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
}


//
// Update fullscreen viewer element
//
function updateFullscreenMedia(overlay, media) {

    overlay.innerHTML = "";

    let el;
    if (media.type === "image") {
        el = document.createElement("img");
        el.src = media.src;
    }
    else {
        el = document.createElement("video");
        el.src = media.src;
        el.controls = true;
        el.autoplay = true;
    }

    overlay.appendChild(el);

    let left = document.createElement("div");
    left.className = "gallery-arrow gallery-arrow-left";
    left.textContent = "<";
    overlay.appendChild(left);

    let right = document.createElement("div");
    right.className = "gallery-arrow gallery-arrow-right";
    right.textContent = ">";
    overlay.appendChild(right);

    left.onclick = (e) => {
        e.stopPropagation();
        let idx = postMediaList.findIndex(m => m.src === media.src);
        if (idx > 0) {
            updateFullscreenMedia(overlay, postMediaList[idx - 1]);
        }
    };

    right.onclick = (e) => {
        e.stopPropagation();
        let idx = postMediaList.findIndex(m => m.src === media.src);
        if (idx < postMediaList.length - 1) {
            updateFullscreenMedia(overlay, postMediaList[idx + 1]);
        }
    };
}
//
//
// FULLSCREEN FOR SINGLE IMAGE OR VIDEO
//
//
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

//
//
// SCROLL TO TOP BUTTON
//
//
scrollTopBtn.onclick = () => {
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
};

//
//
// BUTTONS
//
//

// Load posts
loadBtn.onclick = loadPosts;

// Clear
clearBtn.onclick = () => {
    input.value = "";
    results.innerHTML = "";
    postMediaList = [];
    postMediaIndex = {};
    currentIndex = 0;
    totalMediaCount = 0;
};

// Copy URL
copyBtn.onclick = () => {
    navigator.clipboard.writeText(input.value.trim());
};

// ZIP (placeholder)
zipBtn.onclick = () => {
    alert("ZIP creation coming next");
};
