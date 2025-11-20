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

// Extract username
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

function isGif(url) {
    if (!url) return false;
    return (
        url.endsWith(".gif") ||
        url.endsWith(".gifv") ||
        url.includes("imgur.com") && url.match(/\.gifv?$/) ||
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

// Redgifs real MP4
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

        return data.gif.urls.hd || data.gif.urls.sd || data.gif.urls.mobile || null;

    } catch (e) {
        return null;
    }
}

async function loadPosts() {
    results.innerHTML = "";

    const raw = input.value.trim();
    const username = extractUsername(raw);

    if (!username) {
        results.innerHTML = "<div class='post'>Invalid username or URL.</div>";
        return;
    }

    try {
        const url = `https://api.reddit.com/user/${username}/submitted?raw_json=1`;
        const res = await fetch(url);

        if (!res.ok) throw new Error("Reddit blocked");

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

// Gallery modal navigation state
let galleryList = [];
let galleryIndex = 0;

function openGallery(images, index) {
    galleryList = images;
    galleryIndex = index;

    const src = galleryList[galleryIndex];

    const overlay = document.createElement("div");
    overlay.className = "fullscreen-media";

    const img = document.createElement("img");
    img.src = src;

    overlay.appendChild(img);

    let left = document.createElement("div");
    left.className = "gallery-arrow gallery-arrow-left";
    left.textContent = "<";
    left.onclick = (e) => {
        e.stopPropagation();
        galleryIndex = (galleryIndex - 1 + galleryList.length) % galleryList.length;
        img.src = galleryList[galleryIndex];
    };

    let right = document.createElement("div");
    right.className = "gallery-arrow gallery-arrow-right";
    right.textContent = ">";
    right.onclick = (e) => {
        e.stopPropagation();
        galleryIndex = (galleryIndex + 1) % galleryList.length;
        img.src = galleryList[galleryIndex];
    };

    overlay.appendChild(left);
    overlay.appendChild(right);

    overlay.onclick = () => overlay.remove();

    document.body.appendChild(overlay);
}

async function renderPost(post) {
    let div = document.createElement("div");
    div.className = "post";

    let title = document.createElement("div");
    title.textContent = post.title;
    title.style.marginBottom = "12px";
    div.appendChild(title);

    let url = post.url || "";

    // Gallery support
    if (post.is_gallery && post.gallery_data && imgFilter.checked) {
        let images = post.gallery_data.items.map(i => post.media_metadata[i.media_id].s.u.replace(/&amp;/g, "&"));

        let img = document.createElement("img");
        img.src = images[0];
        img.onclick = () => openGallery(images, 0);

        div.appendChild(img);
        results.appendChild(div);
        return;
    }

    // Redgifs
    if (imgFilter.checked && url.includes("redgifs.com")) {
        let mp4 = await fetchRedgifsMP4(url);
        if (mp4) {
            let vid = document.createElement("video");
            vid.src = mp4;
            vid.autoplay = true;
            vid.loop = true;
            vid.muted = true;
            vid.onclick = () => openFullscreen(mp4, "video");

            div.appendChild(vid);
            results.appendChild(div);
            return;
        }
    }

    // GIFs
    if (imgFilter.checked && isGif(url)) {
        let mp4 = convertGifToMP4(url);
        let vid = document.createElement("video");
        vid.src = mp4;
        vid.autoplay = true;
        vid.loop = true;
        vid.muted = true;
        vid.onclick = () => openFullscreen(mp4, "video");

        div.appendChild(vid);
        results.appendChild(div);
        return;
    }

    // Image
    if (imgFilter.checked && post.post_hint === "image" && url) {
        const img = document.createElement("img");
        img.src = url;
        img.onclick = () => openFullscreen(img.src, "img");
        div.appendChild(img);
    }

    // Video
    if (vidFilter.checked && post.is_video && post.media?.reddit_video?.fallback_url) {
        const vid = document.createElement("video");
        vid.src = post.media.reddit_video.fallback_url;
        vid.controls = true;
        vid.muted = false;
        vid.onclick = () => openFullscreen(vid.src, "video");
        div.appendChild(vid);
    }

    // Link
    if (otherFilter.checked && !post.is_video && !post.post_hint?.includes("image") && !isGif(url)) {
        const link = document.createElement("a");
        link.href = url;
        link.textContent = url;
        link.target = "_blank";
        div.appendChild(link);
    }

    results.appendChild(div);
}

// Fullscreen for single item
function openFullscreen(src, type) {
    const overlay = document.createElement("div");
    overlay.className = "fullscreen-media";

    if (type === "img") {
        const img = document.createElement("img");
        img.src = src;
        overlay.appendChild(img);
    } else {
        const vid = document.createElement("video");
        vid.src = src;
        vid.controls = true;
        vid.autoplay = true;
        overlay.appendChild(vid);
    }

    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
}

// Scroll to top
scrollTopBtn.onclick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
};

// Buttons
loadBtn.onclick = loadPosts;

clearBtn.onclick = () => {
    input.value = "";
    results.innerHTML = "";
};

copyBtn.onclick = () => {
    navigator.clipboard.writeText(input.value.trim());
};

zipBtn.onclick = () =>
    alert("ZIP creation coming next");
