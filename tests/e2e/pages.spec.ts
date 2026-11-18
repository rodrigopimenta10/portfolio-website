import { expect, test } from '@playwright/test';

const pages = [
  { path: '/', heading: /I’m Rodrigo Pimenta/ },
  { path: '/projects', heading: /Three you can open and check/ },
  { path: '/projects/sightline', heading: 'Sightline' },
  { path: '/projects/aws-platform-terraform', heading: 'aws-platform-terraform' },
  { path: '/projects/orbital-watch', heading: 'Orbital Watch' },
  { path: '/projects/ceph-storage-self-healing-monitor', heading: 'Ceph Storage Self-Healing Monitor' },
  { path: '/projects/config-integrity-self-heal', heading: 'Config Integrity Self-Heal' },
  { path: '/experience', heading: /keeping systems running/ },
  { path: '/how-this-site-runs', heading: /Files on a CDN/ },
  { path: '/resume', heading: 'Rodrigo Pimenta' },
];

for (const { path, heading } of pages) {
  test(`${path} renders, with landmarks, one h1, no errors and no sideways scroll`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    // Pages are cached briefly, as firebase.json says.
    expect(response?.headers()['cache-control']).toBe('public, max-age=300');

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toContainText('RodrigoPimenta102@gmail.com');

    // Every image says what it is (or is marked decorative) and reserves its space.
    for (const image of await page.locator('img').all()) {
      expect(await image.getAttribute('alt')).not.toBeNull();
      expect(await image.getAttribute('width')).toBeTruthy();
      expect(await image.getAttribute('height')).toBeTruthy();
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'the page must not scroll sideways').toBeLessThanOrEqual(0);

    // A Content-Security-Policy violation shows up as a console error.
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
}

test('an unknown address answers 404 with the not-found page', async ({ page }) => {
  const response = await page.goto('/no-such-page');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('There is no page at this address');
  await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
});

test('the resume PDF is at its old address and is a PDF', async ({ request }) => {
  const response = await request.get('/rodrigo_pimenta_resume.pdf');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('application/pdf');
  expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('fingerprinted assets are cached for a year', async ({ page, request }) => {
  await page.goto('/');
  const stylesheet = await page.locator('link[rel="stylesheet"]').first().getAttribute('href');
  expect(stylesheet).toMatch(/^\/_astro\//);

  const response = await request.get(stylesheet!);
  expect(response.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
});

test('every internal link on every page leads somewhere', async ({ page, request }) => {
  const seen = new Set<string>();
  for (const { path } of pages) {
    await page.goto(path);
    const hrefs = await page.locator('a[href]').evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
    for (const href of hrefs) {
      const url = new URL(href);
      if (url.origin === new URL(page.url()).origin) seen.add(url.pathname);
    }
  }
  expect(seen.size).toBeGreaterThan(10);
  for (const pathname of seen) {
    const response = await request.get(pathname);
    expect(response.status(), pathname).toBe(200);
  }
});

test('the theme follows the system, can be switched, and the choice is remembered', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const paper = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const light = await paper();

  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await paper()).not.toBe(light);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // Choosing what the system already says goes back to following the system.
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  expect(await paper()).toBe(light);

  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await paper()).not.toBe(light);
});

test('the old GitHub Pages bundle sends visitors to the new address without needing a script', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile('dist-legacy/index.html', 'utf8');

  expect(html).toContain('<link rel="canonical" href="https://rodrigopimenta.com/" />');
  expect(html).toContain('<meta http-equiv="refresh" content="0; url=https://rodrigopimenta.com/" />');
  expect(html).toContain('<a href="https://rodrigopimenta.com/">rodrigopimenta.com</a>');
  expect((await readFile('dist-legacy/rodrigo_pimenta_resume.pdf')).subarray(0, 5).toString()).toBe('%PDF-');
  expect(await readFile('dist-legacy/rodrigo_pimenta_resume.pdf')).toEqual(await readFile('public/rodrigo_pimenta_resume.pdf'));
});
