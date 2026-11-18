import { expect, test, type Page } from '@playwright/test';

const panel = (page: Page) => page.locator('[data-status-panel]');
const row = (page: Page, id: string) => page.locator(`[data-system="${id}"]`);

test('all up: each row shows its state, a real fact and when it was checked', async ({ page }) => {
  await page.goto('/');

  await expect(panel(page).getByRole('heading', { name: 'Everything I run, right now' })).toBeVisible();
  await expect(panel(page).getByRole('status')).toContainText('All 4 up');
  await expect(row(page, 'sightline')).toHaveAttribute('data-state', 'up');
  await expect(row(page, 'sightline')).toContainText('Serving revision clps-web-00368-545 in us-east4');
  await expect(row(page, 'orbital-watch')).toContainText('7 of 7 data sources fresh');
  await expect(row(page, 'orbital-watch')).toContainText(/checked .+ · data built 1 h \d+ min ago/);
  await expect(row(page, 'aws-platform')).toContainText('Last live drill passed: m1 applied to a real AWS account and destroyed (run 25)');
  await expect(row(page, 'this-site')).toContainText('Status service running outside Cloud Run');
  // The test service answers from files, and the panel says so rather than passing them off as live.
  await expect(panel(page)).toContainText('Recorded responses, not live data');
});

test('loading: rows are there before any answer, and a slow service is explained', async ({ page }) => {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/status', async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/');

  await expect(page.locator('[data-system]')).toHaveCount(4);
  await expect(row(page, 'sightline')).toHaveAttribute('data-state', 'loading');
  await expect(row(page, 'sightline')).toContainText('checking');
  await expect(panel(page).getByRole('status')).toHaveText('Checking…');
  await expect(panel(page)).toContainText('Still waiting. The service scales to zero when idle', { timeout: 6000 });

  release();
  await expect(panel(page).getByRole('status')).toContainText('All 4 up');
  await expect(panel(page)).not.toContainText('Still waiting');
});

test('one source failing: that row says could not check, with the reason and the last known answer', async ({ page }) => {
  await page.route('**/api/status', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.systems[0] = {
      ...body.systems[0],
      state: 'unknown',
      fact: undefined,
      reason: 'No answer within 4 seconds.',
      last_known: { state: 'up', fact: 'Serving revision clps-web-00368-545 in us-east4', checked_at: body.systems[0].checked_at },
    };
    await route.fulfill({ response, json: body });
  });
  await page.goto('/');

  await expect(row(page, 'sightline')).toHaveAttribute('data-state', 'unknown');
  await expect(row(page, 'sightline')).toContainText('could not check');
  await expect(row(page, 'sightline')).toContainText('No answer within 4 seconds.');
  await expect(row(page, 'sightline')).toContainText(/Last known, .+: up\. Serving revision clps-web-00368-545 in us-east4/);
  await expect(row(page, 'orbital-watch')).toHaveAttribute('data-state', 'up');
  await expect(panel(page).getByRole('status')).toContainText('3 of 4 up, 1 could not check');
});

test('a degraded source keeps its fact and shows why', async ({ page }) => {
  await page.route('**/api/status', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.systems[1] = {
      ...body.systems[1],
      state: 'degraded',
      fact: '3 of 7 data sources fresh',
      reason: 'The page is up and says so itself: 4 of its 7 sources are stale.',
    };
    await route.fulfill({ response, json: body });
  });
  await page.goto('/');

  await expect(row(page, 'orbital-watch')).toHaveAttribute('data-state', 'degraded');
  await expect(row(page, 'orbital-watch')).toContainText('degraded');
  await expect(row(page, 'orbital-watch')).toContainText('4 of its 7 sources are stale');
});

for (const [name, fail, reason] of [
  ['unreachable', (page: Page) => page.route('**/api/status', (route) => route.abort('connectionrefused')), 'the request did not get through'],
  ['answering 502', (page: Page) => page.route('**/api/status', (route) => route.fulfill({ status: 502, body: 'Bad Gateway' })), 'it answered HTTP 502'],
  ['answering a web page', (page: Page) => page.route('**/api/status', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>x</title>' })), 'its answer was not JSON'],
] as const) {
  test(`service ${name}: the panel says so, claims nothing, and can try again`, async ({ page }) => {
    await fail(page);
    await page.goto('/');

    await expect(panel(page).getByRole('status')).toHaveText('Could not check');
    for (const id of ['sightline', 'orbital-watch', 'aws-platform', 'this-site']) {
      await expect(row(page, id)).toHaveAttribute('data-state', 'unknown');
      await expect(row(page, id)).toContainText('could not check');
    }
    await expect(panel(page)).toContainText(`The status service did not answer: ${reason}. Nothing on this panel is live right now.`);
    // The rest of the page is unaffected.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Things you can open and check' })).toBeVisible();

    await page.unroute('**/api/status');
    await panel(page).getByRole('button', { name: 'Try again' }).click();
    await expect(panel(page).getByRole('status')).toContainText('All 4 up');
    await expect(panel(page)).not.toContainText('did not answer');
  });
}

test("a project's page shows that project's row alone", async ({ page }) => {
  await page.goto('/projects/orbital-watch');

  await expect(page.locator('[data-system]')).toHaveCount(1);
  await expect(row(page, 'orbital-watch')).toHaveAttribute('data-state', 'up');
  await expect(panel(page).getByRole('status')).toContainText('Asked at');
});

test('a visitor can fail one check on purpose: the row says so with its last known answer, then recovers', async ({ page }) => {
  await page.goto('/');
  const panel = page.locator('[data-status-panel]').first();
  const row = panel.locator('[data-system="sightline"]');
  await expect(row).toHaveAttribute('data-state', 'up');
  const drill = panel.getByRole('button', { name: 'Fail one check on purpose' });
  await expect(drill).toBeVisible();

  await drill.click();
  await expect(row).toHaveAttribute('data-state', 'unknown');
  await expect(row).toContainText('Simulated: this check timed out after 4 s.');
  await expect(row).toContainText('Last known');
  await expect(panel.locator('[data-status-summary]')).toContainText('3 of 4 up');
  await expect(panel.locator('[data-status-note-text]')).toContainText('Nothing real is broken');
  await expect(panel.getByRole('button', { name: 'Failing one on purpose…' })).toBeDisabled();

  await expect(row).toHaveAttribute('data-state', 'up', { timeout: 10_000 });
  await expect(panel.locator('[data-status-note-text]')).toContainText('Recovered');
  await expect(panel.locator('[data-status-summary]')).toContainText('All 4 up');
  await expect(drill).toBeEnabled({ timeout: 10_000 });
});

test('a project page with one row does not offer the drill', async ({ page }) => {
  await page.goto('/projects/sightline');
  await expect(page.locator('[data-system="sightline"]')).toHaveAttribute('data-state', 'up');
  await expect(page.locator('[data-status-drill]')).toBeHidden();
});
