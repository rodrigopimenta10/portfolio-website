// Takes the screenshots of the live projects that the project pages show.
// Run by hand when a project's look changes:  node scripts/capture-project-screens.mjs
// It drives the Google Chrome installed on this machine (no browser download) and writes PNGs to
// the directory given as the first argument; compress them into src/assets/screens/ afterwards
// (the README has the cwebp line).
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve(process.argv[2] ?? 'tmp-screens');
await mkdir(out, { recursive: true });

const shots = [
  {
    name: 'sightline',
    url: 'https://lunarsightline.com/',
    // The welcome card covers the Moon on a first visit; close it the way a visitor would.
    prepare: async (page) => {
      await page.waitForTimeout(6000);
      const skip = page.getByRole('button', { name: 'Skip', exact: true });
      if (await skip.count()) await skip.first().click();
      await page.waitForTimeout(2500);
    },
  },
  {
    name: 'orbital-watch',
    url: 'https://orbital.rodrigopimenta.com/',
    prepare: async (page) => page.waitForTimeout(3000),
  },
  {
    name: 'orbital-watch-health',
    url: 'https://orbital.rodrigopimenta.com/',
    prepare: async (page) => {
      await page.waitForTimeout(3000);
      await page.getByText('System health', { exact: false }).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    },
  },
  {
    name: 'aws-platform-terraform',
    // The report the latest live drill committed to the repository.
    url: 'https://github.com/rodrigopimenta10/aws-platform-terraform/blob/main/docs/live/2026-11-18-m1.md',
    // A narrower window: GitHub then drops its file tree and the report fills the picture, so its
    // table can be read at card size. Dark, like the other two pictures.
    viewport: { width: 1000, height: 625 },
    deviceScaleFactor: 2.88,
    prepare: async (page) => {
      await page.waitForTimeout(3000);
      const heading = page.getByRole('heading', { name: /Live drill/ }).first();
      await heading.scrollIntoViewIfNeeded();
      const top = await heading.evaluate((element) => element.getBoundingClientRect().top);
      await page.mouse.wheel(0, top - 40);
      await page.waitForTimeout(800);
    },
  },
];

const browser = await chromium.launch({ channel: 'chrome' });
for (const shot of shots) {
  if (process.argv[3] && process.argv[3] !== shot.name) continue;
  const context = await browser.newContext({
    viewport: shot.viewport ?? { width: 1440, height: 900 },
    // Two device pixels for each CSS pixel (more for a narrower window), so the picture is 2880 by
    // 1800 and stays sharp on a high-density display, where the page shows it up to 1184 CSS pixels wide.
    deviceScaleFactor: shot.deviceScaleFactor ?? 2,
    colorScheme: shot.colorScheme ?? 'dark',
  });
  const page = await context.newPage();
  await page.goto(shot.url, { waitUntil: 'load', timeout: 45000 });
  await shot.prepare(page);
  await page.screenshot({ path: path.join(out, `${shot.name}.png`) });
  console.log(`${shot.name}: ${page.url()}`);
  await context.close();
}
await browser.close();
