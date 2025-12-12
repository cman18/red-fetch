/* =========================================================
   app.js — Version v1.1.53
   • Mixed-mode gallery support:
       1. API gallery (fast)
       2. Worker fallback for missing galleries
   • Fixes posts like /gallery/1pea82j
   • No UI changes
   ========================================================= */

/* ---------------------------------------------------------
   DOM references
--------------------------------------------------------- */

const results = document.getElementById("results");
const input = document.getElementById("input");
const loadBtn = document.getElementById("loadBtn");
const clearBtn = document.getElementById("clearBtn");
const copyBtn = document.getElementById("copyBtn");
const zipBtn = document.getElementById("zipBtn");
const colToggleBtn = document.getElementById("colToggleBtn");
const scrollTopBtn = document.getElementById("scrollTopBtn");
const modeSelect = document.getElementById("modeSelect");

let currentUser = null;
let afterToken = null;
let loadingMore = false;
let forcedMode = null;

const seenPostURLs = new Set();

/* ---------------------------------------------------------
   Fallback Worker Endpoint
--------------------------------------------------------- */
const WORKER_GALLERY =
  "https://red.coffeemanhou.workers.dev/gallery?url=";

/* ---------------------------------------------------------
   iPad/iPhone safe tap handler
--------------------------------------------------------- */
function tap(el, fn) {
  el.onclick = fn;
  el.ontouchstart = fn;
  el.ontouchend = fn;
}

/* ---------------------------------------------------------
   Input extractor
--------------------------------------------------------- */
function extractInput(raw) {
  if (!raw) return null;
  raw = raw.trim();

  const mode = modeSelect.value; // "u" or "r"

  if (raw.startsWith("http")) {
    try {
      const url = new URL(raw);

      if (mode === "u") {
        const m = url.pathname.match(/\/user\/([^\/]+)/i);
        return m ? m[1] : null;
      }

      if (mode === "r") {
        const m = url.pathname.match(/\/r\/([^\/]+)/i);
        return m ? m[1] : null;
      }
    } catch {}
  }

  return raw;
}

/* ---------------------------------------------------------
   Column toggle
--------------------------------------------------------- */
function applyColumnMode() {
  results.classList.remove("force-2-cols", "force-3-cols");

  if (forcedMode === "2") {
    results.classList.add("force-2-cols");
    colToggleBtn.textContent = "Columns: 2";
  } else {
    results.classList.add("force-3-cols");
    colToggleBtn.textContent = "Columns: 3";
  }
}

colToggleBtn.onclick = () => {
  forcedMode = forcedMode === "2" ? "3" : "2";
  applyColumnMode();
};

/* ---------------------------------------------------------
   Title expand/collapse
--------------------------------------------------------- */
function setupTitleBehavior(titleDiv) {
  const original = titleDiv.textContent.trim();
  if (!original) return;

  const measure = document.createElement("div");
  measure.style.position = "absolute";
  measure.style.visibility = "hidden";
  measure.style.whiteSpace = "nowrap";
  measure.style.fontSize = window.getComputedStyle(titleDiv).fontSize;
  measure.textContent = original;

  document.body.appendChild(measure);
  const fullW = measure.clientWidth;
  measure.remove();

  if (fullW <= titleDiv.clientWidth) return;

  const arrow = document.createElement("span");
  arrow.className = "title-arrow";
  arrow.textContent = "⌄";

  titleDiv.appendChild(arrow);

  arrow.onclick = (e) => {
    e.stopPropagation();
    const expanded = titleDiv.classList.toggle("full");
    arrow.textContent = expanded ? "⌃" : "⌄";
    titleDiv.style.whiteSpace = expanded ? "normal" : "nowrap";
  };
}

/* ---------------------------------------------------------
   OnlyFans filter
--------------------------------------------------------- */
function shouldSkipOF(post) {
  const t = (post.title || "").toLowerCase();
  const s = (post.selftext || "").toLowerCase();
  const u = (post.url || "").toLowerCase();

  return (
    t.includes("onlyfans") ||
    s.includes("onlyfans") ||
    u.includes("onlyfans.com")
  );
}

