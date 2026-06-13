# Red Fetch — Session Notes

## What This App Does

Red Fetch is a Reddit/Coomer.st media browser. Users enter a Reddit username (`u/`) or subreddit (`r/`) and the app fetches and displays posts as a media grid — images, videos, and galleries. Cards open into a fullscreen viewer. Supports favorites, search history, column count, ZIP download, and swipe navigation on mobile. Also supports Coomer.st (OnlyFans/Fansly) via a site toggle.

**Live site:** https://cman18.github.io/red-fetch/
**Deployment repo:** https://github.com/cman18/red-fetch
**Worker:** https://red.coffeemanhou.workers.dev/
**Bundle version:** v4.8.4
**Worker version:** v4.8.4 (now kept in sync with bundle — bump both together on any change)
**Git user:** cman18

---

## Repo Structure

| Path | Purpose |
|------|---------|
| `Redscroller_gh/` | Dev working directory — all patches applied here |
| `red-fetch-main/assets/index-DVk7c3Hp.js` | Minified JS bundle — source of truth for all edits |
| `red-fetch-main/assets/index-BbDCGD1s.css` | Pre-compiled Tailwind CSS (read-only — see warning below) |
| `red-fetch-main/index.html` | Entry point (`crossorigin` attribute required for GitHub Pages) |
| `patches/` | All patch scripts — run with `node patches/_patch_xxx.js` |
| `patches/rebuild.js` | Applies all patches in order from a clean v4.5.3 bundle |
| `patches/_patch_bump_version.js` | Bumps Y0/V0/X0 in bundle + worker.js comment |
| `worker.js` | Cloudflare Worker source |
| `_rfpush/` | Deployment git repo → `github.com/cman18/red-fetch.git` |

> The original React/Vite source was deleted in commit `841a5c3`. Only compiled output exists.

---

## Deployment Workflow

1. Apply patches to `red-fetch-main/assets/index-DVk7c3Hp.js`
2. Bump version: `node patches/_patch_bump_version.js 4.x.x`
3. Copy bundle: `cp red-fetch-main/assets/index-DVk7c3Hp.js _rfpush/assets/`
4. Commit & push from `_rfpush/`:
   ```
   git add assets/index-DVk7c3Hp.js
   git commit -m "vX.X.X — description"
   git push origin main
   ```
5. GitHub Pages auto-deploys in ~1 min

---

## CRITICAL: Tailwind CSS Pre-compilation

The CSS file is pre-compiled — **only classes present in the original source are available**. Adding new Tailwind class names in patches will silently do nothing. Always use inline `style={{}}` props for new visual behavior.

**Available classes of note:**
- Height: `h-1`, `h-12`, `h-16`, `h-48`, `h-full`
- Width: `w-12`, `w-16`, `w-48`, `w-full`
- Border colors: `border-zinc-700` only (no `border-cyan-*`)
- Object fit: `object-contain` only (no `object-cover`)
- Overflow: `overflow-hidden` only (no `overflow-x-auto`)
- Items alignment: `items-center` only (no `items-start`)

---

## Stack

- React 19.2.1 (compiled, minified)
- Vite (bundler — no longer available, source deleted)
- Tailwind CSS (pre-compiled utility classes)
- Cloudflare Worker (API proxy to Reddit + Coomer)
- GitHub Pages (hosting)

---

## Key Variables in Minified JS

### Version Constants (always sync together)
```
V0  // shown in UI header
Y0  // hook version
X0  // viewer version
```
Use `node patches/_patch_bump_version.js X.X.X` to update all three + worker.js.

### LocalStorage Keys
```
Rf = "redfetch_search_history"   // recent searches {value, type, site, service}
cu = "redfetch_favorites"        // starred items
Jd = 5                           // max history items
```

