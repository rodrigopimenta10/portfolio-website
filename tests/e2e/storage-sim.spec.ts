import { expect, test, type Locator, type Page } from '@playwright/test';

// The full simulation is on /self-healing, inside the storage section. The home page has the
// compact one. The monitor looks every 3 seconds, so anything it does is waited for.
//
// Text that changes sits beside an unseen copy of the longest it can be (see StorageSim.astro), so
// these tests read the element that holds the words, never a whole node.

const CHECK = { timeout: 10_000 };

const node = (sim: Locator, id: string) => sim.locator(`[data-node="${id}"]`);
const note = (sim: Locator, id: string) => node(sim, id).locator('[data-node-note]');
const label = (sim: Locator, id: string) => node(sim, id).locator('[data-node-label]');
const state = (sim: Locator, id: string) => sim.locator(`[data-cluster="${id}"] [data-cluster-state]`);
const log = (sim: Locator) => sim.locator('[data-log] li');
const mission = (sim: Locator, id: string) => sim.locator(`[data-mission="${id}"]`);
const countdown = (sim: Locator) => sim.locator('[data-countdown-text]');

async function openFull(page: Page): Promise<Locator> {
  await page.goto('/self-healing');
  const sim = page.locator('#storage [data-storage-sim="full"]');
  await sim.scrollIntoViewIfNeeded();
  // The simulation's code loads when it comes into view. The buttons enable when it has.
  await expect(node(sim, 'a1')).toBeEnabled();
  return sim;
}

async function openCompact(page: Page): Promise<Locator> {
  await page.goto('/');
  const sim = page.locator('[data-storage-sim="compact"]');
  await sim.scrollIntoViewIfNeeded();
  await expect(node(sim, 'a1')).toBeEnabled();
  return sim;
}

/** Count interval ticks from the page's own scripts. */
async function countTicks(page: Page): Promise<() => Promise<number>> {
  await page.addInitScript(() => {
    const counter = { ticks: 0 };
    (window as unknown as { __ticks: typeof counter }).__ticks = counter;
    const original = window.setInterval;
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...rest: unknown[]) =>
      original(() => {
        counter.ticks++;
        if (typeof handler === 'function') handler(...rest);
      }, timeout)) as typeof window.setInterval;
  });
  return () => page.evaluate(() => (window as unknown as { __ticks: { ticks: number } }).__ticks.ticks);
}

