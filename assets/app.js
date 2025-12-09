/* =========================================================
   app.js — Version v1.1.43
   Gallery fix: image load hook + forced visible tiles
========================================================= */

const results = document.getElementById("results");
const input = document.getElementById("input");
const modeSelect = document.getElementById("modeSelect");
const loadBtn = document.getElementById("loadBtn");
const clearBtn = document.getElementById("clearBtn");
const copyBtn = document.getElementById("copyBtn");
const zipBtn = document.getElementById("zipBtn");
const colToggleBtn = document.getElementById("colToggleBtn");
const scrollTopBtn = document.getElementById("scrollTopBtn");

let currentUser = null;
let afterToken = null;
let loadingMore = false;
let forcedMode = "3";

const REDGIFS_PROXY = "https://red.coffeemanhou.workers.dev/?id=";

/* Username extraction */
function extractUsername(text) {
    if (!text) return null;
    text = text.trim();
    let m;

    m = text.match(/\/u\/([^\/]+)/i); if (m) return m[1];
    m = text.match(/reddit\.com\/user\/([^\/]+)/i); if (m) return m[1];
    m = text.match(/\bu\/([A-Za-z0-9_-]+)/i); if (m) return m[1];
    if (/^[A-Za-z0-9_-]{2,30}$/.test(text)) return text;
    return null;
}

/* Column toggle */
function applyColumnMode() {
    results.classList.remove("force-2-cols", "force-3-cols");
    results.classList.add(forcedMode === "2" ? "force-2-cols" : "force-3-cols");
}
colToggleBtn.onclick = () => {
    forcedMode = forcedMode === "3" ? "2" : "3";
    colToggleBtn.textContent = "Columns: " + forcedMode;
    applyColumnMode();
};

/* Redgifs detection */
function isRedgifsURL(url) { return url && url.includes("redgifs.com"); }

function extractRedgifsSlug(url) {
    if (!url) return null;
    if (url.includes("out.reddit.com")) {
        try {
            const dest = new URL(url).searchParams.get("url");
            if (dest) url = dest;
        } catch {}
    }
    let m;
    m = url.match(/redgifs\.com\/watch\/([A-Za-z0-9]+)/); if (m) return m[1];
    m = url.match(/redgifs\.com\/ifr\/([A-Za-z0-9]+)/); if (m) return m[1];
    m = url.match(/redgifs\.com\/([A-Za-z0-9]+)$/); if (m) return m[1];
    return null;
}

async function fetchRedgifsMP4(url) {
    const slug = extractRedgifsSlug(url);
    if (!slug) return null;

    try {
        const res = await fetch(REDGIFS_PROXY + slug);
        if (!res.ok) return null;
        const json = await res.json();
        return json.mp4 || null;
    } catch {
        return null;
    }
}

/* GIF handling */
function isGif(url) {
    return url && (url.endsWith(".gif") || url.endsWith(".gifv") || url.includes("gfycat"));
}
function convertGifToMP4(url) {
    if (url.includes("imgur")) return url.replace(".gifv",".mp4").replace(".gif",".mp4");
    if (url.includes("gfycat")) {
        const id = url.split("/").pop().split("-")[0];
        return `https://giant.gfycat.com/${id}.mp4`;
    }
    return url.replace(".gifv",".mp4").replace(".gif",".mp4");
}

/* Title expand */
function setupTitleBehavior(t) {
    const full = t.textContent.trim();
    if (!full) return;
    const test = document.createElement("span");
    test.style.visibility = "hidden";
    test.style.whiteSpace = "nowrap";
    test.textContent = full;
    document.body.appendChild(test);
    if (test.offsetWidth <= t.clientWidth) { test.remove(); return; }
    test.remove();

    const arrow = document.createElement("span");
    arrow.className = "title-arrow";
    arrow.textContent = "⌄";
    t.appendChild(arrow);

    arrow.onclick = e => {
        e.stopPropagation();
        const exp = t.classList.toggle("full");
        arrow.textContent = exp ? "⌃" : "⌄";
    };
}

