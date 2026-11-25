import { expect, test, type Page } from '@playwright/test';
import { TICK_MS } from '../../src/lib/drift-sim/engine';

const sim = (page: Page) => page.locator('#drift [data-drift-sim]');
const push = (page: Page) => sim(page).locator('[data-push]');
const checker = (page: Page) => sim(page).locator('[data-checker]');
const byHand = (page: Page) => sim(page).getByRole('button', { name: 'Push the files here by hand' });
const said = (page: Page) => sim(page).getByRole('status');
const rack = (page: Page, name: 'SNC rack' | 'RF gateway rack') => sim(page).getByRole('region', { name });
const mission = (page: Page, index: number) => sim(page).locator('[data-mission]').nth(index);

const CAUGHT =
  'The checker compared the two racks, saw the RF gateway rack was behind, pushed v2 and restarted its service. Nobody was affected.';
const OUTAGE =
  'A modem failover landed on the mismatch. The RF gateway rack is running old files against new ones, and subscribers are offline.';

async function open(page: Page) {
  await page.goto('/self-healing');
  await sim(page).scrollIntoViewIfNeeded();
  // The simulation's code loads when it comes into view; the buttons enable when it has.
  await expect(push(page)).toBeEnabled();
}

/** Turn the checker off, push an update and wait for the failover to land on the mismatch. */
async function causeOutage(page: Page) {
  await checker(page).click();
  await push(page).click();
  await expect(said(page)).toHaveText(OUTAGE, { timeout: 12_000 });
}

test('it is labelled a simulation, sits under the section heading and names no real system', async ({ page }) => {
  await open(page);

  await expect(sim(page)).toContainText('Simulation · a made-up gateway, not a real system');
  await expect(sim(page).getByRole('heading', { level: 3 })).toHaveText(
    'Two racks that must agree. Push an update and see if they still do.',
  );
  await expect(sim(page).getByRole('heading', { level: 2 })).toHaveCount(0);
});

test('it starts with both racks on the same three files and the checker on', async ({ page }) => {
  await open(page);

  for (const name of ['SNC rack', 'RF gateway rack'] as const) {
    await expect(rack(page, name).locator('.version')).toHaveText('v1');
    await expect(rack(page, name).getByRole('listitem')).toHaveText([/config file 1\s*v1/, /config file 2\s*v1/, /config file 3\s*v1/]);
  }
  await expect(rack(page, 'RF gateway rack')).toContainText('up to date');
  await expect(sim(page)).toContainText('They agree');
  await expect(sim(page)).toContainText('Subscribers online');
  await expect(said(page)).toHaveText('Both racks have the same files. Push an update to start.');
  await expect(push(page)).toHaveText('Push update v2');
  await expect(checker(page)).toHaveAccessibleName('Checker is on');
  await expect(checker(page)).toHaveAttribute('aria-pressed', 'true');
  // There is nothing to fix by hand yet, so that button cannot be used.
  await expect(byHand(page)).toBeDisabled();
});

test('pushing an update with the keyboard: the racks disagree, then the checker fixes it before any trouble', async ({ page }) => {
  await open(page);

  await push(page).focus();
  await page.keyboard.press('Enter');
  await expect(said(page)).toHaveText(
    'You pushed v2. The SNC rack has it. The RF gateway rack has not received it yet. The checker compares them shortly.',
  );
  await expect(push(page)).toBeDisabled();
  await expect(push(page)).toHaveText('Waiting for the RF gateway rack');
  await expect(rack(page, 'SNC rack').locator('.version')).toHaveText('v2');
  await expect(rack(page, 'RF gateway rack').locator('.version')).toHaveText('v1');
  await expect(rack(page, 'RF gateway rack')).toContainText('has not received it yet');
  await expect(sim(page)).toContainText('They disagree');
  await expect(sim(page)).toContainText(/Nothing looks wrong yet\. Trouble in \d s/);

  await expect(sim(page)).toContainText('checker is comparing', { timeout: 6_000 });
  await expect(said(page)).toHaveText(CAUGHT, { timeout: 6_000 });
  await expect(rack(page, 'RF gateway rack').locator('.version')).toHaveText('v2');
  await expect(rack(page, 'RF gateway rack')).toContainText('updated and restarted');
  await expect(sim(page)).toContainText('They agree');
  await expect(sim(page)).toContainText('Subscribers online');
  await expect(sim(page)).toContainText('caught in time: 1 · outages: 0');
  await expect(mission(page, 0)).toHaveAttribute('data-done', 'true');
  await expect(mission(page, 0)).toContainText('Done:');
  await expect(mission(page, 1)).toHaveAttribute('data-done', 'false');
  await expect(push(page)).toBeEnabled();
  await expect(push(page)).toHaveText('Push update v3');
  // The mark fades and the rack reads as it did before.
  await expect(rack(page, 'RF gateway rack')).toContainText('up to date', { timeout: 6_000 });
});

