/* Version 007e + URL sharing + copy button row */

const inputEl = document.getElementById("username");
const loadBtn = document.getElementById("load-btn");
const clearBtn = document.getElementById("clear-btn");
const copyBtn = document.getElementById("copy-btn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const loadingMoreEl = document.getElementById("loading-more");

let after = null;
let currentURL = null;
let loading = false;

/* ============================================
   URL NORMALIZATION
   ============================================ */

function normalizeRedditInput(raw) {
  if (!raw) return null;

  raw = raw.trim();
  raw = raw.replace(/\?.*$/, "");

  // Handle /u/username/s/guid (Reddit share URLs)
  let sMatch = raw.match(/\/u\/([^\/]+)\/s\//i);
  if (sMatch) {
    return `https://www.reddit.com/user/${sMatch[1]}/submitted.json`;
  }

  // /user/name
  let u1 = raw.match(/\/user\/([^\/]+)/i);
  if (u1) {
    return `https://www.reddit.com/user/${u1[1]}/submitted.json`;
  }

  // /u/name
  let u2 = raw.match(/\/u\/([^\/]+)/i);
  if (u2) {
    return `https://www.reddit.com/user/${u2[1]}/submitted.json`;
  }

  // /r/sub
  let r1 = raw.match(/\/r\/([^\/]+)/i);
  if (r1) {
    return `https://www.reddit.com/r/${r1[1]}/new.json`;
  }

  // short forms
  if (raw.startsWith("u/")) {
    return `https://www.reddit.com/user/${raw.slice(2)}/submitted.json`;
  }

  if (raw.startsWith("r/")) {
    return `https://www.reddit.com/r/${raw.slice(2)}/new.json`;
  }

  // fallback = assume username
  return `https://www.reddit.com/user/${raw}/submitted.json`;
}

/* ============================================
   LOAD POSTS
   ============================================ */

async function loadPosts(reset = true) {
  if (loading) return;
  loading = true;

  statusEl.textContent = "Loading…";

  if (reset) {
    resultsEl.innerHTML = "";
    after = null;
  }

  const userInput = inputEl.value;
  const baseURL = normalizeRedditInput(userInput);

  if (!baseURL) {
    statusEl.textContent = "Invalid input.";
    loading = false;
    return;
  }

  currentURL = baseURL;

  const fullURL = after ? `${baseURL}?after=${after}` : baseURL;

  try {
    const response = await fetch(fullURL, { cache: "no-store" });

    if (!response.ok) throw new Error("Fetch failed");

    const json = await response.json();
    const posts = json.data.children;
    after = json.data.after;

    if (!posts.length) {
      statusEl.textContent = "No posts found.";
      loading = false;
      return;
    }

    renderPosts(posts);
    statusEl.textContent = "";

  } catch (e) {
    statusEl.textContent =
      "Error loading posts. Reddit may be blocking the request or the user may not exist.";
  }

  loading = false;
}

/* ============================================
   RENDER POSTS
   ============================================ */

function renderPosts(posts) {
  posts.forEach((p) => {
    const post = p.data;

    const card = document.createElement("div");
    card.className = "post-card";

    if (post.is_video && post.media?.reddit_video?.fallback_url) {
      const vid = document.createElement("video");
      vid.controls = true;
      vid.src = post.media.reddit_video.fallback_url;
      card.appendChild(vid);
    } else if (post.url && /\.(jpg|jpeg|png|gif)$/i.test(post.url)) {
      const img = document.createElement("img");
      img.src = post.url;
      card.appendChild(img);
    } else {
      const title = document.createElement("p");
      title.textContent = post.title || "(No preview available)";
      card.appendChild(title);
    }

    resultsEl.appendChild(card);
  });
}

/* ============================================
   BUTTONS
   ============================================ */

loadBtn.onclick = () => loadPosts(true);

clearBtn.onclick = () => {
  inputEl.value = "";
  resultsEl.innerHTML = "";
  statusEl.textContent = "";
};

copyBtn.onclick = () => {
  navigator.clipboard.writeText(inputEl.value.trim());
  statusEl.textContent = "Copied!";
  setTimeout(() => (statusEl.textContent = ""), 1200);
};

/* ============================================
   INFINITE SCROLL
   ============================================ */

window.addEventListener("scroll", () => {
  if (loading) return;
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
    if (after) loadPosts(false);
  }
});
