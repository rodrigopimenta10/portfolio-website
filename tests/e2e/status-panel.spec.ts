import { expect, test, type Page, type Route } from '@playwright/test';

// The panel is on the Side projects page. The status service behind these tests answers from
// recorded files (status/tests/fixtures/scenarios/all-up), and says so in each answer.
const panel = (page: Page) => page.locator('[data-status-panel]');
const row = (page: Page, id: string) => page.locator(`[data-system="${id}"]`);
const listed = ['sightline', 'orbital-watch', 'aws-platform'];

/** Answer with the recorded response after `change` has edited it. */
const edited = (change: (body: { recorded: boolean; systems: Record<string, unknown>[] }) => void) => async (route: Route) => {
  const response = await route.fetch();
  const body = await response.json();
  change(body);
  await route.fulfill({ response, json: body });
};

test('all up: each row shows its state, a real fact and when it was checked', async ({ page }) => {
  await page.goto('/projects');

  await expect(panel(page).getByRole('heading', { name: 'Everything I run, right now' })).toBeVisible();
  await expect(panel(page).locator('[data-status-summary]')).toHaveText('All 3 up');
  await expect(row(page, 'sightline')).toHaveAttribute('data-state', 'up');
  await expect(row(page, 'sightline')).toContainText('Serving revision clps-web-00368-545 in us-east4');
  await expect(row(page, 'orbital-watch')).toContainText('7 of 7 data sources fresh');
  await expect(row(page, 'orbital-watch')).toContainText(/checked .+ · data published \d+ min ago/);
  await expect(row(page, 'aws-platform')).toContainText('Last live drill passed: m1 applied to a real AWS account and destroyed (run 25)');
  // The test service answers from files, and the panel says so rather than passing them off as live.
  await expect(panel(page)).toContainText('Recorded responses, not live data');
  await expect(panel(page).getByRole('button', { name: 'Try again' })).toBeHidden();
});

test('three rows: the service also reports on the site itself, and the panel leaves that out', async ({ page }) => {
  const answer = page.waitForResponse('**/api/status');
  await page.goto('/projects');

  const body = await (await answer).json();
  expect(body.systems.map((system: { id: string }) => system.id)).toContain('this-site');
  await expect(row(page, 'sightline')).toHaveAttribute('data-state', 'up');
  await expect(page.locator('[data-system]')).toHaveCount(3);
  await expect(row(page, 'this-site')).toHaveCount(0);
  await expect(panel(page)).not.toContainText('This site');
});

test('loading: rows are there before any answer, and a slow service is explained', async ({ page }) => {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/status', async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/projects');

  await expect(page.locator('[data-system]')).toHaveCount(3);
  await expect(row(page, 'sightline')).toHaveAttribute('data-state', 'loading');
  await expect(row(page, 'sightline')).toContainText('checking');
  await expect(panel(page).locator('[data-status-summary]')).toHaveText('Checking…');
  await expect(panel(page).getByRole('button', { name: 'Fail one check on purpose' })).toBeDisabled();
  await expect(panel(page)).toContainText('Still waiting. The service scales to zero when idle', { timeout: 6000 });

  release();
  await expect(panel(page).locator('[data-status-summary]')).toHaveText('All 3 up');
  await expect(panel(page)).not.toContainText('Still waiting');
});

test('one source failing: that row says could not check, with the reason and the age of the last known answer', async ({ page }) => {
  await page.route(
    '**/api/status',
    edited((body) => {
      body.systems[0] = {
        ...body.systems[0],
        state: 'unknown',
        fact: undefined,
        reason: 'No answer within 4 seconds.',
        last_known: { state: 'up', fact: 'Serving revision clps-web-00368-545 in us-east4', checked_at: body.systems[0]?.['checked_at'] },
      };
    }),
  );
  await page.goto('/projects');

  await expect(row(page, 'sightline')).toHaveAttribute('data-state', 'unknown');
  await expect(row(page, 'sightline')).toContainText('could not check');
  await expect(row(page, 'sightline')).toContainText('No answer within 4 seconds.');
  await expect(row(page, 'sightline')).toContainText(/last known answer: up, .+/);
  await expect(row(page, 'orbital-watch')).toHaveAttribute('data-state', 'up');
  await expect(panel(page).locator('[data-status-summary]')).toHaveText('2 up · 1 could not check');
});

