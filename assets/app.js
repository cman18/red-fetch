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

function renderPost(post) {
    let div = document.createElement("div");
    div.className = "post";

    let title = document.createElement("div");
    title.textContent = post.title;
    title.style.marginBottom = "12px";
    div.appendChild(title);

    if (imgFilter.checked && post.post_hint === "image" && post.url) {
        const img = document.createElement("img");
        img.src = post.url;
        img.onclick = () => openFullscreen(img.src, "img");
        div.appendChild(img);
    }

    if (vidFilter.checked && post.is_video && post.media?.reddit_video?.fallback_url) {
        const vid = document.createElement("video");
        vid.controls = true;
        vid.src = post.media.reddit_video.fallback_url;
        vid.onclick = () => openFullscreen(vid.src, "video");
        div.appendChild(vid);
    }

    if (otherFilter.checked && !post.is_video && !post.post_hint?.includes("image")) {
        const link = document.createElement("a");
        link.href = post.url;
        link.textContent = post.url;
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
