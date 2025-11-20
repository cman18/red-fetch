const input = document.getElementById("input");
const loadBtn = document.getElementById("loadBtn");
const clearBtn = document.getElementById("clearBtn");
const copyBtn = document.getElementById("copyBtn");
const zipBtn = document.getElementById("zipBtn");
const results = document.getElementById("results");

const imgFilter = document.getElementById("imgFilter");
const vidFilter = document.getElementById("vidFilter");
const otherFilter = document.getElementById("otherFilter");

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

        posts.forEach(p => renderPost(p.data));

    } catch (err) {
        results.innerHTML = `<div class="post">Error loading posts: ${err.message}</div>`;
    }
}

/* Detect GIF link */
function isGif(url) {
    return (
        url.endsWith(".gif") ||
        url.endsWith(".gifv") ||
        url.includes("imgur.com") && url.match(/\.gifv?$/) ||
        url.includes("gfycat")
    );
}

function convertGifToMP4(url) {
    if (url.endsWith(".gifv")) return url.replace(".gifv", ".mp4");
    if (url.endsWith(".gif")) return url.replace(".gif", ".mp4");
    return url;
}

function renderPost(post) {
    let div = document.createElement("div");
    div.className = "post";

    let title = document.createElement("div");
    title.textContent = post.title;
    title.style.marginBottom = "12px";
    div.appendChild(title);

    let url = post.url || "";

    /* ------------------------------------------
       ⭐ GIF SUPPORT
    -------------------------------------------*/
    if (imgFilter.checked && isGif(url)) {
        let mp4 = convertGifToMP4(url);

        let vid = document.createElement("video");
        vid.src = mp4;
        vid.loop = true;
        vid.muted = false;
        vid.controls = false;

        // hover autoplay
        vid.onmouseenter = () => vid.play();
        vid.onmouseleave = () => vid.pause();

        // click enlarge
        vid.onclick = () => openFullscreen(mp4, "video");

        div.appendChild(vid);
        results.appendChild(div);
        return;
    }

    /* ------------------------------------------
       ⭐ NORMAL IMAGES
    -------------------------------------------*/
    if (imgFilter.checked && post.post_hint === "image" && url) {
        const img = document.createElement("img");
        img.src = url;
        img.onclick = () => openFullscreen(img.src, "img");
        div.appendChild(img);
    }

    /* ------------------------------------------
       ⭐ NORMAL VIDEOS (with sound)
    -------------------------------------------*/
    if (vidFilter.checked && post.is_video && post.media?.reddit_video?.fallback_url) {
        const vid = document.createElement("video");
        vid.src = post.media.reddit_video.fallback_url;
        vid.controls = true;
        vid.muted = false;   // allow sound
        vid.onclick = () => openFullscreen(vid.src, "video");

        // hover autoplay
        vid.onmouseenter = () => vid.play();
        vid.onmouseleave = () => vid.pause();

        div.appendChild(vid);
    }

    /* ------------------------------------------
       ⭐ OTHER LINKS
    -------------------------------------------*/
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

loadBtn.onclick = loadPosts;

clearBtn.onclick = () => {
    input.value = "";
    results.innerHTML = "";
};

copyBtn.onclick = () => {
    navigator.clipboard.writeText(input.value.trim());
};

zipBtn.onclick = () =>
    alert("ZIP downloads coming soon.");
