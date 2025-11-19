function extractUsername(input) {
    input = input.trim();

    // Simple username
    if (/^[A-Za-z0-9-_]+$/.test(input)) return input;

    // /u/username/s/xxxx
    let m = input.match(/\/u\/([A-Za-z0-9_-]+)/i);
    if (m) return m[1];

    // reddit.com/user/username
    m = input.match(/\/user\/([A-Za-z0-9_-]+)/i);
    if (m) return m[1];

    return null;
}

async function loadPosts(reset = true) {
    const input = document.getElementById('username');
    const statusEl = document.getElementById('status');
    const resultsEl = document.getElementById('results');

    const usernameRaw = input.value.trim();

    if (reset) resultsEl.innerHTML = "";

    if (!usernameRaw) {
        statusEl.textContent = "No username or URL provided.";
        return;
    }

    let uname = extractUsername(usernameRaw);
    if (!uname) {
        statusEl.textContent = "Unable to parse username from URL.";
        return;
    }

    statusEl.textContent = "Loading…";

    const url = `https://www.reddit.com/user/${uname}/submitted.json`;

    console.log("DEBUG REQUEST URL:", url);

    try {
        const r = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0"
            }
        });

        console.log("DEBUG FETCH RESPONSE:", r);

        if (!r.ok) {
            const text = await r.text();
            console.error("DEBUG FULL ERROR RESPONSE:", text);

            statusEl.textContent =
                `Reddit error: HTTP ${r.status}\n` +
                `Message: ${text.slice(0, 300)}\nCheck console for more.`;

            return;
        }

        const data = await r.json();
        console.log("DEBUG PARSED JSON:", data);

        if (!data?.data?.children) {
            statusEl.textContent = "Reddit returned no posts.";
            return;
        }

        statusEl.textContent = "";
        renderPosts(data.data.children);

    } catch (err) {
        console.error("DEBUG JS ERROR:", err);

        statusEl.textContent =
            "Javascript fetch error:\n" +
            (err.message || err.toString()) +
            "\n(Check console for full log.)";
    }
}

function renderPosts(posts) {
    const resultsEl = document.getElementById('results');

    posts.forEach(item => {
        const post = item.data;

        const box = document.createElement("div");
        box.className = "post";

        box.innerHTML = `<div class="title">${post.title || "(no title)"}</div>`;

        if (post.is_video && post.media?.reddit_video?.fallback_url) {
            const v = document.createElement("video");
            v.controls = true;
            v.src = post.media.reddit_video.fallback_url;
            v.onclick = () => v.requestFullscreen();
            box.appendChild(v);
        } else if (post.url && /\.(jpg|jpeg|png|gif)$/i.test(post.url)) {
            const img = document.createElement("img");
            img.src = post.url;
            img.onclick = () => img.requestFullscreen();
            box.appendChild(img);
        }

        resultsEl.appendChild(box);
    });
}

function copyURL() {
    const v = document.getElementById("username").value;
    navigator.clipboard.writeText(v);
}

function clearAll() {
    document.getElementById("username").value = "";
    document.getElementById("results").innerHTML = "";
    document.getElementById("status").textContent = "";
}

function downloadZIP() {
    alert("ZIP download coming in next update.");
}
