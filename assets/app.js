const input = document.getElementById("input");
const loadBtn = document.getElementById("loadBtn");
const clearBtn = document.getElementById("clearBtn");
const copyBtn = document.getElementById("copyBtn");
const zipBtn = document.getElementById("zipBtn");
const results = document.getElementById("results");

const imgFilter = document.getElementById("imgFilter");
const vidFilter = document.getElementById("vidFilter");
const otherFilter = document.getElementById("otherFilter");


/* ---------------------------------------
   Username extract
---------------------------------------- */
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


/* ---------------------------------------
   Load Reddit posts
---------------------------------------- */
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


/* ---------------------------------------
   GIF helpers
---------------------------------------- */
function isGifLike(url) {
    return (
        url.endsWith(".gif") ||
        url.endsWith(".gifv") ||
        url.includes("imgur.com") && (url.endsWith(".gif") || url.endsWith(".gifv")) ||
        url.includes("gfycat.com") ||
        url.includes("redgifs.com")
    );
}

function convertGifToMP4(url) {
    if (url.endsWith(".gifv")) return url.replace(".gifv", ".mp4");
    if (url.endsWith(".gif")) return url.replace(".gif", ".mp4");
    return url;
}


/* ---------------------------------------
   RedGifs API fetch
---------------------------------------- */
async function fetchRedGifsMP4(id) {
    const api = `https://api.redgifs.com/v2/gifs/${id}`;
    const res = await fetch(api);

    if (!res.ok) return null;

    const json = await res.json();
    if (!json || !json.gif || !json.gif.urls) return null;

    return (
        json.gif.urls.hd ||
        json.gif.urls.sd ||
        json.gif.urls.mobile ||
        null
    );
}

function extractRedGifsID(url) {
    const m = url.match(/redgifs\.com\/(?:watch|ifr)\/([A-Za-z0-9]+)/i);
    return m ? m[1] : null;
}


/* ---------------------------------------
   Render post
---------------------------------------- */
async function renderPost(post) {
    const url = post.url || "";
    const div = document.createElement("div");
    div.className = "post";

    // title
    let title = document.createElement("div");
    title.textContent = post.title;
    title.style.marginBottom = "12px";
    div.appendChild(title);

    /* ---------------------------
       ⭐ REDGIFS SUPPORT
    ----------------------------*/
    if (isGifLike(url) && url.includes("redgifs.com")) {
        const id = extractRedGifsID(url);

        if (id) {
            const mp4 = await fetchRedGifsMP4(id);
            if (mp4) {
                const vid = document.createElement("video");
                vid.src = mp4;
                vid.loop = true;
                vid.muted = true;      // autoplay muted
                vid.autoplay = true;   // autoplay always
                vid.playsInline = true;
                vid.onclick = () => openFullscreen(mp4, "video");

                div.appendChild(vid);
                results.appendChild(div);
                return;
            }
        }
    }

    /* ---------------------------
       ⭐ NORMAL GIF/GIFV/IMGUR
    ----------------------------*/
    if (isGifLike(url) && !post.is_video) {
        const mp4 = convertGifToMP4(url);

        const vid = document.createElement("video");
        vid.src = mp4;
        vid.loop = true;
        vid.muted = true;
        vid.autoplay = true;
        vid.playsInline = true;

        vid.onclick = () => openFullscreen(mp4, "video");

        div.appendChild(vid);
        results.appendChild(div);
        return;
    }

    /* ---------------------------
       ⭐ IMAGES
    ----------------------------*/
    if (imgFilter.checked && post.post_hint === "image") {
        const img = document.createElement("img");
        img.src = url;
        img.onclick = () => openFullscreen(img.src, "img");
        div.appendChild(img);
    }

    /* ---------------------------
       ⭐ NORMAL REDDIT VIDEOS
    ----------------------------*/
    if (vidFilter.checked && post.is_video && post.media?.reddit_video?.fallback_url) {
        const vid = document.createElement("video");
        vid.src = post.media.reddit_video.fallback_url;
        vid.controls = true;
        vid.autoplay = false;
        vid.muted = false;

        vid.onclick = () => openFullscreen(vid.src, "video");
        div.appendChild(vid);
    }

    /* ---------------------------
       ⭐ OTHER LINKS
    ----------------------------*/
    if (otherFilter.checked && !post.is_video && !isGifLike(url)) {
        const link = document.createElement("a");
        link.href = url;
        link.textContent = url;
        link.target = "_blank";
        div.appendChild(link);
    }

    results.appendChild(div);
}


/* ---------------------------------------
   Fullscreen viewer
---------------------------------------- */
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


/* Buttons */
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