test('a system the service leaves out is not counted as up', async ({ page }) => {
  await page.route(
    '**/api/status',
    edited((body) => {
      body.systems = body.systems.filter((system) => system['id'] !== 'orbital-watch');
    }),
  );
  await page.goto('/projects');

  await expect(row(page, 'orbital-watch')).toHaveAttribute('data-state', 'unknown');
  await expect(row(page, 'orbital-watch')).toContainText('The status service did not report on this system.');
  await expect(panel(page).locator('[data-status-summary]')).toHaveText('2 up · 1 could not check');
});

test('a degraded source keeps its fact and shows why', async ({ page }) => {
  await page.route(
    '**/api/status',
    edited((body) => {
      body.systems[1] = {
        ...body.systems[1],
        state: 'degraded',
        fact: '3 of 7 data sources fresh',
        reason: 'The page is up and says so itself: 4 of its 7 sources are stale.',
      };
    }),
  );
  await page.goto('/projects');

  await expect(row(page, 'orbital-watch')).toHaveAttribute('data-state', 'degraded');
  await expect(row(page, 'orbital-watch')).toContainText('degraded');
  await expect(row(page, 'orbital-watch')).toContainText('3 of 7 data sources fresh');
  await expect(row(page, 'orbital-watch')).toContainText('4 of its 7 sources are stale');
  await expect(panel(page).locator('[data-status-summary]')).toHaveText('2 up · 1 degraded');
});

for (const [name, fail, reason] of [
  ['unreachable', (page: Page) => page.route('**/api/status', (route) => route.abort('connectionrefused')), 'the request did not get through'],
  ['answering 502', (page: Page) => page.route('**/api/status', (route) => route.fulfill({ status: 502, body: 'Bad Gateway' })), 'it answered HTTP 502'],
  ['answering a web page', (page: Page) => page.route('**/api/status', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>x</title>' })), 'its answer was not JSON'],
] as const) {
  test(`service ${name}: the panel says so, claims nothing, and can try again`, async ({ page }) => {
    await fail(page);
    await page.goto('/projects');

    await expect(panel(page).locator('[data-status-summary]')).toHaveText('Could not check');
    for (const id of listed) {
      await expect(row(page, id)).toHaveAttribute('data-state', 'unknown');
      await expect(row(page, id)).toContainText('could not check');
      await expect(row(page, id)).toContainText('No answer from the status service.');
    }
    await expect(panel(page)).toContainText(`The status service did not answer: ${reason}. Nothing on this panel is live right now.`);
    // Each system is still one press away, and there is nothing to demonstrate without a reading.
    await expect(panel(page).getByRole('link', { name: 'Sightline' })).toHaveAttribute('href', 'https://lunarsightline.com');
    await expect(panel(page).locator('[data-status-demo]')).toBeHidden();
    // The rest of the page is unaffected.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Orbital Watch', exact: true })).toBeVisible();

    await page.unroute('**/api/status');
    await panel(page).getByRole('button', { name: 'Try again' }).click();
    await expect(panel(page).locator('[data-status-summary]')).toHaveText('All 3 up');
    await expect(panel(page)).not.toContainText('did not answer');
    await expect(panel(page).getByRole('button', { name: 'Try again' })).toBeHidden();
  });
}

test('a visitor can fail one check on purpose: the panel says it is a demonstration, and the same button brings the reading back', async ({ page }) => {
  let asked = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/status')) asked += 1;
  });
  await page.goto('/projects');
  await expect(row(page, 'sightline')).toHaveAttribute('data-state', 'up');
  const askedBefore = asked;

  await panel(page).getByRole('button', { name: 'Fail one check on purpose' }).click();
  await expect(row(page, 'sightline')).toHaveAttribute('data-state', 'unknown');
  await expect(row(page, 'sightline')).toContainText('The check timed out after 4 seconds.');
  await expect(row(page, 'sightline')).toContainText(/last known answer: up, .+/);
  await expect(row(page, 'orbital-watch')).toHaveAttribute('data-state', 'up');
  await expect(panel(page).locator('[data-status-summary]')).toHaveText('Demonstration: 2 up · 1 could not check');
  await expect(panel(page).locator('[data-status-note]')).toHaveText(
    'A demonstration, not a real reading: Sightline is drawn the way a failed check looks, in your browser only. Nothing has failed.',
  );
  // Nothing was sent anywhere: the failure is drawn, not caused.
  expect(asked).toBe(askedBefore);

  await panel(page).getByRole('button', { name: 'Run the checks again' }).click();
  await expect(row(page, 'sightline')).toHaveAttribute('data-state', 'up');
  await expect(panel(page).locator('[data-status-summary]')).toHaveText('All 3 up');
  await expect(panel(page)).not.toContainText('A demonstration');
  await expect(panel(page).getByRole('button', { name: 'Fail one check on purpose' })).toBeEnabled();
  await expect.poll(() => asked).toBe(askedBefore + 1);
});

