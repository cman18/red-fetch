document.addEventListener("DOMContentLoaded", () => {
    loadPosts();
});

async function loadPosts() {
    const container = document.getElementById("app");
    container.innerHTML = "";

    const url = "https://www.reddit.com/r/pics/hot.json?limit=20";
    const data = await fetch(url).then(r => r.json());

    data.data.children.forEach(post => {
        const d = post.data;

        const card = document.createElement("div");
        card.className = "post";

        card.innerHTML = `
            <div class="post-title">${d.title}</div>
        `;

        let mediaElem = null;

        // Enhanced video/gif detection (007a)
        const isRedditVideo = d.is_video && d.media?.reddit_video;
        const isGif = d.url.endsWith(".gif") || d.url.endsWith(".gifv");
        const isMp4 = d.url.endsWith(".mp4");
        const isPreviewVideo = isGif || isMp4 || isRedditVideo;

        if (isPreviewVideo) {
            const videoUrl = isRedditVideo
                ? d.media.reddit_video.fallback_url
                : d.url.replace(".gifv", ".mp4");

            const thumbnail = d.thumbnail && d.thumbnail !== "default"
                ? d.thumbnail
                : d.preview?.images?.[0]?.source?.url || "";

            mediaElem = document.createElement("img");
            mediaElem.className = "thumb video-thumb";
            mediaElem.dataset.src = videoUrl;
            mediaElem.src = thumbnail || "https://i.redd.it/no_thumbnail.png";

            setupVideoHover(mediaElem);
            setupVideoClick(mediaElem);
        }

        else if (d.url.match(/\.(jpg|png|jpeg)$/i)) {
            mediaElem = document.createElement("img");
            mediaElem.className = "thumb";
            mediaElem.src = d.url;
        }

        if (mediaElem) card.appendChild(mediaElem);
        container.appendChild(card);
    });
}

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
