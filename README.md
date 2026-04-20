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
Drop files into:
- `assets/employers/attendees/`
- `assets/employers/partners/`

Supported: `png`, `jpg`, `jpeg`, `svg`, `webp`, `avif`. The kiosk reads these folders from your GitHub repo via the public Contents API and caches results in `localStorage`.

## Core behavior

- **Home / attract mode** — featured partners row + animated attendee ticker + "Start Here" CTA.
- **Map** — fullscreen under the header.
- **Website / Info / Partners** — render inside the content area next to the menu.
- **Instagram popup** — shown once per session after a short delay.
- **Inactivity timeout** — returns the kiosk to home after 90 s (configurable).

## Repo structure

```
index.html
styles/main.css
src/app.js
src/config/
  event.js
  logos.js
  map.js
  popup.js
  timing.js
  urls.js          ← new: external URL targets + CORS proxies
assets/
  branding/csun-career-center-logo.png
  qr/instagram-qr.png
  employers/attendees/
  employers/partners/
```
