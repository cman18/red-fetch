const form = document.getElementById('user-form');
const input = document.getElementById('username');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const loadBtn = document.getElementById('load-btn');
const clearBtn = document.getElementById('clear-btn');
const sentinel = document.getElementById('sentinel');
const loadingMoreEl = document.getElementById('loading-more');
const filterImagesEl = document.getElementById('filter-images');
const filterVideosEl = document.getElementById('filter-videos');
const filterOtherEl = document.getElementById('filter-other');
const downloadZipBtn = document.getElementById('download-zip');

const lightboxEl = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxMeta = document.getElementById('lightbox-meta');
const lightboxCloseBtn = document.getElementById('lightbox-close');

const scrollTopBtn = document.getElementById('scroll-top');

let state = {
  username: '',
  after: null,
  loading: false,
  posts: []
};

let observer = null;

form.addEventListener('submit', event => {
  event.preventDefault();
  const raw = (input.value || '').trim();
  if (!raw) {
    statusEl.textContent = 'Please paste a Reddit profile URL or enter a username.';
    return;
  }
  const username = normalizeToUsername(raw);
  if (!username) {
    statusEl.textContent = 'Could not extract a username from that input.';
    return;
  }
  startNewUser(username);
});

clearBtn.addEventListener('click', () => {
  input.value = '';
  state = { username: '', after: null, loading: false, posts: [] };
  resultsEl.innerHTML = '';
  statusEl.textContent = 'Idle. Paste a profile URL or enter a username then press Load posts.';
  downloadZipBtn.disabled = true;
  if (observer) observer.disconnect();
});

for (const el of [filterImagesEl, filterVideosEl, filterOtherEl]) {
  el.addEventListener('change', () => {
    renderAllCards();
  });
}

downloadZipBtn.addEventListener('click', () => {
  if (!state.posts.length) return;
  buildZipFromCurrentPosts().catch(err => {
    console.error(err);
    statusEl.textContent = 'Error building ZIP. Some media hosts may be blocking download.';
  });
});

window.addEventListener('scroll', () => {
  const show = window.scrollY > 400;
  if (show) scrollTopBtn.classList.add('visible');
  else scrollTopBtn.classList.remove('visible');
});

scrollTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

function setupInfiniteScroll() {
  if (observer) {
    observer.disconnect();
  }
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        maybeLoadMore();
      }
    }
  }, { rootMargin: '200px 0px 400px 0px' });
  observer.observe(sentinel);
}

