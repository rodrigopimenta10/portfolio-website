# Rodrigo Pimenta — Portfolio Website

Personal portfolio built with **Vite + React**, deployed to **GitHub Pages**.

---

## Setup

### Prerequisites
- Node.js 18+ and npm

### Install dependencies

```bash
npm install
```

### Development server

```bash
npm run dev
```

Visit [http://localhost:5173/portfolio-website/](http://localhost:5173/portfolio-website/)

---

## Build

```bash
npm run build
```

Output is in `dist/`. Preview locally:

```bash
npm run preview
```

---

## Adding Your Resume

1. Copy your resume PDF to `public/`:
   ```bash
   cp /path/to/rodrigo_pimenta_resume.pdf public/
   ```
2. The download link in the Nav and Contact section will work automatically.

The resume is referenced at `/portfolio-website/rodrigo_pimenta_resume.pdf`.

---

## Photos

Photos live in `images/` at the project root and are served as static assets.

| File | Used in |
|------|---------|
| `images/headshot.png` | Hero section |
| `images/about-1.jpg` | About section |
| `images/about-2.jpg` through `about-5.jpg` | Optional gallery |

Run `./setup-photos.sh` (local only, not pushed) to copy from your Cursor/iCloud assets.

---

## Deploy to GitHub Pages

### 1. Create the GitHub repo

Create an empty repo named `portfolio-website` on GitHub (no README, no .gitignore).

### 2. Initialize and push

```bash
git init
git add .
git status   # Verify CLAUDE.md / claude.md is NOT staged
git commit -m "Initial commit: portfolio website"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/portfolio-website.git
git push -u origin main
```

### 3. Enable GitHub Pages

Option A — gh-pages branch (recommended):

```bash
npm install --save-dev gh-pages
```

Add to `package.json` scripts:
```json
"predeploy": "npm run build",
"deploy": "gh-pages -d dist"
```

Then deploy:
```bash
npm run deploy
```

In your GitHub repo → Settings → Pages → Source: `gh-pages` branch → `/root`.

Option B — GitHub Actions (auto-deploys on push):

See [Vite's GitHub Pages guide](https://vitejs.dev/guide/static-deploy.html#github-pages).

---

## Tech Stack

- **Vite** — build tool
- **React 18** — UI
- **Plain CSS** — no CSS framework (fast, no bloat)
- **Space Mono + Inter** — typography via Google Fonts

---

## License

Personal portfolio — not licensed for redistribution.