test('reloading during the demonstration returns to the reading', async ({ page }) => {
  await page.goto('/projects');
  await panel(page).getByRole('button', { name: 'Fail one check on purpose' }).click();
  await expect(panel(page).locator('[data-status-summary]')).toContainText('Demonstration');

  await page.reload();
  await expect(panel(page).locator('[data-status-summary]')).toHaveText('All 3 up');
  await expect(row(page, 'sightline')).toHaveAttribute('data-state', 'up');
});

test.describe('the line on the home page', () => {
  const line = (page: Page) => page.locator('[data-status-line]');
  const words = (page: Page) => page.locator('[data-status-line-text]');

  test('says how many are up once the service has said so, and leads to the panel', async ({ page }) => {
    await page.route(
      '**/api/status',
      edited((body) => {
        body.recorded = false;
      }),
    );
    await page.goto('/');

    await expect(words(page)).toHaveText('All 3 up right now. See the live status panel →');
    await expect(line(page)).toHaveAttribute('data-state', 'all-up');
    await line(page).click();
    await expect(page).toHaveURL(/\/projects#status$/);
    await expect(panel(page)).toBeInViewport();
    await expect(panel(page).locator('[data-status-summary]')).toHaveText('All 3 up');
  });

  test('counts the ones that are up when fewer are', async ({ page }) => {
    await page.route(
      '**/api/status',
      edited((body) => {
        body.recorded = false;
        body.systems[0] = { ...body.systems[0], state: 'unknown', fact: undefined, reason: 'No answer within 4 seconds.' };
      }),
    );
    await page.goto('/');

    await expect(words(page)).toHaveText('2 of 3 up right now. See the live status panel →');
    await expect(line(page)).toHaveAttribute('data-state', 'some-up');
  });

  test('does not move anything when its words arrive', async ({ page }) => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/status', async (route) => {
      await held;
      await edited((body) => {
        body.recorded = false;
      })(route);
    });
    await page.goto('/');
    await expect(words(page)).toHaveText('See the live status panel →');
    await line(page).scrollIntoViewIfNeeded();
    const before = await line(page).boundingBox();

    release();
    await expect(words(page)).toHaveText('All 3 up right now. See the live status panel →');
    expect(await line(page).boundingBox()).toEqual(before);
  });

  for (const [name, respond] of [
    ['recorded answers', (route: Route) => route.continue()],
    ['no answer', (route: Route) => route.abort('connectionrefused')],
    ['an error', (route: Route) => route.fulfill({ status: 502, body: 'Bad Gateway' })],
  ] as const) {
    test(`claims nothing on ${name}`, async ({ page }) => {
      await page.route('**/api/status', respond);
      const settled = page.waitForEvent('requestfinished', (request) => request.url().endsWith('/api/status')).catch(() => null);
      const failed = page.waitForEvent('requestfailed', (request) => request.url().endsWith('/api/status')).catch(() => null);
      await page.goto('/');
      await Promise.race([settled, failed]);

      await expect(words(page)).toHaveText('See the live status panel →');
      await expect(line(page)).toHaveAttribute('data-state', 'unread');
      await expect(line(page)).toHaveAttribute('href', '/projects#status');
    });
  }
});
