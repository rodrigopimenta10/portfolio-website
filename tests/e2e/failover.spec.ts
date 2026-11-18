import { expect, test, type Page } from '@playwright/test';

const sim = (page: Page) => page.locator('[data-failover]');
const node = (page: Page, id: string) => sim(page).locator(`[data-node="${id}"]`);
const log = (page: Page) => sim(page).getByRole('log');

async function open(page: Page) {
  await page.goto('/');
  await sim(page).scrollIntoViewIfNeeded();
  // The simulation's code loads when the section comes into view; the buttons enable when it has.
  await expect(node(page, 'a1')).toBeEnabled();
}

test('it is labelled a simulation and names no real system', async ({ page }) => {
  await open(page);

  await expect(sim(page)).toContainText('Simulation · made-up clusters, not a real system');
  await expect(sim(page).getByRole('heading', { level: 2 })).toHaveText('A monitor that refuses to make things worse');
});

test('failing a node with the keyboard: detected on the next check, failed over, each step logged with its time', async ({ page }) => {
  await open(page);

  await node(page, 'a1').focus();
  await page.keyboard.press('Enter');
  await expect(node(page, 'a1')).toHaveAttribute('aria-pressed', 'true');
  await expect(log(page)).toContainText('You failed a1, the active node in Cluster A.');
  // Nothing has moved yet: the monitor has not looked.
  await expect(node(page, 'a2')).toHaveAttribute('data-role', 'standby');

  await expect(log(page)).toContainText('Cluster A: active node a1 is not answering. Detected,', { timeout: 10_000 });
  await expect(log(page)).toContainText('a2: 75% free, needs 40%: fits.');
  await expect(log(page)).toContainText('Cluster A: failing over a1 → a2.');
  await expect(log(page)).toContainText(/Cluster A: verified, a2 is serving\. Recovered \d\.\d s after detection\./);
  await expect(node(page, 'a2')).toHaveAttribute('data-role', 'active');
  await expect(node(page, 'a2')).toHaveAccessibleName('a2, active, 65% in use. Press to fail it.');
  await expect(log(page).locator('li .at').first()).toHaveText(/^t\+\d+\.\ds$/);
});

test('no standby with capacity: the monitor refuses, says why, and leaves the healthy node alone', async ({ page }) => {
  await open(page);

  await node(page, 'c1').tap().catch(() => node(page, 'c1').click());
  await expect(log(page)).toContainText('c2: 35% free, needs 60%: too busy.', { timeout: 10_000 });
  await expect(log(page)).toContainText('Cluster C: no standby can carry the load. Refusing to fail over: it would overload a healthy node.');
  await expect(sim(page).locator('[data-cluster="c"]')).toContainText('down · refused to move');
  await expect(node(page, 'c2')).toHaveAttribute('data-role', 'standby');
  await expect(node(page, 'c2')).toContainText('65% in use');

  // Bringing the node back clears it on the next check.
  await node(page, 'c1').click();
  await expect(log(page)).toContainText('Cluster C: c1 is answering again. Serving; alert cleared.', { timeout: 10_000 });
  await expect(sim(page).locator('[data-cluster="c"]')).toContainText('serving');
});

test('pause stops the monitor and reset starts over', async ({ page }) => {
  await open(page);

  await sim(page).getByRole('button', { name: 'Pause' }).click();
  await expect(sim(page)).toContainText('Monitor paused');
  await node(page, 'b1').click();
  await page.waitForTimeout(7_000);
  await expect(log(page)).not.toContainText('Cluster B: active node b1 is not answering');

  await sim(page).getByRole('button', { name: 'Resume' }).click();
  await expect(log(page)).toContainText('Cluster B: failing over b1 → b2.', { timeout: 10_000 });

  await sim(page).getByRole('button', { name: 'Reset' }).click();
  await expect(node(page, 'b1')).toHaveAttribute('data-role', 'active');
  await expect(log(page)).not.toContainText('b1');
});

test('with reduced motion it still works, without animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);

  await node(page, 'b1').click();
  await expect(log(page)).toContainText('Cluster B: failing over b1 → b2.', { timeout: 10_000 });
  const duration = await node(page, 'b2').locator('.fill').evaluate((bar) => getComputedStyle(bar).transitionDuration);
  expect(Number.parseFloat(duration)).toBeLessThan(0.01);
});

test('off screen, the simulation schedules nothing', async ({ page }) => {
  // Count interval ticks from the page's own scripts.
  await page.addInitScript(() => {
    const counter = { ticks: 0 };
    (window as unknown as { __ticks: typeof counter }).__ticks = counter;
    const original = window.setInterval;
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...rest: unknown[]) =>
      original(
        () => {
          counter.ticks++;
          if (typeof handler === 'function') handler(...rest);
        },
        timeout,
      )) as typeof window.setInterval;
  });
  await open(page);
  const ticks = () => page.evaluate(() => (window as unknown as { __ticks: { ticks: number } }).__ticks.ticks);

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(sim(page)).not.toBeInViewport();
  await page.locator('[data-status-panel]').evaluate((element) => element.remove());
  await page.waitForTimeout(500);
  const before = await ticks();
  await page.waitForTimeout(2_000);

  expect(await ticks()).toBe(before);
});
