# Interactive Kiosk

This is a zero-build GitHub Pages version of the CSUN Career Center Interactive Kiosk.

## Why this version

This repo is designed to avoid blank-screen deploy issues:
- no Vite
- no npm install
- no build step
- no GitHub Action required
- no hidden `.github` dependency

You can deploy it directly with **GitHub Pages -> Deploy from a branch -> main -> /(root)**.

## How to update the map

Edit `config.js` and change:

```js
MAP_CONFIG.embedUrl
```

## How to update kiosk text and timing

Edit `config.js`.

## How to add employer logos

Drop image files into these folders in the repo:

- `assets/employers/attendees/`
- `assets/employers/partners/`

Supported file types:
- png
- jpg
- jpeg
- svg
- webp
- avif

The app reads those folders from the GitHub repo using the GitHub Contents API at runtime, so after you commit and publish, the kiosk will automatically show every logo in those folders.

## GitHub Pages setup

1. Push the repo to GitHub.
2. Go to **Settings -> Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select **main** and **/(root)**.
5. Save.

## Notes

- The QR code image is stored at `assets/qr/instagram-qr.png`.
- The CSUN Career Center logo is stored at `assets/branding/csun-career-center-logo.png`.
- If you change the repo name or owner and the site is hosted on GitHub Pages, the app auto-detects the repo URL. If needed, you can override the owner/repo in `config.js`.
