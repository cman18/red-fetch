# Red Github version

This repo is a zero-dependency static site that deploys to GitHub Pages and avoids stale caches through file-name hashing.

Objectives
1. Upload to GitHub and run directly from there via Pages.
2. Ensure updates always appear on reload by changing asset file names each build.
3. No service worker is used. Browser caches are bypassed because the HTML references new file names on each build.

Quick start
1. Press Use this template on GitHub or push this folder to your repo.
2. Enable Pages in your repo settings with source GitHub Actions.
3. Push to main. The workflow builds and publishes to gh-pages automatically.
4. Visit your Pages URL.
5. When you push a change the workflow repoints HTML to new hashed file names so a normal refresh fetches the new code.

Local dev optional
1. Install Node 20 LTS.
2. Run npm install to set up the tiny build helper. There are no runtime deps.
3. Run npm run dev and open http://localhost:8080 for a quick static preview.
4. Run npm run build to produce a dist folder with hashed file names.

Notes for WSL Windows setup
Works fine from WSL Ubuntu in VS Code. No Docker needed for GitHub Pages. If you do build in Docker for some reason you can still commit the dist output and serve it with Pages.

Cache busting strategy
1. A version string based on the current UTC timestamp is embedded during build.
2. The builder writes new asset names, for example main.3b9f1a.css and app.a81c2d.js.
3. index.html is emitted new on each build and points to the new names. Browsers treat new file names as new resources, so a basic refresh loads the latest release.

Single page app routing
A 404.html file mirrors index.html so direct deep links work on GitHub Pages.
