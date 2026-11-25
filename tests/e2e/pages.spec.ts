import { expect, test } from '@playwright/test';

const pages = [
  { path: '/', heading: /I build systems that keep themselves running/ },
  { path: '/on-call', heading: /Every outage I was called in for twice/ },
  { path: '/tools', heading: /One command that checks every device at once/ },
  { path: '/self-healing', heading: /Issues that now fix themselves/ },
  { path: '/self-healing/storage', heading: /A storage failure took 90 minutes/ },
  { path: '/self-healing/config-drift', heading: /Two racks disagreed/ },
  { path: '/projects', heading: /Three you can open and check/ },
  { path: '/projects/sightline', heading: 'Sightline' },
  { path: '/projects/aws-platform-terraform', heading: 'aws-platform-terraform' },
  { path: '/projects/orbital-watch', heading: 'Orbital Watch' },
  { path: '/how-this-site-runs', heading: /Files on a CDN/ },
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
    // Every page ends on the same ways to reach him.
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Email me' })).toHaveAttribute('href', /^mailto:/);
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Book a 30-minute call' })).toBeVisible();

    // Every image says what it is (or is marked decorative) and reserves its space.
    for (const image of await page.locator('img').all()) {
      expect(await image.getAttribute('alt')).not.toBeNull();
      expect(await image.getAttribute('width')).toBeTruthy();
      expect(await image.getAttribute('height')).toBeTruthy();
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'the page must not scroll sideways').toBeLessThanOrEqual(0);

    // No card is wider than what holds it. A long label that could not break once pushed a card
    // 12 px past its column on a 360 px phone, which only showed as a sideways scroll on Linux.
    const spilling = await page.locator('.surface').evaluateAll(
      (cards) => cards.filter((card) => card.getBoundingClientRect().right > (card.parentElement?.getBoundingClientRect().right ?? Infinity) + 0.5).length,
    );
    expect(spilling, 'no card may be wider than its column').toBe(0);

    // A Content-Security-Policy violation shows up as a console error.
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
}

test('an unknown address answers 404 with the not-found page', async ({ page }) => {
  const response = await page.goto('/no-such-page');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('There is no page at this address');
  await expect(page.getByRole('main').getByRole('link', { name: 'Home', exact: true })).toBeVisible();
});

test('the resume PDF is at its old address and is a PDF', async ({ request }) => {
  const response = await request.get('/rodrigo_pimenta_resume.pdf');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('application/pdf');
  expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

// A visitor who opens a project, GitHub or the resume keeps the portfolio in the tab they came from.
for (const path of ['/', '/on-call', '/self-healing', '/projects', '/projects/sightline', '/projects/orbital-watch', '/how-this-site-runs']) {
  test(`${path}: every link that leaves the site opens in a new tab, and no other link does`, async ({ page }) => {
    await page.goto(path);
    const links = await page.locator('a[href]').evaluateAll((anchors) =>
      anchors.map((a) => {
        const href = a.getAttribute('href') ?? '';
        const leaves = (/^https?:/.test(href) && new URL(href).host !== location.host) || /\.pdf$/.test(href);
        return { href, leaves, target: a.getAttribute('target'), rel: a.getAttribute('rel') ?? '' };
      }),
    );

    expect(links.filter((link) => link.leaves).length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.target, link.href).toBe(link.leaves ? '_blank' : null);
      if (link.leaves) expect(link.rel, link.href).toContain('noopener');
    }
  });
}

test('the resume button in the header opens the PDF in a new tab and the site stays where it was', async ({ page, context }) => {
  await page.goto('/on-call');
  // "Resume (PDF)" on a wide screen, "Resume" on a phone.
  await Promise.all([context.waitForEvent('page'), page.getByRole('banner').getByRole('link', { name: /^Resume/ }).click()]);

  // The headless browser has no PDF viewer, so the new tab reports no address. What matters is
  // that a second tab opened and the first one did not move.
  expect(context.pages()).toHaveLength(2);
  expect(page.url()).toMatch(/\/on-call$/);
});

// Addresses that are in messages already sent. The pages are gone. Their content is not.
for (const [from, to] of [
  ['/resume', '/rodrigo_pimenta_resume.pdf'],
  ['/experience', '/rodrigo_pimenta_resume.pdf'],
  ['/projects/ceph-storage-self-healing-monitor', '/self-healing/storage'],
  ['/projects/config-integrity-self-heal', '/self-healing/config-drift'],
] as const) {
  test(`${from} sends the visitor on to ${to}`, async ({ request }) => {
    const response = await request.get(from, { maxRedirects: 0 });
    expect([301, 302]).toContain(response.status());
    expect(response.headers()['location']).toBe(to);
    expect((await request.get(to)).status()).toBe(200);
  });
}

test('the four tabs are in the order of the story, and the current one is marked', async ({ page }) => {
  await page.goto('/self-healing/storage');
  const tabs = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
  await expect(tabs).toHaveText(['On call', 'Tools', 'Self-healing', 'Side projects']);
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Self-healing' })).toHaveAttribute('aria-current', 'page');
});

test('fingerprinted assets are cached for a year', async ({ page, request }) => {
  await page.goto('/');
  const font = await page.locator('link[rel="preload"][as="font"]').first().getAttribute('href');
  expect(font).toMatch(/^\/_astro\/.+\.woff2$/);

  const response = await request.get(font!);
  expect(response.status()).toBe(200);
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