function normalizeToUsername(raw) {
  let value = raw.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) {
    try {
      const u = new URL(value);
      const path = u.pathname;
      const m = path.match(/\/(u|user)\/([^\/]+)/i);
      if (m && m[2]) {
        return m[2];
      }
    } catch (e) {
      console.warn('Failed to parse URL', e);
    }
  }
  value = value.replace(/^https?:\/\/www\.reddit\.com\//i, '');
  value = value.replace(/^u\//i, '').replace(/^user\//i, '');
  const first = value.split(/[/?#]/)[0];
  return first || '';
}

function startNewUser(username) {
  state = { username, after: null, loading: false, posts: [] };
  resultsEl.innerHTML = '';
  statusEl.textContent = `Loading posts for u/${state.username}…`;
  downloadZipBtn.disabled = true;
  fetchNextPage(true);
  setupInfiniteScroll();
}

async function maybeLoadMore() {
  if (!state.username || state.loading || !state.after) return;
  loadingMoreEl.hidden = false;
  await fetchNextPage(false);
  loadingMoreEl.hidden = true;
}

async function fetchNextPage(replacing) {
  if (state.loading) return;
  state.loading = true;
  try {
    const params = new URLSearchParams({ raw_json: '1', limit: '50' });
    if (state.after) params.set('after', state.after);
    const url = `https://www.reddit.com/user/${encodeURIComponent(state.username)}/submitted.json?` + params.toString();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const children = json?.data?.children || [];
    state.after = json?.data?.after || null;
    const newPosts = children.map(c => c.data);
    if (replacing) {
      state.posts = newPosts;
    } else {
      state.posts = state.posts.concat(newPosts);
    }
    if (!state.posts.length) {
      statusEl.textContent = `No posts found for u/${state.username}.`;
      downloadZipBtn.disabled = true;
      return;
    }
    statusEl.textContent = `Loaded ${state.posts.length} posts for u/${state.username}.` + (state.after ? ' Scroll to load more.' : ' End of results.');
    renderNewCards(newPosts);
    downloadZipBtn.disabled = false;
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error loading posts. Reddit may be blocking the request or the user may not exist.';
  } finally {
    state.loading = false;
  }
}

function mediaKind(post) {
  if (post.is_gallery || post.gallery_data) return 'image';
  if (post.is_video) return 'video';
  if (post.post_hint === 'image') return 'image';
  if (post.post_hint === 'hosted:video') return 'video';
  const preview = post.preview?.images?.[0]?.source?.url;
  if (preview) return 'image';
  return 'other';
}

function passesFilter(post) {
  const kind = mediaKind(post);
  if (kind === 'image') return filterImagesEl.checked;
  if (kind === 'video') return filterVideosEl.checked;
  return filterOtherEl.checked;
}

function renderNewCards(posts) {
  const frag = document.createDocumentFragment();
  for (const post of posts) {
    if (!passesFilter(post)) continue;
    const card = buildCard(post);
    frag.appendChild(card);
  }
  resultsEl.appendChild(frag);
}

function renderAllCards() {
  resultsEl.innerHTML = '';
  renderNewCards(state.posts);
}

function buildCard(post) {
  const article = document.createElement('article');
  article.className = 'card';
  article.dataset.permalink = post.permalink || '';
  article.dataset.postId = post.id || '';
  const mediaBits = buildMediaHtml(post);
  article.innerHTML = `
    <header class="card-header">
      <a href="https://www.reddit.com${post.permalink}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(post.title || '[no title]')}
      </a>
    </header>
    <div class="card-media" data-full="${mediaBits.fullImageUrl || ''}">
      ${mediaBits.mediaHtml}
    </div>
    <div class="card-body">
      <span class="badge">r/${escapeHtml(post.subreddit || '')}</span>
      <span class="badge">Score ${post.score ?? 0}</span>
    </div>
  `;
  article.addEventListener('click', evt => {
    if (evt.target.closest('.card-header a')) return;
    if (evt.target.closest('.gallery-arrow') || evt.target.closest('.gallery-track')) return;
    const mediaEl = article.querySelector('.card-media');
    const full = mediaEl?.dataset?.full || '';
    const title = post.title || '';
    const subreddit = post.subreddit || '';
    openLightbox(full, title, subreddit);
  });
  return article;
}

function buildMediaHtml(post) {
  const safe = url => url.replace(/&amp;/g, '&');
  let label = '';
  let html = '';
  let fullImageUrl = '';

  const galleryItems = post.gallery_data?.items;
  const mediaMeta = post.media_metadata;
  if ((post.is_gallery || galleryItems) && mediaMeta && Array.isArray(galleryItems) && galleryItems.length) {
    const urls = [];
    for (const item of galleryItems) {
      const id = item.media_id;
      const meta = mediaMeta[id];
      const u = meta?.s?.u || meta?.s?.gif || meta?.s?.mp4;
      if (u) {
        urls.push(safe(u));
      }
    }
    if (urls.length) {
      label = `Gallery (${urls.length})`;
      fullImageUrl = urls[0];
      const imgsHtml = urls.map(u => `<img class="gallery-img" src="${u}" data-full="${u}" alt="">`).join('');
      html = `
        <div class="gallery" data-count="${urls.length}">
          <button type="button" class="gallery-arrow gallery-prev" aria-label="Previous image">‹</button>
          <div class="gallery-track">
            ${imgsHtml}
          </div>
          <button type="button" class="gallery-arrow gallery-next" aria-label="Next image">›</button>
          <span class="tag">${label}</span>
        </div>
      `;
      return { mediaHtml: html, fullImageUrl };
    }
  }

  if (post.is_video && post.media?.reddit_video?.fallback_url) {
    const src = safe(post.media.reddit_video.fallback_url);
    label = 'Video';
    html = `<video controls playsinline muted preload="metadata" src="${src}"></video>`;
    return { mediaHtml: `${html}<span class="tag">${label}</span>`, fullImageUrl: '' };
  }

  if (post.post_hint === 'image' && post.url) {
    const src = safe(post.url);
    label = 'Image';
    fullImageUrl = src;
    html = `<img src="${src}" alt="">`;
    return { mediaHtml: `${html}<span class="tag">${label}</span>`, fullImageUrl };
  }

  const preview = post.preview?.images?.[0];
  if (preview?.source?.url) {
    fullImageUrl = safe(preview.source.url);
    label = 'Image';
    const resolutions = preview.resolutions || [];
    const mid = resolutions[Math.min(2, Math.max(0, resolutions.length - 1))];
    const thumbUrl = mid ? safe(mid.url) : fullImageUrl;
    html = `<img src="${thumbUrl}" alt="">`;
    return { mediaHtml: `${html}<span class="tag">${label}</span>`, fullImageUrl };
  }

  if (post.thumbnail && post.thumbnail.startsWith('http')) {
    const src = safe(post.thumbnail);
    label = 'Thumb';
    fullImageUrl = safe(post.url || src);
    html = `<img src="${src}" alt="">`;
    return { mediaHtml: `${html}<span class="tag">${label}</span>`, fullImageUrl };
  }

  html = `<div class="no-media">No media preview available</div>`;
  return { mediaHtml: html, fullImageUrl: '' };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function openLightbox(url, title, subreddit) {
  if (!url) return;
  lightboxImg.src = url;
  lightboxImg.classList.remove('zoomed');
  lightboxMeta.textContent = title ? `${title} – r/${subreddit}` : `r/${subreddit}`;
  lightboxEl.hidden = false;
}

function closeLightbox() {
  lightboxEl.hidden = true;
  lightboxImg.src = '';
  lightboxImg.classList.remove('zoomed');
}

lightboxCloseBtn.addEventListener('click', closeLightbox);
lightboxEl.addEventListener('click', evt => {
  if (evt.target === lightboxEl || evt.target === document.querySelector('.lightbox-backdrop')) {
    closeLightbox();
  }
});
lightboxImg.addEventListener('click', () => {
  lightboxImg.classList.toggle('zoomed');
});

resultsEl.addEventListener('click', evt => {
  const arrowPrev = evt.target.closest('.gallery-prev');
  const arrowNext = evt.target.closest('.gallery-next');
  const img = evt.target.closest('.gallery-img');

  if (arrowPrev || arrowNext) {
    evt.stopPropagation();
    const gallery = evt.target.closest('.gallery');
    if (!gallery) return;
    const track = gallery.querySelector('.gallery-track');
    if (!track) return;
    const delta = track.clientWidth * (arrowPrev ? -1 : 1);
    track.scrollBy({ left: delta, behavior: 'smooth' });
    return;
  }

  if (img) {
    evt.stopPropagation();
    const full = img.dataset.full || img.src;
    const article = img.closest('.card');
    const postId = article?.dataset.postId;
    const post = state.posts.find(p => p.id === postId) || {};
    const title = post.title || '';
    const subreddit = post.subreddit || '';
    openLightbox(full, title, subreddit);
  }
});

async function buildZipFromCurrentPosts() {
  if (typeof JSZip === 'undefined') {
    statusEl.textContent = 'ZIP support not available. JSZip failed to load.';
    return;
  }
  const zip = new JSZip();
  const mediaPosts = state.posts.filter(p => mediaKind(p) !== 'other');
  if (!mediaPosts.length) {
    statusEl.textContent = 'No media posts to include in ZIP.';
    return;
  }

  statusEl.textContent = `Preparing ZIP with up to ${mediaPosts.length} items… this runs in your browser only.`;
  downloadZipBtn.disabled = true;

  let added = 0;
  for (const post of mediaPosts) {
    const mediaItems = collectAllMediaUrls(post);
    for (const item of mediaItems) {
      const { url, filename } = item;
      if (!url || !filename) continue;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const blob = await res.blob();
        const arrayBuffer = await blob.arrayBuffer();
        zip.file(filename, arrayBuffer);
        added += 1;
        if (added % 5 === 0) {
          statusEl.textContent = `Added ${added} items to ZIP so far…`;
        }
      } catch (err) {
        console.warn('Skipping media due to error', err);
      }
    }
  }

  if (!added) {
    statusEl.textContent = 'Could not fetch any media. Hosts may be blocking cross origin downloads.';
    downloadZipBtn.disabled = false;
    return;
  }

  statusEl.textContent = `Finalizing ZIP with ${added} items…`;
  const content = await zip.generateAsync({ type: 'blob' });
  const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0,19);
  const fileName = `reddit_${state.username || 'user'}_${ts}.zip`;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  statusEl.textContent = `ZIP download started with ${added} items.`;
  downloadZipBtn.disabled = false;
}

function collectAllMediaUrls(post) {
  const safe = url => url.replace(/&amp;/g, '&');
  const items = [];

  const galleryItems = post.gallery_data?.items;
  const mediaMeta = post.media_metadata;
  if ((post.is_gallery || galleryItems) && mediaMeta && Array.isArray(galleryItems) && galleryItems.length) {
    let i = 1;
    for (const item of galleryItems) {
      const id = item.media_id;
      const meta = mediaMeta[id];
      const u = meta?.s?.u || meta?.s?.gif || meta?.s?.mp4;
      if (u) {
        const url = safe(u);
        const ext = inferExt(url, 'jpg');
        const base = buildSlug(post, i);
        items.push({ url, filename: `${base}.${ext}` });
        i += 1;
      }
    }
    if (items.length) return items;
  }

  const single = bestMediaUrlAndName(post);
  if (single.url && single.filename) {
    items.push(single);
  }
  return items;
}

function bestMediaUrlAndName(post) {
  const safe = url => url.replace(/&amp;/g, '&');
  let url = '';
  let ext = 'bin';

  if (post.is_video && post.media?.reddit_video?.fallback_url) {
    url = safe(post.media.reddit_video.fallback_url);
    ext = 'mp4';
  } else if (post.post_hint === 'image' && post.url) {
    url = safe(post.url);
    ext = inferExt(url, 'jpg');
  } else if (post.preview?.images?.[0]?.source?.url) {
    url = safe(post.preview.images[0].source.url);
    ext = inferExt(url, 'jpg');
  } else if (post.thumbnail && post.thumbnail.startsWith('http')) {
    url = safe(post.thumbnail);
    ext = inferExt(url, 'jpg');
  } else {
    return { url: '', filename: '' };
  }

  const base = buildSlug(post, null);
  return { url, filename: `${base}.${ext}` };
}

function buildSlug(post, index) {
  const id = post.id || 'post';
  const slug = (post.title || 'post')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const base = slug || id;
  if (index != null) return `${base}-${index}`;
  return base || id;
}

function inferExt(url, fallback) {
  const u = url.split('?')[0];
  const m = u.match(/\.([a-z0-9]{2,4})$/i);
  if (m) return m[1].toLowerCase();
  return fallback;
}