/* Text fallback */
function renderTextFallback(post) {
    const wrap = document.createElement("div");
    wrap.className = "post";
    const t = document.createElement("div");
    t.className = "post-title";
    t.textContent = post.title || "";
    wrap.appendChild(t);

    const box = document.createElement("div");
    box.className = "tile-media";

    const ph = document.createElement("div");
    ph.className = "placeholder-media";
    ph.textContent = "Text Post";
    box.appendChild(ph);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.innerHTML = `<a href="${post.url}" target="_blank">${post.url}</a>`;

    wrap.appendChild(box);
    wrap.appendChild(urlLine);
    setupTitleBehavior(t);
    results.appendChild(wrap);
}

/* Fade-in image helper */
function fadeIn(el) {
    el.onload = () => { el.style.opacity = 1; };
}

/* Render post */
async function renderPost(post) {
    const url = post.url || "";
    const wrap = document.createElement("div");
    wrap.className = "post";

    const titleDiv = document.createElement("div");
    titleDiv.className = "post-title";
    titleDiv.textContent = post.title || "";
    wrap.appendChild(titleDiv);

    const box = document.createElement("div");
    box.className = "tile-media";

    /* Galleries */
    if (post.is_gallery && post.media_metadata) {
        const ids = post.gallery_data.items.map(x => x.media_id);
        const sources = ids.map(id => {
            const meta = post.media_metadata[id];
            if (!meta) return null;

            let src = meta.s?.u || meta.s?.mp4 || meta.s?.gif;
            if (!src && meta.p?.length)
                src = meta.p[meta.p.length - 1].u;

            return src ? src.replace(/&amp;/g, "&") : null;
        }).filter(Boolean);

        return renderGallery(box, wrap, sources, post, titleDiv);
    }

    /* Images */
    if (url.match(/\.(jpg|jpeg|png|webp)$/i)) {
        appendMedia(box, wrap, url, "image", post, titleDiv);
        return;
    }

    /* Redgifs */
    if (isRedgifsURL(url)) {
        const mp4 = await fetchRedgifsMP4(url);
        if (mp4) {
            appendMedia(box, wrap, mp4, "gif", post, titleDiv);
            return;
        }
    }

    /* GIF */
    if (isGif(url)) {
        appendMedia(box, wrap, convertGifToMP4(url), "gif", post, titleDiv);
        return;
    }

    /* Reddit video */
    if (post.is_video && post.media?.reddit_video?.fallback_url) {
        appendMedia(box, wrap, post.media.reddit_video.fallback_url, "video", post, titleDiv);
        return;
    }

    /* YouTube */
    if (url.includes("youtu")) {
        const id =
            (url.match(/v=([^&]+)/) || [])[1] ||
            (url.match(/youtu\.be\/([^?]+)/) || [])[1];
        if (id) {
            const iframe = document.createElement("iframe");
            iframe.src = `https://www.youtube.com/embed/${id}`;
            iframe.style.width = "100%";
            iframe.style.height = "100%";
            box.appendChild(iframe);
            wrap.appendChild(box);

            const urlLine = document.createElement("div");
            urlLine.className = "post-url";
            urlLine.innerHTML = `<a href="${url}" target="_blank">${url}</a>`;
            wrap.appendChild(urlLine);

            setupTitleBehavior(titleDiv);
            results.appendChild(wrap);
            return;
        }
    }

    renderTextFallback(post);
}

/* Modal enlarge */
function openLarge(src) {
    const m = document.createElement("div");
    m.className = "large-view";

    let el;
    if (src.endsWith(".mp4")) {
        el = document.createElement("video");
        el.src = src;
        el.controls = true;
        el.autoplay = true;
    } else {
        el = document.createElement("img");
        el.src = src;
    }
    fadeIn(el);
    m.appendChild(el);

    const x = document.createElement("div");
    x.className = "large-view-close";
    x.textContent = "✕";
    x.onclick = () => m.remove();
    m.appendChild(x);

    m.onclick = e => { if (e.target === m) m.remove(); };

    document.body.appendChild(m);
}

