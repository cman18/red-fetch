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
   URL Extractor
   =================================================== */
function extractUserOrSub(url) {
    try {
        if (!url.includes("reddit.com")) return url.replace(/^u\//, "").trim();

        let clean = url;

        clean = clean.replace(/\/?s\/.*/, "");
        clean = clean.replace(/https?:\/\/(www\.)?reddit\.com\//, "");

        if (clean.startsWith("user/")) return clean.split("/")[1];
        if (clean.startsWith("u/")) return clean.split("/")[1];
        if (clean.startsWith("r/")) return clean.split("/")[1];

        return clean.replace(/\//g, "").trim();
    } catch {
        return url.trim();
    }
}

/* ===================================================
   Load Posts
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
        statusEl.textContent = "Enter a username or full Reddit URL.";
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

        if (!data.data) throw new Error("Invalid response");

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
        statusEl.textContent = "Error loading posts. Reddit may be blocking the request.";
    }

    loading = false;
}

/* ===================================================
   Render Posts + Modal Click
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

        // CLICK TO ENLARGE
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
   Buttons
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
   Infinite Scroll
   =================================================== */

window.addEventListener("scroll", () => {
    if (loading) return;
    if (!after) return;
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
        loadPosts(false);
    }
});