test.describe('the full simulation', () => {
  test('is labelled a simulation, under the storage section, and names no real system', async ({ page }) => {
    const sim = await openFull(page);

    await expect(sim.locator('.eyebrow').first()).toHaveText('Simulation · made-up clusters, not a real system');
    await expect(sim.getByRole('heading', { level: 3 })).toHaveText('Break a node. Watch the monitor heal it, or refuse to.');
    await expect(sim.getByRole('group', { name: 'Cluster A its standby has room' })).toBeVisible();
    await expect(sim.getByRole('group', { name: 'Cluster B its standby is busy' })).toBeVisible();
  });

  test('every cluster starts with two active nodes on a solid border and one standby on a dashed one', async ({ page }) => {
    const sim = await openFull(page);

    for (const id of ['a', 'b']) {
      const cluster = sim.locator(`[data-cluster="${id}"]`);
      await expect(cluster.locator('[data-node]')).toHaveCount(3);
      await expect(cluster.locator('[data-node][data-role="active"]')).toHaveCount(2);
      await expect(cluster.locator('[data-node][data-role="standby"]')).toHaveCount(1);
      await expect(state(sim, id)).toHaveText('serving every client');
    }
    await expect(node(sim, 'a1')).toHaveCSS('border-top-style', 'solid');
    await expect(node(sim, 'a3')).toHaveCSS('border-top-style', 'dashed');
    await expect(node(sim, 'a1')).toHaveAccessibleName('a1, active, 40% in use. Click to slow it.');
    await expect(node(sim, 'b3')).toHaveAccessibleName('b3, standby, 70% in use. Click to slow it.');
    await expect(log(sim)).toHaveText(['Nothing is wrong yet. Click a node to slow it down.']);
    await expect(countdown(sim)).toHaveText('The monitor checks every 3 s. Click a node to see it act.');
  });

  test('first thing to try, with the keyboard: a struggling node in Cluster A is healed within one check', async ({ page }) => {
    const sim = await openFull(page);

    await node(sim, 'a1').focus();
    await page.keyboard.press('Enter');
    await expect(node(sim, 'a1')).toHaveAttribute('aria-pressed', 'true');
    await expect(node(sim, 'a1')).toHaveAccessibleName('a1, active, struggling. Click to fail it.');
    await expect(log(sim).first()).toHaveText(
      'You slowed a1, an active node in Cluster A. It is struggling but still up. The monitor has not looked yet.',
    );
    // Nothing has moved yet: the monitor has not looked. The standby shows the sum it will do.
    await expect(node(sim, 'a3')).toHaveAttribute('data-role', 'standby');
    await expect(note(sim, 'a3')).toHaveText('room: 25% + 30% = 55%');
    await expect(countdown(sim)).toHaveText(/^Monitor looks again in [123] s$/);

    await expect(log(sim).first()).toHaveText(
      /^a1 was struggling\. a3 had room \(25% \+ 30% = 55%\), so the monitor moved the work there and checked the cluster's own log to confirm it\. Clients waited \d min\.$/,
      CHECK,
    );
    await expect(node(sim, 'a3')).toHaveAccessibleName('a3, active, 55% in use. Click to slow it.');
    await expect(node(sim, 'a1')).toHaveAccessibleName('a1, standby, struggling. Click to fail it.');
    // The other active node kept its own work and was not used as a spare.
    await expect(node(sim, 'a2')).toHaveAccessibleName('a2, active, 45% in use. Click to slow it.');
    await expect(state(sim, 'a')).toHaveText('serving every client');
    await expect(sim.locator('[data-healed]')).toHaveText('1');
    await expect(mission(sim, 'heal')).toHaveAttribute('data-done', 'true');
    // The line is read out to a screen reader as well as shown.
    await expect(sim.getByRole('status')).toHaveText(/^a1 was struggling\. a3 had room/);
  });

  test('a struggling active node and a struggling standby do not look alike', async ({ page }) => {
    const sim = await openFull(page);

    await node(sim, 'a1').click();
    await node(sim, 'b3').click();

    await expect(label(sim, 'a1')).toHaveText('active, struggling');
    await expect(node(sim, 'a1')).toHaveCSS('border-top-style', 'solid');
    await expect(note(sim, 'a1')).toHaveText('requests waiting');
    await expect(label(sim, 'b3')).toHaveText('standby, struggling');
    await expect(node(sim, 'b3')).toHaveCSS('border-top-style', 'dashed');
    await expect(note(sim, 'b3')).toHaveText('carries no work');
    await expect(state(sim, 'a')).toHaveText(/^half the clients slowed · \d+ min$/);
    await expect(state(sim, 'b')).toHaveText('serving every client');
  });

  test('second and third things to try: the monitor refuses a busy standby, then uses it when the node is down', async ({ page }) => {
    const sim = await openFull(page);

    await node(sim, 'b1').click();
    await expect(note(sim, 'b3')).toHaveText('would be worse: 70% + 45% = 115%');
    await expect(log(sim).first()).toHaveText(
      'b1 is struggling but still up, and b3 would be in worse condition (70% + 45% = 115%). Moving the work would trade a slow node for an overloaded one, so the monitor left it where it is and called a person.',
      CHECK,
    );
    await expect(node(sim, 'b1')).toHaveAttribute('data-role', 'active');
    await expect(note(sim, 'b1')).toHaveText('requests waiting · a person was called');
    await expect(node(sim, 'b3')).toHaveAttribute('data-role', 'standby');
    await expect(sim.locator('[data-refusals]')).toHaveText('1');
    await expect(sim.locator('[data-healed]')).toHaveText('0');
    await expect(mission(sim, 'refuse')).toHaveAttribute('data-done', 'true');
    await expect(mission(sim, 'forced')).toHaveAttribute('data-done', 'false');

    await node(sim, 'b1').click();
    await expect(node(sim, 'b1')).toHaveAccessibleName('b1, active, failed. Click to repair.');
    await expect(log(sim).first()).toHaveText(
      /^b1 is completely down\. b3 is busy \(70% \+ 45% = 115%\), but a slow node is better than a dead one, so the monitor moved the work there and flagged b3 as overloaded\. Clients waited \d+ min\. Repair b1\.$/,
      CHECK,
    );
    await expect(node(sim, 'b3')).toHaveAttribute('data-role', 'active');
    await expect(note(sim, 'b3')).toHaveText('115% · overloaded');
    await expect(label(sim, 'b1')).toHaveText('standby, failed');
    await expect(state(sim, 'b')).toHaveText('serving every client, slowly');
    await expect(sim.locator('[data-healed]')).toHaveText('1');
    await expect(mission(sim, 'forced')).toHaveAttribute('data-done', 'true');
  });

  test('a repaired node stays the standby: the work does not move back by itself', async ({ page }) => {
    const sim = await openFull(page);

    await node(sim, 'a1').click();
    await expect(node(sim, 'a3')).toHaveAttribute('data-role', 'active', CHECK);
    await node(sim, 'a1').click();
    await node(sim, 'a1').click();

    await expect(log(sim).first()).toHaveText(
      'You repaired a1. It is the standby now. The work stays where it is, and a1 is ready if another node fails.',
    );
    await expect(countdown(sim)).toHaveText('The monitor checks every 3 s. Click a node to see it act.');
    await page.waitForTimeout(4_000);
    await expect(node(sim, 'a1')).toHaveAccessibleName('a1, standby, 10% in use. Click to slow it.');
    await expect(node(sim, 'a3')).toHaveAccessibleName('a3, active, 55% in use. Click to slow it.');
    await expect(sim.locator('[data-healed]')).toHaveText('1');
  });

  test('fourth thing to try: with the monitor off nothing moves, and it catches up when it is back on', async ({ page }) => {
    const sim = await openFull(page);
    const monitor = sim.locator('[data-monitor]');

    await expect(monitor).toHaveAccessibleName('Monitor is on');
    await expect(monitor).toHaveAttribute('aria-pressed', 'true');
    await monitor.click();
    await expect(monitor).toHaveAccessibleName('Monitor is off');
    await expect(monitor).toHaveAttribute('aria-pressed', 'false');
    await expect(log(sim).first()).toHaveText('You turned the monitor off. This is on-call by hand.');
    await expect(countdown(sim)).toHaveText('Nothing is watching. Failures wait for a person.');

    await node(sim, 'a2').click();
    await expect(log(sim).first()).toHaveText(
      'You slowed a2, an active node in Cluster A. It is struggling but still up. The monitor is off, so nothing will move its work.',
    );
    await expect(mission(sim, 'byHand')).toHaveAttribute('data-done', 'true', CHECK);
    await expect(node(sim, 'a2')).toHaveAttribute('data-role', 'active');
    await expect(node(sim, 'a3')).toHaveAttribute('data-role', 'standby');
    await expect(note(sim, 'a3')).toHaveText('25% in use');
    await expect(sim.locator('[data-healed]')).toHaveText('0');

    await monitor.click();
    await expect(log(sim).first()).toHaveText('You turned the monitor back on. It looks at every cluster on its next check.');
    await expect(log(sim).first()).toHaveText(/^a2 was struggling\. a3 had room/, CHECK);
    await expect(node(sim, 'a3')).toHaveAttribute('data-role', 'active');
  });

  test('the log keeps the last five lines, newest first, and reset starts over', async ({ page }) => {
    const sim = await openFull(page);

    // Six clicks with the monitor off: six lines said, and the oldest of them is gone.
    await sim.locator('[data-monitor]').click();
    for (let n = 0; n < 2; n++) for (let click = 0; click < 3; click++) await node(sim, 'b2').click();
    await expect(log(sim)).toHaveCount(5);
    await expect(log(sim).first()).toHaveText('You repaired b2. It is carrying its work again.');
    await expect(log(sim).last()).toHaveText('You failed b2 completely. The monitor is off, so nothing will move its work.');

    await node(sim, 'a1').click();
    await sim.getByRole('button', { name: 'Reset' }).click();
    await expect(log(sim)).toHaveText(['Nothing is wrong yet. Click a node to slow it down.']);
    await expect(node(sim, 'a1')).toHaveAccessibleName('a1, active, 40% in use. Click to slow it.');
    await expect(sim.locator('[data-monitor]')).toHaveAttribute('aria-pressed', 'true');
    await expect(sim.locator('[data-mission][data-done="true"]')).toHaveCount(0);
    await expect(countdown(sim)).toHaveText('The monitor checks every 3 s. Click a node to see it act.');
  });

  test('while every node is healthy it schedules nothing, and it stops again once everything is repaired', async ({ page }) => {
    const ticks = await countTicks(page);
    const sim = await openFull(page);
    // A status panel, where a page has one, keeps its own timer: it is not what is counted here.
    await page.evaluate(() => document.querySelector('[data-status-panel]')?.remove());

    await page.waitForTimeout(500);
    const idle = await ticks();
    await page.waitForTimeout(2_000);
    expect(await ticks()).toBe(idle);

    await node(sim, 'b2').click();
    await page.waitForTimeout(1_000);
    expect(await ticks()).toBeGreaterThan(idle);

    await node(sim, 'b2').click();
    await node(sim, 'b2').click();
    await page.waitForTimeout(300);
    const repaired = await ticks();
    await page.waitForTimeout(2_000);
    expect(await ticks()).toBe(repaired);
  });

  test('off screen, a broken node waits: the clock stops', async ({ page }) => {
    const ticks = await countTicks(page);
    const sim = await openFull(page);
    await page.evaluate(() => document.querySelector('[data-status-panel]')?.remove());

    await sim.locator('[data-monitor]').click();
    await node(sim, 'a1').click();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(sim).not.toBeInViewport();
    await page.waitForTimeout(500);
    const before = await ticks();
    await page.waitForTimeout(2_000);

    expect(await ticks()).toBe(before);
  });

  test('with reduced motion it still works, without animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const sim = await openFull(page);

    await node(sim, 'a1').click();
    // The countdown bar moves with the number, a third at a time.
    await expect(countdown(sim)).toHaveText('Monitor looks again in 2 s', CHECK);
    await expect(sim.locator('[data-countdown-fill]')).toHaveAttribute('width', '33.3');
    await expect(node(sim, 'a3')).toHaveAttribute('data-role', 'active', CHECK);
    const duration = await node(sim, 'a3').locator('[data-node-fill]').evaluate((bar) => getComputedStyle(bar).transitionDuration);
    expect(Number.parseFloat(duration)).toBeLessThan(0.01);
  });

  test('nothing moves on the page or spills sideways while the monitor works', async ({ page }) => {
    const sim = await openFull(page);
    const clusters = sim.locator('.clusters');
    const height = async () => (await clusters.boundingBox())?.height;
    const start = await height();

    await node(sim, 'a1').click();
    expect(await height()).toBe(start);
    await node(sim, 'b1').click();
    await expect(note(sim, 'b1')).toHaveText('requests waiting · a person was called', CHECK);
    expect(await height()).toBe(start);
    await node(sim, 'b1').click();
    await expect(note(sim, 'b3')).toHaveText('115% · overloaded', CHECK);
    expect(await height()).toBe(start);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'the page must not scroll sideways').toBeLessThanOrEqual(0);
  });
});

