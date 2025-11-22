/* ============================================================
   Red Pull – app.js (Version 007q)
   Based on your last working version + gallery arrows on main
   page + GIF autoplay + RedGifs proxy + image/video enlarge.
   ============================================================ */

const resultsEl = document.getElementById("results");
const inputEl = document.getElementById("user-input");
const loadBtn = document.getElementById("load-btn");
const clearBtn = document.getElementById("clear-btn");
const copyBtn = document.getElementById("copy-btn");

const optImages = document.getElementById("opt-images");
const optVideos = document.getElementById("opt-videos");
const optOther = document.getElementById("opt-other");

let after = null;
let loading = false;

// ★ Your Cloudflare Worker proxy URL
const REDGIFS_PROXY = "https://red.coffeemanhou.workers.dev/?url=";

/* ============================================================
   Helpers
   ============================================================ */

function cleanUser(u) {
  if (!u) return "";
  u = u.trim();

  if (u.startsWith("https://www.reddit.com/u/")) {
    return u.split("/u/")[1].split("/")[0];
  }

  if (u.startsWith("https://www.reddit.com/user/")) {
    return u.split("/user/")[1].split("/")[0];
  }

  if (u.startsWith("https://www.reddit.com/")) {
    const parts = u.split("/");
    const idx = parts.indexOf("u") !== -1 ? parts.indexOf("u") : parts.indexOf("user");
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
  }

  if (u.startsWith("u/")) return u.slice(2);
  if (u.startsWith("/u/")) return u.slice(3);

  return u;
}

/* ============================================================
   Build Media Element
   ============================================================ */

function buildMedia(post) {
  const container = document.createElement("div");
  container.className = "media-card";

  // Title
  const title = document.createElement("div");
  title.className = "media-title";
  title.textContent = post.title || "(untitled)";
  container.appendChild(title);

  // URL under the media (as before)
  const link = document.createElement("div");
  link.className = "media-link";
  link.textContent = `r/${post.subreddit}`;
  container.appendChild(link);

  // Gallery
  if (post.is_gallery && post.gallery_data && post.media_metadata) {
    const gallery = document.createElement("div");
    gallery.className = "gallery-container";

    const items = post.gallery_data.items.map(i => post.media_metadata[i.media_id]);
    let index = 0;

    function showImage(i) {
      const meta = items[i];
      const src = meta.s.u.replace(/&amp;/g, "&");
      img.src = src;
    }

    const img = document.createElement("img");
    img.className = "gallery-main";
    img.onclick = () => enlargeMedia(img.src);
    gallery.appendChild(img);

    // Arrows (MAIN FEED)
    const left = document.createElement("div");
    left.className = "gallery-arrow left-arrow";
    left.textContent = "‹";
    left.onclick = (e) => {
      e.stopPropagation();
      index = (index - 1 + items.length) % items.length;
      showImage(index);
    };
    gallery.appendChild(left);

    const right = document.createElement("div");
    right.className = "gallery-arrow right-arrow";
    right.textContent = "›";
    right.onclick = (e) => {
      e.stopPropagation();
      index = (index + 1) % items.length;
      showImage(index);
    };
    gallery.appendChild(right);

    showImage(0);
    container.appendChild(gallery);
    return container;
  }

  // RedGifs video
  if (post.secure_media?.redgifs?.gif_id) {
    const id = post.secure_media.redgifs.gif_id;
    const video = document.createElement("video");
    video.className = "media-video";
    video.src = REDGIFS_PROXY + encodeURIComponent(`https://api.redgifs.com/v2/gifs/${id}`);
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.onclick = () => enlargeMedia(video.src);
    container.appendChild(video);
    return container;
  }

  // Regular video
  if (post.secure_media?.reddit_video?.fallback_url) {
    const video = document.createElement("video");
    video.className = "media-video";
    video.src = post.secure_media.reddit_video.fallback_url;
    video.controls = true;
    video.muted = true;
    video.onclick = () => enlargeMedia(video.src);
    container.appendChild(video);
    return container;
  }

  // Images
  if (post.url && (post.url.endsWith(".jpg") || post.url.endsWith(".png"))) {
    const img = document.createElement("img");
    img.className = "media-img";
    img.src = post.url;
    img.onclick = () => enlargeMedia(post.url);
    container.appendChild(img);
    return container;
  }

  // GIF autoplay
  if (post.url && post.url.endsWith(".gif")) {
    const img = document.createElement("img");
    img.className = "media-img";
    img.src = post.url;
    img.autoplay = true;
    img.onclick = () => enlargeMedia(post.url);
    container.appendChild(img);
    return container;
  }

  return null;
}

/* ============================================================
   Enlarged View
   ============================================================ */

function enlargeMedia(src) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";

  const box = document.createElement("div");
  box.className = "overlay-box";

  let el;
  if (src.endsWith(".mp4") || src.includes("workers.dev")) {
    el = document.createElement("video");
    el.src = src;
    el.controls = true;
    el.autoplay = true;
    el.loop = true;
    el.muted = false;
  } else {
    el = document.createElement("img");
    el.src = src;
  }

  el.className = "overlay-media";
  box.appendChild(el);
  overlay.appendChild(box);

  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
}

/* ============================================================
   Fetch Posts
   ============================================================ */

async function loadPosts(reset = false) {
  if (loading) return;
  loading = true;

  if (reset) {
    after = null;
    resultsEl.innerHTML = "";
  }

  const user = cleanUser(inputEl.value);
  if (!user) {
    loading = false;
    return alert("Enter a username");
  }

  const url =
    `https://www.reddit.com/user/${user}/submitted.json?limit=20` +
    (after ? `&after=${after}` : "");

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!resp.ok) throw new Error("Bad response");

    const data = await resp.json();
    after = data.data.after;

    const posts = data.data.children.map(x => x.data);

    posts.forEach(post => {
      const media = buildMedia(post);
      if (media) resultsEl.appendChild(media);
    });

  } catch (err) {
    console.error(err);
    alert("Error loading posts.");
  }

  loading = false;
}

/* ============================================================
   UI Buttons
   ============================================================ */

loadBtn.onclick = () => loadPosts(true);
clearBtn.onclick = () => {
  inputEl.value = "";
  resultsEl.innerHTML = "";
  after = null;
};
copyBtn.onclick = () => {
  navigator.clipboard.writeText(inputEl.value);
};

/* ============================================================
   Infinite Scroll
   ============================================================ */

window.addEventListener("scroll", () => {
  if (loading) return;
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 400) {
    if (after) loadPosts(false);
  }
});
