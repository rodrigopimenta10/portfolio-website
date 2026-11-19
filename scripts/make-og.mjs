// Draws the pictures other sites and devices show for this one:
//   public/og.png                the 1200x630 card shown when a link is shared (LinkedIn, Slack, iMessage)
//   public/apple-touch-icon.png  the icon a phone shows on its home screen
//   public/favicon-48.png, public/icon-192.png   the tab icon as PNG, for browsers and search results
//                                that do not take the SVG
// Run by hand if the look changes:  node scripts/make-og.mjs
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = async (file, type) => `data:${type};base64,${(await readFile(path.join(root, file))).toString('base64')}`;
const icon = await readFile(path.join(root, 'public', 'favicon.svg'), 'utf8');

// A share card is shown small (about 300 px wide in a LinkedIn "Featured" row), so it carries a
// face, a name and one line, all large, and nothing that needs reading closely.
const html = `<!doctype html><meta charset="utf-8"><style>
  @font-face { font-family: G; font-weight: 100 900; src: url(${await data('src/assets/fonts/geist-latin-wght-normal.woff2', 'font/woff2')}); }
  @font-face { font-family: M; font-weight: 500; src: url(${await data('src/assets/fonts/ibm-plex-mono-latin-500-normal.woff2', 'font/woff2')}); }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; position: relative; overflow: hidden; background: #090c11; color: #e9edf4; font-family: G, sans-serif; }
  .glow { position: absolute; inset: 0; background:
    radial-gradient(620px 420px at 86% 40%, rgb(52 211 153 / 0.26), transparent 70%),
    radial-gradient(560px 380px at 6% -6%, rgb(56 189 248 / 0.2), transparent 70%),
    radial-gradient(rgb(233 237 244 / 0.1) 1.2px, transparent 1.5px) 0 0 / 26px 26px; }
  .card { position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 330px; align-items: center; gap: 40px; padding: 64px 84px 64px 80px; }
  .brand { display: flex; align-items: center; gap: 18px; font: 500 27px M, monospace; color: #9aa6b8; }
  .brand svg { width: 56px; height: 56px; }
  h1 { margin-top: 44px; font-size: 100px; font-weight: 650; line-height: 0.98; letter-spacing: -0.045em; }
  .role { margin-top: 26px; font-size: 44px; font-weight: 500; letter-spacing: -0.025em; color: #c4ccd8; }
  .says { margin-top: 30px; white-space: nowrap; font-size: 34px; font-weight: 600; letter-spacing: -0.025em; line-height: 1.16;
          background: linear-gradient(100deg, #4ade9a, #38bdf8); -webkit-background-clip: text; color: transparent; }
  .face { justify-self: end; width: 330px; height: 330px; border-radius: 50%; padding: 7px; background: linear-gradient(140deg, #4ade9a, #38bdf8); box-shadow: 0 30px 80px -20px rgb(56 189 248 / 0.45); }
  .face img { display: block; width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 6px solid #090c11; }
</style>
<div class="glow"></div>
<div class="card">
  <div>
    <p class="brand">${icon}<span>rodrigopimenta.com</span></p>
    <h1>Rodrigo Pimenta</h1>
    <p class="role">Backend &amp; platform engineer</p>
    <p class="says">Systems that keep themselves running.</p>
  </div>
  <div class="face"><img src="${await data('src/assets/rodrigo.jpg', 'image/jpeg')}" alt=""></div>
</div>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(root, 'public', 'og.png') });
console.log('wrote public/og.png');

// The tab icon at fixed sizes. The touch icon fills its square: a phone rounds the corners itself.
for (const [file, size, bleed] of [
  ['apple-touch-icon.png', 180, true],
  ['favicon-48.png', 48, false],
  ['icon-192.png', 192, false],
]) {
  const tab = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const art = bleed ? icon.replace('rx="8"', 'rx="0"') : icon;
  await tab.setContent(`<!doctype html><style>*{margin:0}html,body{background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${art}`);
  await tab.screenshot({ path: path.join(root, 'public', file), omitBackground: true });
  console.log(`wrote public/${file}`);
}
await browser.close();
