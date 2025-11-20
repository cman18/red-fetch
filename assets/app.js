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

    // Shared URL like /u/name/s/guid
    let match = text.match(/\/u\/([^\/]+)/i);
    if (match) return match[1];

    // Classic profile link
    match = text.match(/reddit\.com\/user\/([^\/]+)/i);
    if (match) return match[1];

    // Direct /u/name/
    match = text.match(/reddit\.com\/u\/([^\/]+)/i);
    if (match) return match[1];

    // Plain username
    if (/^[A-Za-z0-9_-]{2,30}$/.test(text)) return text;

    return null;
}

async function loadPosts() {
    results.innerHTML = "";
    let raw = input.value.trim();
    let username = extractUsername(raw);

    if (!username) {
        results.innerHTML = "<div class='post'>Invalid username or URL.</div>";
        return;
    }

    let url = `https://www.reddit.com/user/${username}/submitted.json?raw_json=1`;

    try {
        let req = await fetch(url);
        if (!req.ok) throw new Error("Reddit blocked");

        let data = await req.json();
        let posts = data.data.children;

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

    // IMAGES
    if (imgFilter.checked && post.post_hint === "image" && post.url) {
        let img = document.createElement("img");
        img.src = post.url;
        img.onclick = () => openFullscreen(img.src, "img");
        div.appendChild(img);
    }

    // VIDEOS
    if (vidFilter.checked && post.is_video && post.media?.reddit_video) {
        let vid = document.createElement("video");
        vid.src = post.media.reddit_video.fallback_url;
        vid.controls = true;
        vid.onclick = () => openFullscreen(vid.src, "video");
        div.appendChild(vid);
    }

    // OTHER CONTENT
    if (otherFilter.checked && !post.is_video && !post.post_hint?.includes("image")) {
        let link = document.createElement("a");
        link.href = post.url;
        link.textContent = post.url;
        link.target = "_blank";
        div.appendChild(link);
    }

    results.appendChild(div);
}

// fullscreen open
function openFullscreen(src, type) {
    let overlay = document.createElement("div");
    overlay.className = "fullscreen-media";

    if (type === "img") {
        let el = document.createElement("img");
        el.src = src;
        overlay.appendChild(el);
    } else {
        let el = document.createElement("video");
        el.src = src;
        el.controls = true;
        el.autoplay = true;
        overlay.appendChild(el);
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

// ZIP stub (unchanged)
zipBtn.onclick = () => alert("ZIP download coming soon.");
