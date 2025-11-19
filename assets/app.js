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

        let media = null;

        if (d.is_video && d.media?.reddit_video) {
            const vidUrl = d.media.reddit_video.fallback_url;
            const thumb = d.thumbnail && d.thumbnail !== "default" ? d.thumbnail : "";

            media = document.createElement("img");
            media.className = "thumb video-thumb";
            media.dataset.src = vidUrl;
            media.src = thumb || "https://i.redd.it/no_thumbnail.png";

            setupVideoHover(media);
            setupVideoClick(media);
        }

        else if (d.url.match(/\.(jpg|png|jpeg|gif)$/i)) {
            media = document.createElement("img");
            media.className = "thumb";
            media.src = d.url;
        }

        if (media) card.appendChild(media);
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