### Main Component: K0
| Variable | Role |
|----------|------|
| `it, pt` | query string, setQuery |
| `_, b` | queryType ("user"/"subreddit"), setQueryType |
| `U` | posts array |
| `y` | fetchPosts() |
| `p, O` | search history array, setHistory |
| `R, H` | favorites array, setFavorites |
| `h, w` | selected post (fullscreen), setSelectedPost |
| `A, C` | fullscreen image index, setIndex |
| `s` | media sources for current fullscreen post |
| `z` | current media URL (`s[A]`) |
| `d, E` | column count (1/2/3), setColumns |
| `f` | whether current query is a favorite |
| `j, I` | ZIP status string, setZipStatus |
| `rfNew, rfClearNew` | new-post count, clear-new fn |
| `rfSite, rfSetSite` | "reddit" / "coomer" site toggle |
| `rfSvc, rfSetSvc` | coomer service (onlyfans/fansly) |
| `rfLinks` | detected platform profile links |
| `rfClearPosts` | clears posts array + cursor |

### Card Media Component: Q0
| Variable | Role |
|----------|------|
| `g` | array of all media URLs for this post (from `Id(it)`) |
| `U` | current gallery index |
| `y` | setGalleryIndex |
| `_` | isVisible (intersection observer lazy load) |

### Helper Functions
| Function | Role |
|----------|------|
| `Id(post)` | Extracts array of media URLs from a post (handles galleries, videos, images) |
| `G0()` | Custom hook — fetches posts, manages query state, infinite scroll |
| `Vn(input, type)` | Normalizes Reddit user/subreddit input (handles full URLs, u/ prefix, etc.) |
| `tt` | Fullscreen Previous handler (wraps to last) |
| `$` | Fullscreen Next handler (wraps to first) |
| `zt, wt` | Touch start/end for swipe navigation |

---

## Component/DOM Structure

```
K0 (main app)
├── Header: "Red Fetch" + version badge (V0)
├── New-posts banner (cyan) — shown when rfNew > 0
├── "Also on:" platform links banner — shown for Reddit user profiles
├── Favorites row (yellow) — R.map()
├── Search history row (gray) — p.map() + "Clear history" button
├── Controls: site toggle, type select, input, Copy URL button
├── Actions: Load Posts, ★ favorite, Clear, Columns, Example, Download ZIP
├── CSS Columns container (v4.6.5+): columnCount=d, columnGap=1.25rem
│   └── Card (per post) — breakInside:avoid, display:inline-block, width:100%
│       ├── Title bar (truncated)
│       │   └── Cyan borderColor inline style if rfIdx < rfNew (new post)
│       ├── div.overflow-hidden.relative → Q0 (media component)
│       │   ├── Loading: div.w-full.aspect-[4/5].animate-pulse
│       │   ├── Error: div.w-full.aspect-[4/5].bg-red-900
│       │   └── Media: div.relative.w-full
│       │       ├── img (object-contain) OR video (autoplay/muted/loop)
│       │       ├── Gallery prev/next arrows (absolute, shown if g.length > 1)
│       │       └── Thumbnail strip (flex row, 48px thumbs, shown if g.length > 1)
│       └── Permalink (blue link)
└── Fullscreen viewer (fixed overlay, shown when h != null)
    ├── img or video (max-h-[80vh])
    ├── Close button + Prev/Next arrows
    └── Index counter "X / Y"
```

---

## Patch Order (rebuild.js)