/* Media add */
function appendMedia(box, wrap, src, type, post, titleDiv) {
    const el = type === "image" ?
        (() => { const i = document.createElement("img"); i.src = src; fadeIn(i); return i; })() :
        (() => { const v = document.createElement("video"); v.src = src; fadeIn(v); v.autoplay = type==="gif"; v.loop = type==="gif"; v.muted = type==="gif"; return v; })();

    el.style.cursor = "pointer";
    el.onclick = () => openLarge(src);

    box.appendChild(el);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.innerHTML = `<a href="${post.url}" target="_blank">${post.url}</a>`;

    wrap.appendChild(box);
    wrap.appendChild(urlLine);
    setupTitleBehavior(titleDiv);
    results.appendChild(wrap);
}

/* Gallery FIXED */
function renderGallery(box, wrap, list, post, titleDiv) {
    let i = 0;

    const img = document.createElement("img");
    img.src = list[0];
    fadeIn(img);
    img.onclick = () => openLarge(list[i]);

    const left = document.createElement("div");
    left.className = "gallery-arrow-main gallery-arrow-main-left";
    left.textContent = "<";

    const right = document.createElement("div");
    right.className = "gallery-arrow-main gallery-arrow-main-right";
    right.textContent = ">";

    const update = () => {
        img.style.opacity = 0;
        img.src = list[i];
        fadeIn(img);
    };

    left.onclick = e => { e.stopPropagation(); i = (i - 1 + list.length) % list.length; update(); };
    right.onclick = e => { e.stopPropagation(); i = (i + 1) % list.length; update(); };

    box.appendChild(img);
    box.appendChild(left);
    box.appendChild(right);

    const urlLine = document.createElement("div");
    urlLine.className = "post-url";
    urlLine.innerHTML = `<a href="${post.url}" target="_blank">${post.url}</a>`;

    wrap.appendChild(box);
    wrap.appendChild(urlLine);
    setupTitleBehavior(titleDiv);
    results.appendChild(wrap);
}

/* Scroll to top */
scrollTopBtn.onclick = () => window.scrollTo({ top:0, behavior:"smooth" });

/* Infinite scroll */
window.addEventListener("scroll", async () => {
    if (loadingMore || !afterToken || !currentUser) return;
    const near = window.innerHeight + window.scrollY >= document.body.offsetHeight - 1200;
    if (!near) return;

    loadingMore = true;

    try {
        const mode = modeSelect.value;
        let url;

        if (mode === "u") {
            url = `https://api.reddit.com/user/${currentUser}/submitted?raw_json=1&after=${afterToken}`;
        } else {
            url = `https://red.coffeemanhou.workers.dev/?sub=${currentUser}&after=${afterToken}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw 0;

        const data = await res.json();
        afterToken = data.data?.after || null;

        const children = data.data?.children || data.children || [];

        for (const child of children) {
            await renderPost(child.data || child);
        }
    } catch {}
    loadingMore = false;
});

/* Load button */
loadBtn.onclick = async () => {
    results.innerHTML = "";
    currentUser = null;
    afterToken = null;

    const raw = input.value.trim();
    if (!raw) {
        results.innerHTML = "<div class='post'>Invalid input.</div>";
        return;
    }

    const mode = modeSelect.value;
    let url;

    if (mode === "u") {
        currentUser = raw;
        url = `https://api.reddit.com/user/${raw}/submitted?raw_json=1`;
    } else {
        currentUser = raw;
        url = `https://red.coffeemanhou.workers.dev/?sub=${raw}`;
    }

    try {
        const res = await fetch(url);
        if (!res.ok) throw 0;

        const data = await res.json();
        const children =
            data.data?.children ? data.data.children :
            data.children ? data.children : [];
        afterToken = data.data?.after || null;

        for (const child of children) {
            await renderPost(child.data || child);
        }
    } catch {
        results.innerHTML = "<div class='post'>Failed loading posts.</div>";
    }
};

clearBtn.onclick = () => { input.value = ""; results.innerHTML = ""; };
copyBtn.onclick = () => navigator.clipboard.writeText(input.value.trim());
zipBtn.onclick = () => alert("ZIP coming later");