/* ---------------------------------------------------------
   Text fallback
--------------------------------------------------------- */
function renderTextFallback(post) {
  const wrap = document.createElement("div");
  wrap.className = "post";

  const titleDiv = document.createElement("div");
  titleDiv.className = "post-title";
  titleDiv.textContent = post.title || "";
  wrap.appendChild(titleDiv);

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

  setupTitleBehavior(titleDiv);
  results.appendChild(wrap);
}

/* ---------------------------------------------------------
   Image / Video helpers
--------------------------------------------------------- */
function createImage(src) {
  const el = document.createElement("img");
  el.src = src;
  return el;
}

function createVideo(src, auto) {
  const v = document.createElement("video");
  v.src = src;
  v.autoplay = auto;
  v.loop = auto;
  v.muted = auto;
  v.controls = !auto;
  return v;
}

/* ---------------------------------------------------------
   Large View
--------------------------------------------------------- */
function openLarge(src) {
  const modal = document.createElement("div");
  modal.className = "large-view";

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

  modal.appendChild(el);

  const close = document.createElement("div");
  close.className = "large-view-close";
  close.textContent = "✕";
  close.onclick = () => modal.remove();
  modal.appendChild(close);

  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };

  document.body.appendChild(modal);
}

/* ---------------------------------------------------------
   appendMedia
--------------------------------------------------------- */
function appendMedia(box, wrap, src, type, post, titleDiv) {
  const el =
    type === "image" ? createImage(src) : createVideo(src, type === "gif");

  el.style.cursor = "pointer";
  tap(el, () => openLarge(src));

  box.appendChild(el);

  const urlLine = document.createElement("div");
  urlLine.className = "post-url";
  urlLine.innerHTML = `<a href="${post.url}" target="_blank">${post.url}</a>`;

  wrap.appendChild(box);
  wrap.appendChild(urlLine);

  setupTitleBehavior(titleDiv);
  results.appendChild(wrap);
}

/* ---------------------------------------------------------
   RENDER GALLERY (API OR FALLBACK)
--------------------------------------------------------- */

async function buildGallerySources(post) {
  const sources = [];

  // -----------------------------
  // 1. API MODE
  // -----------------------------
  if (post.is_gallery && post.media_metadata && post.gallery_data) {
    const ids = post.gallery_data.items.map((i) => i.media_id);

    for (const id of ids) {
      const meta = post.media_metadata[id];
      if (!meta) continue;

      let src = null;

      if (meta.s) {
        if (meta.s.u) src = meta.s.u;
        if (meta.s.gif) src = meta.s.gif;
        if (meta.s.mp4) src = meta.s.mp4;
      }

      if (!src && meta.p?.length) {
        src = meta.p[meta.p.length - 1].u;
      }

      if (src) {
        sources.push(src.replace(/&amp;/g, "&"));
      }
    }

    if (sources.length) return sources;
  }

  // -----------------------------
  // 2. FALLBACK: CLOUDFLARE SCRAPER
  // -----------------------------
  try {
    const workerURL = WORKER_GALLERY + encodeURIComponent(post.url);

    const res = await fetch(workerURL, {
      headers: { "Cache-Control": "no-cache" }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.images?.length) {
        return data.images.map((x) => x.replace(/&amp;/g, "&"));
      }
    }
  } catch {}

  return [];
}

