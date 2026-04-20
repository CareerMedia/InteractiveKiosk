# CSUN Career Center Interactive Kiosk

A premium, light-mode, GitHub Pages-ready kiosk for career fairs.

## Deploy on GitHub Pages

1. Upload the repo to GitHub.
2. Go to **Settings -> Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select **main** and **/(root)**.
5. Save.

This repo is static HTML/CSS/JS, so it does **not** require Vite, npm, or GitHub Actions.

## What to edit

### Event copy
Edit these files:
- `src/config/event.js`
- `src/config/popup.js`

### Map link
Edit:
- `src/config/map.js`

### Timing
Edit:
- `src/config/timing.js`

### Add logos
Drop logo files into:
- `assets/employers/attendees/`
- `assets/employers/partners/`

Supported file types:
- png
- jpg
- jpeg
- svg
- webp
- avif

The kiosk reads those folders from the GitHub repo using the GitHub Contents API at runtime, then caches the results in the browser for faster reloads.

## Core behavior

- **Home / attract mode** shows attendee logos in animated pages.
- **Employer partners** stay visible in a dedicated premium section.
- **Start Here** opens the full-screen Mappedin map.
- **Instagram popup** appears once per session.
- **Inactivity timeout** returns the kiosk to home and resets the session.

## Repo structure

- `index.html`
- `styles/main.css`
- `src/app.js`
- `src/config/event.js`
- `src/config/map.js`
- `src/config/popup.js`
- `src/config/timing.js`
- `src/config/logos.js`
- `assets/branding/csun-career-center-logo.png`
- `assets/qr/instagram-qr.png`
- `assets/employers/attendees/`
- `assets/employers/partners/`
