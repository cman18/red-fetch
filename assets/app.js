const usernameInput = document.getElementById("username");
const loadBtn = document.getElementById("load-btn");
const clearBtn = document.getElementById("clear-btn");
const copyBtn = document.getElementById("copy-btn");

const results = document.getElementById("results");
const statusEl = document.getElementById("status");
const scrollHint = document.getElementById("scroll-hint");

const modal = document.getElementById("modal");
const modalContent = document.getElementById("modal-content");

// Filters
const fImages = document.getElementById("filter-images");
const fVideos = document.getElementById("filter-videos");
const fOther = document.getElementById("filter-other");

let after = null;
let loading = false;
let activeUser = "";

/* ===================================================
   FIXED EXTRACTOR (handles ALL cases):
   - /u/username/s/ABCDE
   - /user/username
   - /u/username
   - /r/subreddit
   - u/username
   - r/subreddit
   - plain usernames  <—— fixed
   =================================================== */

function extractUserOrSub(url) {
    const raw = url.trim();

    // A) Share URL
    const share = raw.match(/reddit\.com\/u\/([^\/]+)\/s\//i);
    if (share) return share[1];

    // B) user/username
    const user1 = raw.match(/reddit\.com\/user\/([^\/]+)/i);
    if (user1) return user1[1];

    // C) u/username
    const user2 = raw.match(/reddit\.com\/u\/([^\/]+)/i);
    if (user2) return user2[1];

    // D) r/subreddit
    const sub = raw.match(/reddit\.com\/r\/([^\/]+)/i);
    if (sub) return sub[1];

    // E) short forms
    if (raw.startsWith("u/")) return raw.slice(2);
    if (raw.startsWith("r/")) return raw.slice(2);

    // F) Plain username
    if (!raw.includes("/")) return raw;

    // G) Final fallback
    return raw.replace(/\//g, "") || raw;
}

/* ===================================================
   LOAD POSTS
   =================================================== */

async function loadPosts(reset = true) {
    if (loading) return;
    loading = true;
    statusEl.textContent = "Loading…";

    if (reset) {
        results.innerHTML = "";
        after = null;
        scrollHint.style.display = "none";
    }

    const raw = usernameInput.value.trim();

    if (!raw) {
        statusEl.textContent = "Enter a username or URL.";
        loading = false;
        return;
    }

    activeUser = extractUserOrSub(raw);

    const isSub = raw.includes("/r/") || raw.includes("reddit.com/r/");
    const endpoint = isSub
        ? `https://www.reddit.com/r/${activeUser}/.json?limit=20${after ? "&after=" + after : ""}`
        : `https://www.reddit.com/user/${activeUser}/submitted/.json?limit=20${after ? "&after=" + after : ""}`;

    try {
        const res = await fetch(endpoint);
        const data = await res.json();

        if (!data.data) throw new Error("Invalid");

        after = data.data.after;
        const posts = data.data.children;

        if (posts.length === 0 && reset) {
            statusEl.textContent = "No posts found.";
            loading = false;
            return;
        }

        renderPosts(posts);

        statusEl.textContent = after ? "Scroll to load more…" : "Done.";
        if (results.children.length > 0) scrollHint.style.display = "block";

    } catch (e) {
        statusEl.textContent = "Error loading posts.";
    }

    loading = false;
}

/* ===================================================
   RENDER POSTS + CLICK TO ENLARGE
   =================================================== */

function renderPosts(posts) {
    posts.forEach(p => {
        const d = p.data;

        const box = document.createElement("div");
        box.className = "post";

        let content = "";

        if (d.post_hint === "image" && fImages.checked) {
            content = `<img src="${d.url}" loading="lazy">`;
        }
        else if (d.is_video && fVideos.checked) {
            content = `<video preload="none"><source src="${d.media.reddit_video.fallback_url}"></video>`;
        }
        else if (fOther.checked) {
            content = `<a href="${d.url}" target="_blank">${d.url}</a>`;
        }

        box.innerHTML = content;
        results.appendChild(box);

        // Modal enlarge
        box.onclick = () => {
            modal.style.display = "flex";

            if (d.post_hint === "image") {
                modalContent.innerHTML = `<img src="${d.url}">`;
            }
            else if (d.is_video) {
                modalContent.innerHTML = `
                    <video controls autoplay>
                        <source src="${d.media.reddit_video.fallback_url}">
                    </video>`;
            }
        };
    });
}

// Close modal
modal.onclick = () => {
    modal.style.display = "none";
    modalContent.innerHTML = "";
};

/* ===================================================
   BUTTONS
   =================================================== */

loadBtn.onclick = () => loadPosts(true);

clearBtn.onclick = () => {
    usernameInput.value = "";
    results.innerHTML = "";
    statusEl.textContent = "Cleared.";
    scrollHint.style.display = "none";
    after = null;
};

copyBtn.onclick = () => {
    navigator.clipboard.writeText(usernameInput.value.trim());
    statusEl.textContent = "URL copied.";
};

/* ===================================================
   INFINITE SCROLL
   =================================================== */

window.addEventListener("scroll", () => {
    if (loading) return;
    if (!after) return;
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
        loadPosts(false);
    }
});