/* ---------------------------------------------------------
   Render gallery card
--------------------------------------------------------- */
function renderGallery(box, wrap, sources, post, titleDiv) {
  let idx = 0;

  const img = document.createElement("img");
  img.src = sources[idx];
  img.style.cursor = "pointer";

  tap(img, () => openLarge(sources[idx]));

  const left = document.createElement("div");
  left.className = "gallery-arrow-main gallery-arrow-main-left";
  left.textContent = "<";

  const right = document.createElement("div");
  right.className = "gallery-arrow-main gallery-arrow-main-right";
  right.textContent = ">";

  const update = () => {
    img.src = sources[idx];
  };

  left.onclick = (e) => {
    e.stopPropagation();
    idx = (idx - 1 + sources.length) % sources.length;
    update();
  };

  right.onclick = (e) => {
    e.stopPropagation();
    idx = (idx + 1) % sources.length;
    update();
  };

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

/* ---------------------------------------------------------
   Main renderer
--------------------------------------------------------- */

async function renderPost(post) {
  if (shouldSkipOF(post)) return;
  if (seenPostURLs.has(post.url)) return;
  seenPostURLs.add(post.url);

  const wrap = document.createElement("div");
  wrap.className = "post";

  const titleDiv = document.createElement("div");
  titleDiv.className = "post-title";
  titleDiv.textContent = post.title || "";
  wrap.appendChild(titleDiv);

  const box = document.createElement("div");
  box.className = "tile-media";

  const url = post.url || "";

  // -----------------------------
  // GALLERY (API + FALLBACK)
  // -----------------------------
  if (url.includes("/gallery/") || post.is_gallery) {
    const imgs = await buildGallerySources(post);
    if (imgs?.length) {
      renderGallery(box, wrap, imgs, post, titleDiv);
      return;
    }
  }

  // -----------------------------
  // IMAGE
  // -----------------------------
  if (url.match(/\.(jpg|jpeg|png|webp)$/i)) {
    appendMedia(box, wrap, url, "image", post, titleDiv);
    return;
  }

  // -----------------------------
  // REDDIT VIDEO
  // -----------------------------
  if (post.is_video && post.media?.reddit_video?.fallback_url) {
    appendMedia(
      box,
      wrap,
      post.media.reddit_video.fallback_url,
      "video",
      post,
      titleDiv
    );
    return;
  }

  renderTextFallback(post);
}

/* ---------------------------------------------------------
   Scroll-to-top
--------------------------------------------------------- */
scrollTopBtn.onclick = () =>
  window.scrollTo({ top: 0, behavior: "smooth" });

/* ---------------------------------------------------------
   Infinite scroll
--------------------------------------------------------- */
async function loadMore() {
  if (loadingMore || !afterToken || !currentUser) return;

  loadingMore = true;

  try {
    const mode = modeSelect.value;

    const url =
      mode === "u"
        ? `https://api.reddit.com/user/${currentUser}/submitted?raw_json=1&after=${afterToken}`
        : `https://api.reddit.com/r/${currentUser}/new?raw_json=1&after=${afterToken}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error();

    const data = await res.json();
    afterToken = data.data.after;

    for (const child of data.data.children) {
      await renderPost(child.data);
    }
  } catch {}

  loadingMore = false;
}

window.addEventListener("scroll", async () => {
  const nearBottom =
    window.innerHeight + window.scrollY >=
    document.body.offsetHeight - 800;

  if (nearBottom) await loadMore();
});

/* ---------------------------------------------------------
   Load button
--------------------------------------------------------- */
loadBtn.onclick = async () => {
  results.innerHTML = "";
  seenPostURLs.clear();
  afterToken = null;
  currentUser = null;

  const raw = input.value.trim();
  const extracted = extractInput(raw);

  if (!extracted) {
    results.innerHTML = "<div class='post'>Invalid input.</div>";
    return;
  }

  currentUser = extracted;

  try {
    const mode = modeSelect.value;

    const url =
      mode === "u"
        ? `https://api.reddit.com/user/${currentUser}/submitted?raw_json=1`
        : `https://api.reddit.com/r/${currentUser}/new?raw_json=1`;

    const res = await fetch(url);
    if (!res.ok) throw new Error();

    const data = await res.json();
    afterToken = data.data.after;

    for (const child of data.data.children) {
      await renderPost(child.data);
    }
  } catch {
    results.innerHTML = "<div class='post'>Failed loading posts</div>";
  }
};

/* ---------------------------------------------------------
   Buttons
--------------------------------------------------------- */

clearBtn.onclick = () => {
  input.value = "";
  results.innerHTML = "";
  seenPostURLs.clear();
  afterToken = null;
};

copyBtn.onclick = () =>
  navigator.clipboard.writeText(input.value.trim());

zipBtn.onclick = () =>
  alert("ZIP downloads coming later");

/* END v1.1.53 */
