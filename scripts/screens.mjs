// Screenshots of every page of the built site, for looking at before a release.
//
//   node scripts/screens.mjs [--base http://127.0.0.1:4321] [--out docs/screens] [--only home]
//
// Needs the built site served (npm run preview) with the status service behind it. Uses the
// Google Chrome installed on this machine. Writes JPEGs: every page at 1440x900 and 390x844,
// light and dark, full length; the home page's first screen; the status panel in each of its
// states; and the storage simulation after a heal and after a refusal.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const base = option('base', 'http://127.0.0.1:4321');
const out = path.resolve(option('out', 'docs/screens'));
const only = option('only', null);
/** A second status service started on a scenario with one failing source, for that state. */
const failingApi = option('failing-api', null);

const pages = [
  ['home', '/'],
  ['on-call', '/on-call'],
  ['tools', '/tools'],
  ['self-healing', '/self-healing'],
  ['self-healing-storage', '/self-healing/storage'],
  ['self-healing-config-drift', '/self-healing/config-drift'],
  ['projects', '/projects'],
  ['project-sightline', '/projects/sightline'],
  ['project-aws-platform-terraform', '/projects/aws-platform-terraform'],
  ['project-orbital-watch', '/projects/orbital-watch'],
  ['how-this-site-runs', '/how-this-site-runs'],
  ['404', '/no-such-page'],
];
const viewports = [
  ['1440x900', { width: 1440, height: 900 }],
  ['390x844', { width: 390, height: 844 }],
];
const themes = ['light', 'dark'];

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const problems = [];

async function open(viewport, theme, url, prepare) {
  const context = await browser.newContext({ viewport, colorScheme: theme, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('console', (message) => {
    // A status service that is deliberately unreachable logs a failed request; that is the test.
    if (message.type() === 'error' && !prepare && url !== '/no-such-page') problems.push(`${url} [${theme} ${viewport.width}]: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`${url}: ${error.message}`));
  if (prepare) await prepare(page);
  await page.goto(base + url, { waitUntil: 'load' });
  return { context, page };
}

async function settle(page) {
  // Let the status panel answer and lazy images load.
  await page.evaluate(async () => {
    for (const image of document.images) {
      image.loading = 'eager';
    }
    await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
    await document.fonts.ready;
  });
  await page.waitForTimeout(700);
}

const shot = (page, name, fullPage = true) => page.screenshot({ path: path.join(out, `${name}.jpg`), type: 'jpeg', quality: 74, fullPage });

for (const [name, url] of pages) {
  if (only && only !== name) continue;
  for (const [size, viewport] of viewports) {
    for (const theme of themes) {
      const { context, page } = await open(viewport, theme, url);
      await settle(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 0) problems.push(`${url} at ${size}: page scrolls sideways by ${overflow}px`);
      if (name === 'home') await shot(page, `home-first-screen-${size}-${theme}`, false);
      await shot(page, `${name}-${size}-${theme}`);
      await context.close();
    }
  }
}

if (!only || only === 'states') {
  const states = [
    ['loading', (page) => page.route('**/api/status', () => {}), 900],
    ['slow', (page) => page.route('**/api/status', () => {}), 3200],
    ['unreachable', (page) => page.route('**/api/status', (route) => route.abort('connectionrefused')), 900],
    ['service-error', (page) => page.route('**/api/status', (route) => route.fulfill({ status: 502, contentType: 'text/plain', body: 'Bad Gateway' })), 900],
  ];
  if (failingApi) {
    states.push([
      'one-source-failing',
      (page) =>
        page.route('**/api/status', async (route) => {
          const upstream = await fetch(`${failingApi}/api/status`);
          await route.fulfill({ status: 200, contentType: 'application/json', body: await upstream.text() });
        }),
      1200,
    ]);
  }
  for (const [size, viewport] of viewports) {
    for (const theme of themes) {
      for (const [state, prepare, wait] of states) {
        const { context, page } = await open(viewport, theme, '/projects', prepare);
        await page.waitForTimeout(wait);
        await page.locator('[data-status-panel]').scrollIntoViewIfNeeded();
        await shot(page, `status-${state}-${size}-${theme}`, false);
        await context.close();
      }
      const { context, page } = await open(viewport, theme, '/projects');
      await settle(page);
      await page.locator('[data-status-panel]').scrollIntoViewIfNeeded();
      await shot(page, `status-all-up-${size}-${theme}`, false);
      await context.close();
    }
  }
}

if (!only || only === 'sim') {
  for (const [size, viewport] of viewports) {
    for (const theme of themes) {
      const { context, page } = await open(viewport, theme, '/self-healing');
      const sim = page.locator('#storage [data-storage-sim="full"]');
      await sim.scrollIntoViewIfNeeded();
      // One click slows a1. Cluster A's standby has room, so the monitor moves the work.
      await sim.locator('[data-node="a1"]:not([disabled])').click();
      await sim.locator('[data-log] li').first().getByText('had room').waitFor({ timeout: 15000 });
      await shot(page, `simulation-heal-${size}-${theme}`, false);
      // One click slows b1. Cluster B's standby is busy, so the monitor refuses.
      await sim.locator('[data-node="b1"]').click();
      await sim.locator('[data-log] li').first().getByText('called a person').waitFor({ timeout: 15000 });
      await sim.locator('[data-log]').scrollIntoViewIfNeeded();
      await shot(page, `simulation-refusal-${size}-${theme}`, false);
      await context.close();
    }
  }
}

await browser.close();
if (problems.length) {
  console.error(`problems:\n  ${[...new Set(problems)].join('\n  ')}`);
  process.exitCode = 1;
} else {
  console.log(`screenshots in ${path.relative(process.cwd(), out)}/; no console errors, no sideways scroll`);
}
