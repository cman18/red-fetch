async function fetchJSON(url) {
    const r = await fetch(url);
    return r.json();
}

function extractUser(input) {
    input = input.trim();

    if (input.includes("/user/"))
        return input.split("/user/")[1].split("/")[0];

    if (input.includes("/u/"))
        return input.split("/u/")[1].split("/")[0];

    if (/^[A-Za-z0-9_-]+$/.test(input))
        return input;

    return null;
}

document.getElementById("loadBtn").onclick = async () => {
    let val = document.getElementById("userInput").value.trim();
    let mode = document.getElementById("modeSelect").value;
    let user = extractUser(val);

    if (!user) {
        alert("Enter a valid ID or profile URL");
        return;
    }

    document.getElementById("status").textContent = "Loading...";

    let url =
        mode === "u"
            ? `https://www.reddit.com/user/${user}/submitted.json`
            : `https://www.reddit.com/r/${user}.json`;

    let data = await fetchJSON(url);
    let posts = data.data.children;

    let content = document.getElementById("content");
    content.innerHTML = "";

    for (let p of posts) {
        let post = p.data;
        let card = document.createElement("div");
        card.className = "post-card";

        let media = "";

        if (post.url.endsWith(".jpg") || post.url.endsWith(".png")) {
            media = `<img src="${post.url}">`;
        } else if (post.is_video && post.media?.reddit_video) {
            media = `<video controls src="${post.media.reddit_video.fallback_url}"></video>`;
        }

        card.innerHTML = `
            <div class="post-title">${post.title}</div>
            <div class="media-container">${media}</div>
        `;

        content.appendChild(card);
    }

    document.getElementById("status").textContent = "Done.";
};

document.getElementById("clearBtn").onclick = () => {
    document.getElementById("userInput").value = "";
    document.getElementById("content").innerHTML = "";
    document.getElementById("status").textContent = "Idle.";
};
