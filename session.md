# Red Fetch — Project Guide for Claude

## What This App Does

Red Fetch is a Reddit media browser. Users enter a Reddit username (`u/`) or subreddit (`r/`) and the app fetches and displays posts as a media grid — images, videos, and galleries. Cards open into a fullscreen viewer. Supports favorites, search history, NSFW toggle, column count, ZIP download, and swipe navigation on mobile.

**Live site:** https://cman18.github.io/red-fetch/
**Repo:** https://github.com/cman18/red-fetch
**Backend:** Cloudflare Worker at `https://red.coffeemanhou.workers.dev/reddit/`

---

## Source Files DO Exist (correction — outdated claim below was wrong)

Real React/Vite source lives at `c:/Users/atayl/Documents/Projects/Projects/Docker/RedScroller/` (NOT a git repo — untracked, edit on disk only):

- `src/App.tsx` — main component (search bar, controls, grid, viewer)
- `src/RedScroller.code-workspace`, `vite.config.ts`, `package.json`, etc.
- Version is tracked via a `// vNNN - ...` comment on line 1 of `App.tsx` (currently `v013`), separate from the `V0/Y0/X0` in-app version constants below — keep both in sync if changing version.

**Build & deploy workflow:**
1. `cd` into RedScroller dir. If `node_modules` missing: `npm install` (yarn not available in this env).
2. `npx vite build` → outputs `dist/index.html` + `dist/assets/*`.
3. **CRITICAL:** `vite.config.ts` must have `base: '/red-fetch/'` — without it, asset paths are root-relative (`/assets/...`) and the GitHub Pages site (served at `/red-fetch/`) gets blank/broken page (404 on JS/CSS). This was missing originally and caused a broken deploy.
4. Copy `dist/index.html` and `dist/assets/*` into `_rfpush/` (this repo), removing old hashed asset files first (filenames change every build).
5. `git add -A && git commit && git push origin main` — GitHub Pages auto-deploys, 1-3 min.

**Old/legacy minified-edit workflow (pre-source-recovery, may still apply to OTHER older asset bundles):**
- `assets/index-DVk7c3Hp.js` / `assets/index-BbDCGD1s.css` were the previously deployed compiled output, edited directly via Python grep + Edit tool when source was believed lost. No longer needed now that source is available — prefer the source workflow above.

---

## Stack

- React 19.2.1 (compiled, minified)
- Vite (bundler, no longer available)
- Tailwind CSS (compiled utility classes)
- Cloudflare Worker (API proxy to Reddit)
- GitHub Pages (hosting)

---

## Key Variables in Minified JS

### Version Constants (sync these together)
```
V0 = "v0.4.0"   // App version — shown inline next to title
Y0 = "v0.4.0"   // Hook version
X0 = "v0.4.0"   // Viewer version
```

### LocalStorage Keys
```
Rf = "redfetch_search_history"   // recent searches (array of {value, type})
cu = "redfetch_favorites"        // starred items (kept separate from history)
Jd = 5                           // max history items
```

### Main Component: K0 (the whole app)
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
| `v, T` | (unused after v0.4.0 — was version dropdown open state) |
| `f` | whether current query is a favorite |
| `j, I` | ZIP status string, setZipStatus |

### Card Media Component: Q0
- Handles per-card lazy loading via `IntersectionObserver`
- State: `[_, b]` = isVisible; `[U, y]` = gallery index; `g` = sources array
- Gallery arrows wrap around: left at index 0 → last; right at last → index 0
- Container: `div.relative.w-full` with no height constraint (auto-sizes to image)

### Helper Functions
| Function | Role |
|----------|------|
| `Id(post)` | Extracts array of media URLs from a post object (handles galleries, videos, images) |
| `G0()` | Custom hook — fetches posts, manages query state, infinite scroll |
| `Vn(input, type)` | Normalizes Reddit user/subreddit input (handles full URLs, u/ prefix, etc.) |
| `tt` | Fullscreen Previous handler (wraps to last) |
| `$` | Fullscreen Next handler (wraps to first) |
| `zt, wt` | Touch start/end for swipe navigation |

---

## Component/DOM Structure