| Patch | What it does |
|-------|-------------|
| `_patch_history.js` | Search history stores site/service per entry |
| `_patch_profilelinks.js` | Detects creator platform links on Reddit user profiles |
| `_patch_sociallinks.js` | Extends bio scan to structured social link fields |
| `_patch_linkfollow.js` | Async link-following (Linktree, pinned posts, comments) |
| `_patch_pinned_selftext.js` | Reads selftext/title from pinned posts for platform links |
| `_patch_coomer_proxy.js` | Coomer.st API proxy routing |
| `_patch_remove_faceplate.js` | Removes dead-end faceplate scraper |
| `_patch_banner_fetch.js` | Profile banner image fetch |
| `_patch_reddit_www.js` | Reddit URL rewrites |
| `_patch_autotype.js` | Auto-detect u/ vs r/ input |
| `_patch_username_guess.js` | Username normalization |
| `_patch_scan_all_posts.js` | Platform link scan across all posts |
| `_patch_top_comments.js` | Scan top comments for platform links |
| `_patch_coomer_download.js` | Coomer ZIP download support |
| `_patch_v460.js` | v4.6.0 base features (Coomer site toggle, service dropdown) |
| `_patch_version_fix.js` | Remove duplicate version span; bump V0 to v4.6.0 |
| `_patch_coomer_posts_path.js` | Fix Coomer posts API path |
| `_patch_history_fetch.js` | Restore scroll + history on back navigation |
| `_patch_feature_2_5_6.js` | New-post badge, prefetch next page, scroll save/restore |
| `_patch_coomer_img_proxy.js` | Proxy Coomer images through worker (bypass DDoS-Guard) |
| `_patch_ios_sessionstorage.js` | iOS sessionStorage fix |
| `_patch_header_link.js` | Header title links to GitHub Pages |
| `_patch_clear_fix.js` | Clear button also resets posts array + next-page cursor |
| `_patch_coomer_bg_tab.js` | Open Coomer posts in background tab |
| `_patch_new_post_border.js` | Cyan border on new-since-last-visit posts (inline style) |
| `_patch_thumb_strip.js` | Gallery thumbnail strip below main image |
| `_patch_inline_style_fix.js` | Fix border/highlight to use inline styles (Tailwind purged) |
| `_patch_thumb_strip_v2.js` | Fix thumbnail strip sizing (h-14/w-14 not in CSS) |
| `_patch_thumb_strip_v3.js` | Force thumbnail dimensions fully via inline style |
| `_patch_grid_align_start.js` | alignItems:start on grid (superseded by masonry) |
| `_patch_masonry_columns.js` | Replace CSS Grid with CSS columns — true masonry layout |
| `_patch_bump_version.js` | Bumps Y0/V0/X0 in bundle + worker.js comment |
| `_patch_clear_reset.js` | Clear resets sort/filter state |
| `_patch_sort_and_download.js` | Sort controls + client-side ZIP download (JSZip) |
| `_patch_error_and_svc_reset.js` | Error message + service reset on site toggle |
| `_patch_export_import.js` | Export/import favorites & history |
| `_patch_ui_cleanup.js` | UI cleanup pass |
| `_patch_multi_sort.js` | Multi-field sort |
| `_patch_export_modal.js` | Export modal UI |
| `_patch_v481.js` | v4.8.1 version bump |
| `_patch_export_favs_label.js` | Export favorites label fix |
| `_patch_import_feedback.js` | Import feedback alert |
| `_patch_v482.js` | v4.8.2 version bump |
| `_patch_coomer_server_zip.js` | Server-side ZIP build (worker + R2) — "Server ZIP" button |
| `_patch_v483.js` | v4.8.3 version bump |
| `_patch_action_buttons.js` | Move Favorite/Example/Download ZIP/Server ZIP from "···" menu to button row; remove Copy URL (both locations); v4.8.4 |

---

## Common Edit Patterns

### Finding a string to patch
```js
node -e "
const fs = require('fs');
const c = fs.readFileSync('red-fetch-main/assets/index-DVk7c3Hp.js', 'utf8');
const idx = c.indexOf('YOUR_STRING_HERE');
console.log(c.slice(idx - 200, idx + 400));
"
```

### Syntax check after edit
Each patch script runs `new Function(c)` before saving — a syntax error will print and abort the save. A bracket mismatch causes a blank white screen.

### Deploying
```
node patches/_patch_bump_version.js 4.x.x
cp red-fetch-main/assets/index-DVk7c3Hp.js _rfpush/assets/
cd _rfpush && git add assets/index-DVk7c3Hp.js && git commit -m "vX.X.X — ..." && git push origin main
```

---

## Notes

- `crossorigin` attribute on script/link tags in `index.html` is required for Vite-built modules on GitHub Pages.
- Gallery wrap-around is implemented in both Q0 (card) and fullscreen viewer.
- If the Cloudflare Worker has CORS issues the app shows a network error but doesn't crash.
- `favicon.ico` 404 is harmless — GitHub Pages doesn't serve one by default.
- The CSS reset sets `img, video { max-width: 100%; height: auto }` — always use inline `width`/`height` styles on dynamically-added images to override this.

---

## Change History

