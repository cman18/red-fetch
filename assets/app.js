let state = {
  after: null,
  mode: "u",
  username: "",
  filter: "all",
  loading: false
};

function isVideo(post) {
  return post.is_video ||
         post.url.endsWith(".mp4") ||
         post.url.endsWith(".gifv") ||
         post.url.endsWith(".gif");
}

function videoUrl(post) {
  if (post.is_video && post.media && post.media.reddit_video && post.media.reddit_video.fallback_url)
    return post.media.reddit_video.fallback_url;
  return post.url.replace(".gifv", ".mp4");
}

/* mode select */
document.getElementById("modeSelect").addEventListener("change", e => {
  state.mode = e.target.value;
});

/* load btn */
document.getElementById("load-btn").addEventListener("click", () => {

  const raw = document.getElementById("username").value.trim();
  if (!raw) {
    document.getElementById("status").textContent = "Enter a username or subreddit first";
    return;
  }

  /* URL normalization */
  let input = raw;

  if (input.includes("reddit.com")) {
    let m1 = input.match(/\/user\/([^\/]+)/i); if (m1) input = m1[1];
    let m2 = input.match(/\/u\/([^\/]+)/i); if (m2) input = m2[1];
    let m3 = input.match(/\/r\/([^\/]+)/i); if (m3) input = m3[1];
  }

  input = input.replace(/^u\//i, "")
               .replace(/^user\//i, "")
               .replace(/^r\//i, "");

  state.username = input;
  state.after = null;

  loadPage();
});

/* clear */
document.getElementById("clear-btn").addEventListener("click", () => {
  document.getElementById("posts").innerHTML = "";
  document.getElementById("status").textContent = "Cleared";
});

/* build correct reddit api url */
function apiURL() {
  if (!state.username) return null;

  if (state.mode === "u") {
    return "https://www.reddit.com/user/" +
      encodeURIComponent(state.username) +
      "/submitted.json?limit=50" +
      (state.after ? "&after=" + state.after : "");
  }

  return "https://www.reddit.com/r/" +
    encodeURIComponent(state.username) +
    "/hot.json?limit=50" +
    (state.after ? "&after=" + state.after : "");
}

/* load page */
async function loadPage() {
  if (state.loading) return;
  state.loading = true;

  const url = apiURL();
  if (!url) {
    document.getElementById("status").textContent = "Bad input";
    state.loading = false;
    return;
  }

  document.getElementById("status").textContent = "Loading";

  const res = await fetch(url).catch(() => null);
  if (!res) {
    document.getElementById("status").textContent = "Network error";
    state.loading = false;
    return;
  }

  const json = await res.json().catch(() => null);
  if (!json || !json.data) {
    document.getElementById("status").textContent = "Error loading posts";
    state.loading = false;
    return;
  }

  state.after = json.data.after;
  render(json.data.children);

  document.getElementById("status").textContent = "Loaded " +
    json.data.children.length +
    " posts  Version 007e";

  state.loading = false;
}

/* render posts */
function render(list) {
  const out = document.getElementById("posts");

  list.forEach(p => {
    const d = p.data;
    const el = document.createElement("div");
    el.className = "post";

    let html = "<div class='title'>" + d.title + "</div>";

    if (isVideo(d)) {
      const v = videoUrl(d);
      html += "<video class='thumb' src='" + v + "' muted loop></video>";
    } else if (d.url.match(/\.(jpg|jpeg|png)$/i)) {
      html += "<img class='thumb' src='" + d.url + "'>";
    }

    el.innerHTML = html;
    out.appendChild(el);
  });
}

/* video modal */
document.addEventListener("click", e => {
  if (e.target.classList.contains("thumb")) {
    const m = document.getElementById("videoModal");
    const p = document.getElementById("modalPlayer");
    p.src = e.target.src;
    m.classList.add("show");
  }
});

document.getElementById("videoModal").addEventListener("click", () => {
  document.getElementById("videoModal").classList.remove("show");
});