```
K0 (main app)
├── Header: "Red Fetch" + inline version badge (V0)
├── Favorites row (yellow, star icon) — R.map()
├── Search history row (gray) — p.map() + "Clear history" button
├── Controls: type select, input, Copy URL button
├── Actions: Load Posts, ★ favorite, Clear, Columns, Example, Download ZIP
├── Grid: max-w-7xl, gap-5, grid-cols-{1|2|3}
│   └── Card (per post)
│       ├── Title bar (truncated)
│       ├── div.overflow-hidden → Q0 (media component)
│       │   ├── Loading: div.w-full.aspect-[4/5].animate-pulse
│       │   ├── Error: div.w-full.aspect-[4/5].bg-red-900
│       │   └── Media: div.relative.w-full
│       │       ├── img.w-full.h-full.object-contain  OR  video
│       │       └── Gallery arrows (left/right buttons, shown if >1 image)
│       └── Permalink (blue link)
└── Fullscreen viewer (fixed overlay, shown when h != null)
    ├── img or video (max-h-[80vh])
    ├── Close button + Prev/Next arrows
    └── Index counter "X / Y"
```

---

## Change History

### 2026-06-10 — search bar redesign attempt (REVERTED)
- Redesigned search bar/controls in `App.tsx` (source, see above): merged select+input+search button into one bordered pill, unified right-side controls to `rounded-lg`, added Enter-key submit, bumped source version comment to `v013`.
- Built with `npx vite build`, deployed to `_rfpush/`. Site broke (blank page) — root cause: `vite.config.ts` had no `base: '/red-fetch/'`, so asset paths were `/assets/...` instead of `/red-fetch/assets/...` → 404 on JS/CSS.
- Fixed `vite.config.ts` (`base: '/red-fetch/'`), rebuilt, redeployed — site still reported broken.
- **Reverted both deploy commits** (`git revert` of the redesign + base-path-fix commits), site back to pre-session state (v4.8.2 / v0.4.0 minified bundle, commit `96d47ac`).
- **Outstanding:** source `App.tsx` and `vite.config.ts` on disk still have the v013 redesign + base-path fix (uncommitted, untracked dir). If retrying: rebuild with the now-fixed `vite.config.ts` (base path already correct), redeploy, and actually verify the live URL loads before considering done — last redeploy wasn't confirmed working before user reported it broken again.

### v0.4.0 (2026-04-18)
- **Fixed photo cropping** — removed `max-h-[420px]` cap from card media wrapper. Profile pictures and tall images now display at full natural height instead of being clipped at the bottom.
- **Added "Clear history" button** — appears at the right end of the search history row. Clears `Rf` localStorage and resets `p` state. Does not affect favorites (`cu`).
- **Version badge** — replaced the version dropdown button (with App/Hook/Viewer sub-versions) with a simple inline `v0.4.0` text badge next to the "Red Fetch" title.
- **Unified versioning** — all three version constants (V0, Y0, X0) set to `v0.4.0`.

---

## Common Edit Patterns

### Finding a string to edit
```bash
python3 -c "
with open('assets/index-DVk7c3Hp.js', 'r') as f: content = f.read()
import re
for m in re.finditer(r'YOUR_PATTERN', content):
    pos = m.start()
    print(content[max(0,pos-200):pos+400])
"
```

### Verifying bracket balance before committing
After any edit to the JS, check the area around your change for matching `{`, `[`, `(` pairs. A single mismatched bracket causes a blank white screen with `Uncaught SyntaxError`.

### Updating the version
Search for `const V0=` and `const Y0=` and `const X0=` — replace all three string values together.

### Deploying
```bash
git add assets/index-DVk7c3Hp.js
git commit -m "description"
git push origin main
```

---

## Notes

- The `crossorigin` attribute on script/link tags in `index.html` is required for Vite-built modules on GitHub Pages.
- Gallery wrap-around is already implemented in both the card (`Q0`) and fullscreen viewer — no change needed there.
- The app fetches Reddit data via a Cloudflare Worker; if the Worker has CORS issues, the app shows a network error but doesn't crash.
- `favicon.ico` 404 is harmless — GitHub Pages doesn't serve one by default.