### v4.8.4 (2026-06-13)
- Moved ★ Favorite, Example, Download ZIP, Server ZIP from "···" dropdown to button row (next to Load Posts/Clear/Columns)
- Removed "Copy URL" entirely (both the search-bar button and the dropdown item)
- "···" dropdown now only has Export Favs / Import Favs
- Worker version bumped to v4.8.4 to stay in sync (no functional worker changes)

### v4.8.3 (2026-06-13)
- New "Server ZIP" download option for Coomer: worker builds ZIP server-side (`/coomer-zip-build`), stores in R2, served via `/coomer-zip/{key}` (auto-expires after 1 day — R2 lifecycle rule, manual Cloudflare setup still pending: bucket `ZIP_BUCKET` + lifecycle rule)
- Existing client-side "Download ZIP" (JSZip, in-browser) kept as-is — two separate download options now
- Worker version scheme unified with bundle version — both now v4.8.3, bump together going forward
- **Not yet done:** R2 bucket creation + `ZIP_BUCKET` binding + lifecycle rule (manual, Cloudflare dashboard); worker.js not yet deployed; `_rfpush` bundle copy not yet synced

### Session 2026-05-28 — Reddit API Outage Investigation (no deploy)

**Symptom:** Searches returned no results on UI.

**Root cause:** Reddit's public JSON API (`reddit.com/r/*.json`) now returns **403** for all unauthenticated requests — confirmed via `curl` with both default and browser User-Agent headers. Reddit fully shut down the old unauthenticated JSON trick.

**Impact:**
- Live GitHub Pages site (`cman18.github.io/red-fetch`) routes through the **Cloudflare Worker** (`red.coffeemanhou.workers.dev`) — worker needs to be checked; if it's using unauthenticated Reddit API calls, it will also be hitting 403s.
- The separate **Docker/local RedScroller** app (`Docker/RedScroller/`) fetches Reddit directly from the browser with no proxy — this is definitively broken.

**Fix needed:**
- `worker.js` v4.7.0 already has the full OAuth token flow — no code changes needed.
- The worker checks `env.REDDIT_CLIENT_ID` and `env.REDDIT_CLIENT_SECRET`. If missing, it falls through to unauthenticated (now 403).
- Fix is purely in Cloudflare dashboard: add those two env vars under Workers & Pages → red worker → Settings → Variables and Secrets.
- Requires a Reddit "script" app at `reddit.com/prefs/apps` to get the credentials.
- Docker app fix (lower priority — live site uses the worker): would need a separate Express proxy layer.

**Status as of 2026-05-30:**
- Submitted Reddit Data Access Request form (personal use, non-commercial, single developer). Waiting on approval email.
- Tried creating a Reddit script app on two accounts — both blocked by the same registration wall until form is approved.
- `worker.js` already has full OAuth token flow at v4.7.0 — no code changes needed once credentials are available.
- Worker User-Agent patched to browser string (untested — deploy and verify once credentials are set or as a quick test in the meantime).

**Next session:** Check email for Reddit API approval. If approved, create script app at reddit.com/prefs/apps, grab `client_id` + `client_secret`, add both to Cloudflare Workers env vars (Workers & Pages → red → Settings → Variables and Secrets). Site should be back up immediately after.

### v4.6.5 (2026-05-17)
- Replaced CSS Grid with CSS multi-column (masonry) layout — short cards no longer leave dead row space

### v4.6.4 (2026-05-17)
- Version bump consolidating session changes

### v4.6.3 (2026-05-17)
- New-post cyan border via inline `borderColor` style
- Gallery thumbnail strip (48px, scrollable, cyan active border, 50% opacity inactive)
- All highlights use inline styles — Tailwind classes for new features are purged from compiled CSS

### v4.6.1 (2026-05-13)
- Bump all version constants

### v4.6.0 (2026-05-10)
- Proxy Coomer images through worker (bypass DDoS-Guard)
- Fix card image height — portrait images show at natural height
- Coomer site toggle, service dropdown, platform link detection

### v0.4.0 (2026-04-18)
- Removed `max-h-[420px]` cap — images no longer cropped
- Added "Clear history" button
- Replaced version dropdown with simple inline badge
- Unified all three version constants
