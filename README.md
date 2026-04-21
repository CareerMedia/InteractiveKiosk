# CSUN Career Center Interactive Kiosk

A premium, light-mode, GitHub Pages-ready kiosk for career fairs.

## Deploy on GitHub Pages

1. Upload the repo to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select **main** and **/(root)**.
5. Save.

This repo is static HTML/CSS/JS, so it does **not** require Vite, npm, or GitHub Actions.

## Layout

The kiosk uses a **single persistent layout**:

```
┌───────────────────────────────────────────────┐
│  HEADER (logo, title, countdown, date pill)   │
├──────────────────────────────────┬────────────┤
│                                  │            │
│        CONTENT AREA              │   MENU     │
│  (Home / Website / Info /        │  Map       │
│   Partners render here)          │  Website   │
│                                  │  Info      │
│                                  │  Partners  │
│                                  │  ───────   │
│                                  │  Home      │
├──────────────────────────────────┤            │
│  FOOTER (Touch to begin · CTA)   │            │
└──────────────────────────────────┴────────────┘
```

- **Home, Website, Info, Partners** render in the content area (to the left of the menu, above the footer).
- **Map** takes over the *entire* area under the header (menu + footer auto-hide while in Map view). The sidebar re-appears automatically by tapping anywhere after the map view closes or by returning Home from the auto-inactivity timer.

## Menu items

| Item     | Destination                                                      |
|----------|------------------------------------------------------------------|
| Map      | `src/config/map.js` → Mappedin embed                             |
| Website  | `src/config/urls.js` → `website` (defaults to csun.edu/career)   |
| Info     | CSUN upcoming events feed                                        |
| Partners | `src/config/urls.js` → `partners` (CSUN employer partners page)  |
| Home     | Back to attract-mode (featured partners + attendee ticker)       |

## Why external sites load through a proxy

Sites like `csun.edu` send `X-Frame-Options: SAMEORIGIN` which **blocks any iframe embedding** — that's the "refused to connect" error. Since GitHub Pages is static-only we can't run our own proxy server, so the kiosk uses public CORS proxies (configurable in `src/config/urls.js`) to fetch the page's raw HTML and render it via `<iframe srcdoc>`:

1. Direct `iframe.src` load is tried first (3.5 s window).
2. In parallel, the raw HTML is fetched through `allorigins.win` (or the next proxy in the list).
3. A `<base href="…">` tag is injected so relative assets/links resolve against the real origin, `<meta http-equiv="X-Frame-Options|CSP|refresh">` tags are stripped, and common frame-busting scripts are neutralized.
4. The rewritten HTML is set as `iframe.srcdoc`, which renders because `srcdoc` is considered the parent document's origin and **is not subject to the target site's `X-Frame-Options` header**.
5. If all proxies fail, a fallback panel with the URL (and room to drop in a QR code) is shown.

> Note on `imputnet/helium`: Helium is a desktop **Chromium fork** (a browser app you install on macOS/Linux), not an embeddable JavaScript library. There is no way to drop it into a static web page. The proxy + `srcdoc` approach above is the equivalent workaround for a browser-hosted kiosk. If you deploy this kiosk inside a desktop shell (Electron, a Raspberry Pi in Chromium kiosk mode, etc.), you can simply drop the proxy and use a `<webview>` or the real Helium window.

## What to edit

### Event copy
- `src/config/event.js`
- `src/config/popup.js`

### Map embed URL
- `src/config/map.js`

### Website / Partners URLs + CORS proxies
- `src/config/urls.js`

### Timing
- `src/config/timing.js`

### Logos
The repo is the single source of truth for logos — every kiosk and mobile page reads the same files. Two ways to manage them:

1. **Commit files manually** — drop images into `assets/employers/attendees/` or `assets/employers/partners/` and push. Supported: `png`, `jpg`, `jpeg`, `svg`, `webp`, `avif`, `gif`.
2. **Use the admin dashboard** at `/admin` — upload, remove individually, or bulk-clear. Every change is committed straight to the repo so all devices update in unison. See the *Admin dashboard* section below.

Kiosks cache the logo listing in `localStorage` for 5 minutes; they also key that cache by the `version` counter in `config.json`, which the admin bumps with every commit, so changes propagate as soon as kiosks reload.

## Core behavior

- **Home / attract mode** — featured partners row + animated attendee ticker + "Start Here" CTA.
- **Map** — fullscreen under the header.
- **Website / Info / Partners** — render inside the content area next to the menu.
- **Instagram popup** — shown once per session after a short delay.
- **Inactivity timeout** — returns the kiosk to home after 90 s (configurable).

## Extra pages

Two companion pages ship alongside the main kiosk:

### `/mobile` — phone-friendly map
A stripped-down view designed for attendees who scan a QR code. It shows only the header (CSUN logo + "Welcome to the Career Fair!") and the map, optimized for phones. The map URL respects any override set in the admin dashboard.

Test locally: `http://localhost:8000/mobile/`
On GitHub Pages: `https://<user>.github.io/<repo>/mobile/`

### `/admin` — kiosk admin dashboard
Password-protected management UI that **commits directly to this repo** via the GitHub API, so every kiosk and mobile page stays in sync automatically.

**Password:** `spider#5` (change by editing the `ADMIN_PASSWORD` constant at the top of `admin/admin.js`).

**First use — connect to GitHub.** After the password, the admin asks for four things and remembers them in that browser's `localStorage` (never committed to the repo):
- **Owner** and **Repo** — auto-detected when hosted on GitHub Pages; otherwise fill in manually.
- **Branch** — defaults to `main`.
- **Personal Access Token** — a fine-grained PAT scoped to this repo with **Contents: Read and write** is strongly recommended. ([Create one here](https://github.com/settings/personal-access-tokens/new).) A classic token with `repo` scope also works.

**Features:**
- **Map** — update the Mappedin URL. Saves to `config.json` at the repo root. Live preview inside the admin.
- **Employer Partners** — drag-and-drop any number of images. Each upload is a commit to `assets/employers/partners/`. Remove individual logos, each as its own commit.
- **Participating Employers** — same upload flow against `assets/employers/attendees/`. The **Remove all** button deletes every file in that folder in a single atomic commit (using the Git Trees API) and leaves a `.gitkeep` so the folder survives in the repo.

**Propagation.** Every admin action also bumps a `version` counter in `config.json`. Kiosks include this counter in their logo-cache keys, so any change immediately invalidates previously-cached listings. Combined with a short (5-min) TTL, most kiosks pick up changes within a page reload or a few minutes.

**Security note.** Because this site is fully static, the password lives in the JavaScript bundle and isn't real authentication — anyone who views source can see it. The GitHub token, however, is real: handle it carefully. Treat the admin URL as sensitive, use a fine-grained token limited to this one repo, and revoke it from GitHub if a device is lost or compromised.

## Repo structure

```
index.html                ← main kiosk
styles/main.css
config.json               ← admin-managed runtime config (map URL + version)

src/app.js
src/config/
  event.js
  logos.js
  map.js
  popup.js
  timing.js
  urls.js                 ← external URL targets + CORS proxies
src/shared/
  config.js               ← fetches config.json at runtime (kiosk + mobile)
  github.js               ← GitHub API client (admin only)

mobile/                   ← /mobile — phone-friendly map
  index.html
  mobile.css
  mobile.js

admin/                    ← /admin — password-protected dashboard
  index.html
  admin.css
  admin.js

assets/
  branding/csun-career-center-logo.png
  qr/instagram-qr.png
  employers/attendees/
  employers/partners/
```
