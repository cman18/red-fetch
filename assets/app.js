const input = document.getElementById("input");
const loadBtn = document.getElementById("loadBtn");
const clearBtn = document.getElementById("clearBtn");
const copyBtn = document.getElementById("copyBtn");
const zipBtn = document.getElementById("zipBtn");
const results = document.getElementById("results");

const imgFilter = document.getElementById("imgFilter");
const vidFilter = document.getElementById("vidFilter");
const otherFilter = document.getElementById("otherFilter");

// Extract username from URL or direct text
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

// Determine if a URL is gif type
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

// Redgifs fetch
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

        // Prefer highest quality available
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

async function renderPost(post) {
    let div = document.createElement("div");
    div.className = "post";

    let title = document.createElement("div");
    title.textContent = post.title;
    title.style.marginBottom = "12px";
    div.appendChild(title);

    let url = post.url || "";

    // Redgifs support
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

    // GIF support
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

    // Normal image
    if (imgFilter.checked && post.post_hint === "image" && url) {
        const img = document.createElement("img");
        img.src = url;
        img.onclick = () => openFullscreen(img.src, "img");

        div.appendChild(img);
    }

    // Normal video
    if (vidFilter.checked && post.is_video && post.media?.reddit_video?.fallback_url) {
        const vid = document.createElement("video");
        vid.src = post.media.reddit_video.fallback_url;
        vid.controls = true;
        vid.muted = false;

        vid.onclick = () => openFullscreen(vid.src, "video");

        div.appendChild(vid);
    }

    // Other type
    if (otherFilter.checked && !post.is_video && !post.post_hint?.includes("image") && !isGif(url)) {
        const link = document.createElement("a");
        link.href = url;
        link.textContent = url;
        link.target = "_blank";
        div.appendChild(link);
    }

    results.appendChild(div);
}

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
    alert("ZIP creation under development");
