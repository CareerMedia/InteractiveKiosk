# CSUN Career Center Interactive Kiosk

This repo now supports two runtime modes:

1. **Static browser mode** for quick previews and GitHub Pages.
2. **Electron kiosk shell mode** for the Website and Partners panels, which need a real Chromium webview instead of an iframe.

## Why the website panels changed

Some external sites block normal iframe embedding. That is why the earlier version showed "refused to connect." This repo now uses:

- **standard browser fallback** when you open the project as a normal website
- **Electron webview rendering** when you run the included kiosk shell

## Run as a kiosk app

1. Install Node.js.
2. Run:
   - `npm install`
   - `npm run kiosk`

This launches the kiosk in a desktop shell with Chromium webviews enabled for Website and Partners.

## Static preview / GitHub Pages

You can still publish the repo as a static site, but Website and Partners will show a graceful fallback panel instead of trying to force blocked pages into an iframe.

## Main editable files

- `src/config/map.js` — Mappedin URL, website URL, partners URL
- `src/config/event.js` — event text, info panel content
- `src/config/popup.js` — Instagram popup copy and link
- `src/config/timing.js` — inactivity and popup timing
- `assets/employers/attendees/` — attendee logos
- `assets/employers/partners/` — partner logos
- `assets/qr/instagram-qr.png` — Instagram QR

## Repo structure

- `index.html`
- `styles/main.css`
- `src/app.js`
- `src/config/`
- `electron/main.js`
- `electron/preload.js`
- `package.json`
