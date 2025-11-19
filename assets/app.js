document.addEventListener("DOMContentLoaded", () => {
    loadPosts(true);
});

let after = null;
let currentUser = "";
let currentMode = "u";
let currentSort = "hot";

document.getElementById("modeSelect").addEventListener("change", () => {
    const mode = document.getElementById("modeSelect").value;
    const sortControls = document.getElementById("sortControls");

    if (mode === "r") {
        sortControls.classList.remove("hidden");
    } else {
        sortControls.classList.add("hidden");
    }
});

async function loadPosts(reset=false) {
    const container = document.getElementById("app");
    const status = document.getElementById("status");

    if (reset) {
        container.innerHTML = "";
        after = null;
    }

    currentUser = document.getElementById("userInput").value.trim();
    currentMode = document.getElementById("modeSelect").value;
    currentSort = document.getElementById("sortSelect").value;

    if (!currentUser) {
        alert("Enter a user or subreddit");
        return;
    }

    let url;
    if (currentMode === "u") {
        url = `https://www.reddit.com/user/${currentUser}/submitted.json?limit=20`;
    } else {
        url = `https://www.reddit.com/r/${currentUser}/${currentSort}.json?limit=20`;
    }

    if (after) url += `&after=${after}`;

    status.textContent = "Loading… • v007";
    const data = await fetch(url).then(r => r.json());

    const posts = data.data.children || [];
    after = data.data.after;

    status.textContent = `Loaded ${posts.length} posts — scroll to load more • v007`;

    posts.forEach(post => {
        const d = post.data;
        const card = document.createElement("div");
        card.className = "post";

        card.innerHTML = `<div class="post-title">${d.title}</div>`;

        let mediaElem = null;

        const isRedditVideo = d.is_video && d.media?.reddit_video;
        const isGif = d.url.endsWith(".gif") || d.url.endsWith(".gifv");
        const isMp4 = d.url.endsWith(".mp4");
        const isPreviewVideo = isGif || isMp4 || isRedditVideo;

        if (isPreviewVideo) {
            const videoUrl = isRedditVideo
                ? d.media.reddit_video.fallback_url
                : d.url.replace(".gifv", ".mp4");

            const thumb = d.thumbnail && d.thumbnail !== "default"
                ? d.thumbnail
                : d.preview?.images?.[0]?.source?.url || "";

            mediaElem = document.createElement("img");
            mediaElem.className = "thumb video-thumb";
            mediaElem.dataset.src = videoUrl;
            mediaElem.src = thumb || "https://i.redd.it/no_thumbnail.png";

            setupVideoHover(mediaElem);
            setupVideoClick(mediaElem);
        } else if (d.url.match(/\.(jpg|png|jpeg)$/i)) {
            mediaElem = document.createElement("img");
            mediaElem.className = "thumb";
            mediaElem.src = d.url;
        }

        if (mediaElem) card.appendChild(mediaElem);
        container.appendChild(card);
    });
}

window.addEventListener("scroll", () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
        loadPosts(false);
    }
});

function setupVideoHover(thumb) {
    let inlineVid = null;

    thumb.addEventListener("mouseenter", () => {
        inlineVid = document.createElement("video");
        inlineVid.src = thumb.dataset.src;
        inlineVid.autoplay = true;
        inlineVid.muted = true;
        inlineVid.loop = true;
        inlineVid.className = "inlineVideo";
        thumb.replaceWith(inlineVid);
    });

    thumb.addEventListener("mouseleave", () => {
        if (!inlineVid) return;
        inlineVid.pause();
        inlineVid.replaceWith(thumb);
        inlineVid = null;
    });
}

function setupVideoClick(thumb) {
    thumb.addEventListener("click", () => {
        openVideoModal(thumb.dataset.src);
    });
}

const modal = document.getElementById("videoModal");
const modalVideo = document.getElementById("modalVideo");

function openVideoModal(src) {
    modalVideo.src = src;
    modal.classList.remove("hidden");
    modalVideo.play();
}

modal.addEventListener("click", e => {
    if (e.target === modal) {
        modalVideo.pause();
        modalVideo.src = "";
        modal.classList.add("hidden");
    }
});

const scrollTopBtn = document.getElementById("scrollTopBtn");

window.addEventListener("scroll", () => {
    if (window.scrollY > 300) scrollTopBtn.style.display = "block";
    else scrollTopBtn.style.display = "none";
});

scrollTopBtn.onclick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
};
