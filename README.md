# Rodrigo Pimenta — Portfolio

Personal portfolio built with Vite + React.

**Live site:** https://rodrigopimenta.com
**Mirror:** https://rodrigopimenta10.github.io/portfolio-website/

Both hosts are intentionally kept alive. Resume PDFs already sent to recruiters
have the `github.io` URL baked into the header and cannot be updated, so that
host has to keep serving indefinitely.

Because the two hosts serve from different roots, the asset base is configurable:
Cloudflare uses the default `/`, and the GitHub Pages workflow sets
`VITE_BASE=/portfolio-website/`. Hardcoding either one blanks the other host.

---

## Setup

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Visit http://localhost:5173/portfolio-website/

---

## Build

```bash
npm run build    # outputs to dist/
npm run preview  # preview the build locally
```

---

## Deploy to GitHub Pages

```bash
npm run deploy
```

This builds the site and pushes `dist/` to the `gh-pages` branch.

In repo Settings → Pages, set Source to `gh-pages` branch, root folder.

---

## Adding Assets

**Resume PDF:** copy to `public/rodrigo_pimenta_resume.pdf` — the nav and contact section link to it automatically.

**Photos:**

| File | Where it shows |
|------|----------------|
| `public/images/headshot.png` | Hero |
| `public/images/about-1.jpg` | About |
| `public/images/ansible-fest-2025.jpeg` | Events |

---

## Stack

- Vite + React 18
- Plain CSS (no framework)
- Space Mono + Inter via Google Fonts
- gh-pages for deployment