test('with the checker off the mismatch sits unseen until subscribers go offline, and turning it back on repairs it', async ({ page }) => {
  await open(page);

  await checker(page).click();
  await expect(checker(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(checker(page)).toHaveAccessibleName('Checker is off');
  await expect(said(page)).toHaveText('You turned the checker off. A mismatch will now sit there unseen.');
  await expect(sim(page)).toContainText('Nothing is comparing the racks.');

  await push(page).click();
  await expect(said(page)).toHaveText(
    'You pushed v2. The SNC rack has it. The RF gateway rack has not received it yet, and nothing is comparing them.',
  );
  await expect(said(page)).toHaveText(OUTAGE, { timeout: 12_000 });
  await expect(sim(page)).toHaveAttribute('data-status', 'offline');
  await expect(sim(page)).toContainText('Subscribers offline');
  await expect(rack(page, 'RF gateway rack')).toContainText('old files in use');
  await expect(sim(page)).toContainText('caught in time: 0 · outages: 1');
  await expect(mission(page, 1)).toHaveAttribute('data-done', 'true');
  await expect(push(page)).toBeDisabled();

  await checker(page).click();
  await expect(said(page)).toHaveText(
    'The checker compared the two racks, saw the RF gateway rack was behind, pushed v2 and restarted its service. Subscribers are back.',
    { timeout: 8_000 },
  );
  await expect(sim(page)).toContainText('Subscribers online');
  await expect(rack(page, 'RF gateway rack').locator('.version')).toHaveText('v2');
  // A repair after the outage is not a catch.
  await expect(sim(page)).toContainText('caught in time: 0 · outages: 1');
  await expect(mission(page, 2)).toHaveAttribute('data-done', 'true');
});

test('the files can be pushed to the RF gateway rack by hand, before or after the outage', async ({ page }) => {
  await open(page);

  await checker(page).click();
  await push(page).click();
  await expect(byHand(page)).toBeEnabled();
  await byHand(page).focus();
  await page.keyboard.press('Enter');
  await expect(said(page)).toHaveText('You pushed the files to the RF gateway rack by hand.');
  await expect(sim(page)).toContainText('They agree');
  await expect(byHand(page)).toBeDisabled();
  // The keyboard is handed on to the next thing there is to do.
  await expect(push(page)).toBeFocused();
  await expect(push(page)).toHaveText('Push update v3');
  await expect(sim(page).locator('[data-mission][data-done="true"]')).toHaveCount(0);

  await push(page).click();
  await expect(said(page)).toHaveText(OUTAGE, { timeout: 12_000 });
  await byHand(page).click();
  await expect(said(page)).toHaveText('You pushed the files to the RF gateway rack by hand. Subscribers are back.');
  await expect(sim(page)).toContainText('Subscribers online');
  await expect(sim(page)).toContainText('caught in time: 0 · outages: 1');
});

test('reset starts over', async ({ page }) => {
  await open(page);

  await causeOutage(page);
  await sim(page).getByRole('button', { name: 'Reset' }).click();

  await expect(said(page)).toHaveText('Both racks have the same files. Push an update to start.');
  await expect(sim(page)).toHaveAttribute('data-status', 'agree');
  await expect(rack(page, 'SNC rack').locator('.version')).toHaveText('v1');
  await expect(rack(page, 'RF gateway rack').locator('.version')).toHaveText('v1');
  await expect(push(page)).toBeEnabled();
  await expect(push(page)).toHaveText('Push update v2');
  await expect(checker(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(sim(page)).toContainText('caught in time: 0 · outages: 0');
  await expect(sim(page).locator('[data-mission][data-done="true"]')).toHaveCount(0);
});

test('it runs no timer until an update is pushed, and none once nothing more can happen', async ({ page }) => {
  // Count the ticks of every interval with the simulation's period. The storage simulation on the
  // same page ticks at another rate, and the test below checks that this count sees the right one.
  await page.addInitScript((period) => {
    const counter = { ticks: 0 };
    (window as unknown as { __driftTicks: typeof counter }).__driftTicks = counter;
    const original = window.setInterval;
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...rest: unknown[]) =>
      original(
        () => {
          if (timeout === period) counter.ticks++;
          if (typeof handler === 'function') handler(...rest);
        },
        timeout,
      )) as typeof window.setInterval;
  }, TICK_MS);
  await open(page);
  const ticks = () => page.evaluate(() => (window as unknown as { __driftTicks: { ticks: number } }).__driftTicks.ticks);

  await page.waitForTimeout(1_500);
  expect(await ticks()).toBe(0);

  // Running: the clock ticks until the checker has fixed the rack and the mark has faded.
  await push(page).click();
  await expect(said(page)).toHaveText(CAUGHT, { timeout: 6_000 });
  expect(await ticks()).toBeGreaterThan(0);
  await expect(rack(page, 'RF gateway rack')).toContainText('up to date', { timeout: 6_000 });
  await page.waitForTimeout(TICK_MS * 2);
  const settled = await ticks();
  await page.waitForTimeout(2_000);
  expect(await ticks()).toBe(settled);

  // Offline with nothing looking: it waits for the visitor.
  await causeOutage(page);
  await page.waitForTimeout(TICK_MS * 2);
  const offline = await ticks();
  expect(offline).toBeGreaterThan(settled);
  await page.waitForTimeout(2_000);
  expect(await ticks()).toBe(offline);
});

test('off screen, a running simulation is paused and picks up where it was', async ({ page }) => {
  await open(page);

  await checker(page).click();
  await push(page).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(sim(page)).not.toBeInViewport();
  // Longer than the time a mismatch takes to cause an outage.
  await page.waitForTimeout(10_000);
  await expect(sim(page)).toHaveAttribute('data-status', 'behind');

  await sim(page).scrollIntoViewIfNeeded();
  await expect(said(page)).toHaveText(OUTAGE, { timeout: 12_000 });
});

test('with reduced motion it still works, without animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);

  await push(page).click();
  await expect(said(page)).toHaveText(CAUGHT, { timeout: 8_000 });
  const durations = await sim(page)
    .locator('[data-fuse-fill], .rack')
    .evaluateAll((parts) => parts.map((part) => Number.parseFloat(getComputedStyle(part).transitionDuration)));
  expect(Math.max(...durations)).toBeLessThan(0.01);
});

test('it fits the screen, and every button is big enough to tap', async ({ page }) => {
  await open(page);

  await checker(page).click();
  await push(page).click();
  await expect(byHand(page)).toBeEnabled();
  const [content, screen] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(content).toBeLessThanOrEqual(screen ?? 0);
  for (const button of await sim(page).getByRole('button').all()) {
    const box = await button.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the starting picture is on the page, with a note and no button that pretends to work', async ({ page }) => {
    await page.goto('/self-healing');

    await expect(sim(page).getByRole('heading', { level: 3 })).toHaveText(
      'Two racks that must agree. Push an update and see if they still do.',
    );
    for (const name of ['SNC rack', 'RF gateway rack'] as const) {
      await expect(rack(page, name).locator('.version')).toHaveText('v1');
      await expect(rack(page, name).getByRole('listitem')).toHaveCount(3);
    }
    await expect(sim(page).locator('noscript p')).toHaveText('The simulation needs JavaScript. This is its starting picture.');
    await expect(sim(page).locator('button:enabled')).toHaveCount(0);
  });
});
