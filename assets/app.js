/* Version 007e – Fixes ONLY loading + modal issues */

const inputEl = document.getElementById("username");
const loadBtn = document.getElementById("load-btn");
const clearBtn = document.getElementById("clear-btn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

let after = null;
let currentURL = null;

// =============================================
// FIX 1 — Robust URL NORMALIZATION
// =============================================
function normalizeRedditInput(raw) {
  if (!raw) return null;

  raw = raw.trim();

  // Remove trackers
  raw = raw.replace(/\?.*$/, "");

  // Already a Reddit URL → extract type + name
  if (raw.includes("reddit.com")) {
    const uMatch = raw.match(/\/user\/([^\/]+)/i);
    const rMatch = raw.match(/\/r\/([^\/]+)/i);

    if (uMatch) return `https://www.reddit.com/user/${uMatch[1]}/submitted.json`;
    if (rMatch) return `https://www.reddit.com/r/${rMatch[1]}/new.json`;
  }

  // Plain username with "u/" prefix inside UI
  if (raw.startsWith("u/") || raw.startsWith("U/")) {
    let name = raw.slice(2);
    return `https://www.reddit.com/user/${name}/submitted.json`;
  }

  // Subreddit detection
  if (raw.startsWith("r/") || raw.startsWith("R/")) {
    let name = raw.slice(2);
    return `https://www.reddit.com/r/${name}/new.json`;
  }

  // If user typed ONLY a name (default to user profile)
  return `https://www.reddit.com/user/${raw}/submitted.json`;
}

// =============================================
// Load Posts
// =============================================
async function loadPosts(reset = true) {
  statusEl.textContent = "Loading…";

  if (reset) {
    resultsEl.innerHTML = "";
    after = null;
  }

  const userInput = inputEl.value;
  const apiURL = normalizeRedditInput(userInput);

  if (!apiURL) {
    statusEl.textContent = "Invalid input.";
    return;
  }

  currentURL = apiURL;

  try {
    const url = after ? `${apiURL}?after=${after}` : apiURL;
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) throw new Error("Fetch failed");

    const data = await response.json();
    const posts = data.data.children;

    if (!posts.length) {
      statusEl.textContent = "No posts found.";
      return;
    }

    after = data.data.after;

    renderPosts(posts);
    statusEl.textContent = "";
  } catch (e) {
    statusEl.textContent =
      "Error loading posts. Reddit may be blocking the request or the user may not exist.";
  }
}

// =============================================
// Render Posts
// =============================================
function renderPosts(posts) {
  posts.forEach((p) => {
    const post = p.data;
    const card = document.createElement("div");
    card.className = "post-card";

    // VIDEO
    if (post.is_video && post.media?.reddit_video?.fallback_url) {
      const vid = document.createElement("video");
      vid.controls = true;
      vid.src = post.media.reddit_video.fallback_url;
      card.appendChild(vid);
    }

    // IMAGE
    else if (post.url && /\.(jpg|jpeg|png|gif)$/i.test(post.url)) {
      const img = document.createElement("img");
      img.src = post.url;
      card.appendChild(img);
    }

    // OTHER — show text title only
    else {
      const title = document.createElement("p");
      title.textContent = post.title;
      card.appendChild(title);
    }

    resultsEl.appendChild(card);
  });
}

// =============================================
// Buttons
// =============================================
loadBtn.onclick = () => loadPosts(true);
clearBtn.onclick = () => {
  inputEl.value = "";
  resultsEl.innerHTML = "";
  statusEl.textContent = "";
};
