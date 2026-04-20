# CSUN Career Center Interactive Kiosk

A premium, mall-directory-style touchscreen kiosk for career fairs. The app opens on an always-on attract screen, showcases attending employers, highlights paid employer partners, launches a full-screen Mappedin event map, and automatically returns home after inactivity.

## What is included

- **Idle / attract screen** with animated attendee employer logo cycling
- **Always-visible employer partner rail** for paid partners
- **Start Here CTA** to launch the interactive map
- **Mappedin iframe configuration** stored in one easy-to-edit file
- **Session-based Instagram popup** with confetti and QR code
- **Inactivity timer** that returns the kiosk to the home screen
- **Portrait-first layout** tuned for a 32-inch vertical touchscreen, while still responsive in landscape

## Quick start

```bash
npm install
npm run dev
```

To create a production build:

```bash
npm run build
npm run preview
```

## Repo structure

```text
interactive-kiosk/
├── src/
│   ├── assets/
│   │   ├── branding/
│   │   ├── employers/
│   │   │   ├── attendees/
│   │   │   └── partners/
│   │   └── qr/
│   ├── components/
│   ├── config/
│   ├── hooks/
│   ├── utils/
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── index.html
├── package.json
└── vite.config.ts
```

## How to add employer logos

### Attending employers
Drop logo files into:

```text
src/assets/employers/attendees/
```

### Employer partners
Drop logo files into:

```text
src/assets/employers/partners/
```

Supported extensions:

- `.png`
- `.jpg`
- `.jpeg`
- `.svg`
- `.webp`
- `.avif`

The app automatically pulls every supported image from those folders and sorts them alphabetically by filename.

## How to change the map link

Edit this file:

```text
src/config/map.ts
```

Replace the value of `MAP_EMBED_URL` with your new Mappedin embed link.

The app automatically ensures the iframe uses:

- `embedded=true`
- `kiosk=true`

So you can keep using the clean map link and let the code handle the rest.

## How session behavior works

A **session** starts when someone taps **Start Here**.

During a session:

- the interactive map opens
- the Instagram popup appears **once** after a short delay
- the popup can be dismissed manually or auto-closes
- the inactivity timer keeps running

When the session times out, the kiosk returns to the idle home screen and the next visitor gets a fresh session.

## Files you will most likely edit

### Text, timing, CTA labels

```text
src/config/kiosk.ts
```

Use this file to change:

- button label
- popup timing
- inactivity timing
- event title / subtitle
- Instagram text

### Map link

```text
src/config/map.ts
```

### Logo folders

```text
src/assets/employers/attendees/
src/assets/employers/partners/
```

## Notes about inactivity with embedded maps

Because the event map is loaded inside a third-party iframe, browser-level interaction tracking is strongest for touches, clicks, and state changes the parent page can observe. This repo also enables **Mappedin kiosk mode** in the iframe as a built-in safety layer for embedded map inactivity handling.

## Branding included

This repo already includes:

- the attached **CSUN Career Center logo lockup**
- the attached **Instagram QR code**
- CSUN red accent color `#d22030`

## Suggested deployment options

- GitHub Pages
- Netlify
- Vercel
- a local kiosk browser on a dedicated touchscreen device

For the most kiosk-like experience, run the browser in full-screen / kiosk mode on the display.


## GitHub Pages deployment

This project is a Vite app and must be **built before publishing**. Do not point GitHub Pages directly at the raw repo files.

This repo includes a workflow at:

```text
.github/workflows/deploy.yml
```

To publish with GitHub Pages:

1. Push the repo to GitHub.
2. In GitHub, go to **Settings > Pages**.
3. Under **Build and deployment**, choose **GitHub Actions**.
4. Push to `main` and let the workflow build and deploy the `dist` folder automatically.

The Vite config is already set to use the correct project-site base path:

```text
/InteractiveKiosk/
```

If you rename the repository, update the `base` value in `vite.config.ts` to match the new repo name.
