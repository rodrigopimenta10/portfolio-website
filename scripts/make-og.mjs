// Draws public/og.png, the 1200x630 card shown when a link to the site is shared.
// Run by hand if the sentence or the look changes:  node scripts/make-og.mjs
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const font = async (file) => `data:font/woff2;base64,${(await readFile(path.join(root, 'src/assets/fonts', file))).toString('base64')}`;

const html = `<!doctype html><meta charset="utf-8"><style>
  @font-face { font-family: N; font-weight: 200 800; src: url(${await font('newsreader-latin-wght-normal.woff2')}); }
  @font-face { font-family: N; font-style: italic; font-weight: 200 800; src: url(${await font('newsreader-latin-wght-italic.woff2')}); }
  @font-face { font-family: M; font-weight: 500; src: url(${await font('ibm-plex-mono-latin-500-normal.woff2')}); }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; padding: 72px 80px; background: #f7f5ef; color: #1b1a17; font-family: N, serif;
         display: flex; flex-direction: column; justify-content: space-between; }
  .eyebrow { font: 500 22px M, monospace; letter-spacing: 0.08em; text-transform: uppercase; color: #55514a; }
  h1 { font-size: 68px; font-weight: 400; line-height: 1.06; letter-spacing: -0.02em; max-width: 1000px; }
  em { color: #0a6a4d; }
  .foot { display: flex; justify-content: space-between; align-items: center; font: 500 24px M, monospace; }
  .up { display: flex; align-items: center; gap: 14px; color: #0a6a4d; }
  .dot { width: 16px; height: 16px; border-radius: 50%; background: #0a6a4d; }
</style>
<p class="eyebrow">Rodrigo Pimenta · Backend and platform engineer</p>
<h1>I build systems that keep themselves running and <em>report their own degradation</em>.</h1>
<p class="foot"><span>rodrigopimenta.com</span><span class="up"><span class="dot"></span>New York</span></p>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(root, 'public', 'og.png') });
await browser.close();
console.log('wrote public/og.png');