test.describe('the compact simulation on the home page', () => {
  test('shows one cluster and one log line, with no toolbar and no missions', async ({ page }) => {
    const sim = await openCompact(page);

    await expect(sim.locator('.eyebrow').first()).toHaveText('Try it · a made-up cluster');
    await expect(sim.getByRole('heading', { level: 2 })).toHaveText('Break a node. Watch it heal.');
    await expect(sim.locator('[data-cluster]')).toHaveCount(1);
    await expect(sim.locator('[data-node]')).toHaveCount(3);
    await expect(sim.locator('[data-monitor], [data-reset], [data-mission], [data-log]')).toHaveCount(0);
    await expect(sim.locator('[data-latest-text]')).toHaveText('Nothing is wrong yet. Click a node to slow it down.');
  });

  test('heals a struggling node, refuses a second one, and never changes height', async ({ page }) => {
    const sim = await openCompact(page);
    const latest = sim.locator('[data-latest-text]');
    const height = async () => (await sim.boundingBox())?.height;
    const start = await height();

    await node(sim, 'a1').click();
    await expect(latest).toHaveText(
      'You slowed a1, an active node in Cluster A. It is struggling but still up. The monitor has not looked yet.',
    );
    expect(await height()).toBe(start);

    await expect(latest).toHaveText(/^a1 was struggling\. a3 had room \(25% \+ 30% = 55%\)/, CHECK);
    await expect(node(sim, 'a3')).toHaveAccessibleName('a3, active, 55% in use. Click to slow it.');
    await expect(sim.getByRole('status')).toHaveText(/^a1 was struggling\. a3 had room/);
    expect(await height()).toBe(start);

    // The only standby left is the struggling a1, so the monitor will not hand it a2's work.
    await node(sim, 'a2').click();
    await expect(latest).toHaveText(
      'a2 is struggling but still up, and a1 would be in worse condition (75% + 30% = 105%). Moving the work would trade a slow node for an overloaded one, so the monitor left it where it is and called a person.',
      CHECK,
    );
    await expect(note(sim, 'a2')).toHaveText('requests waiting · a person was called');
    expect(await height()).toBe(start);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'the page must not scroll sideways').toBeLessThanOrEqual(0);
  });
});

test.describe('with JavaScript off', () => {
  test.use({ javaScriptEnabled: false });

  test('the starting picture is on the page, with a note that the simulation needs JavaScript', async ({ page }) => {
    await page.goto('/self-healing');
    const sim = page.locator('#storage [data-storage-sim="full"]');

    // Looked up by tag: a search by text does not go inside <noscript>.
    await expect(sim.locator('noscript p')).toBeVisible();
    await expect(sim.locator('noscript p')).toHaveText('The simulation needs JavaScript. This is its starting picture.');
    await expect(sim.locator('[data-node]')).toHaveCount(6);
    await expect(label(sim, 'a1')).toHaveText('active');
    await expect(note(sim, 'a1')).toHaveText('40% in use');
    await expect(label(sim, 'b3')).toHaveText('standby');
    await expect(note(sim, 'b3')).toHaveText('70% in use');
    await expect(node(sim, 'a1')).toBeDisabled();
    // A dead button does not ask to be clicked.
    await expect(node(sim, 'a1').locator('[data-node-action]')).toBeHidden();
  });
});
