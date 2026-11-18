import { describe, expect, it } from 'vitest';
import {
  CYCLE_MS,
  advance,
  assess,
  beginCycle,
  initialState,
  isServing,
  loadOf,
  nextWait,
  runCycle,
  toggleNode,
  type SimState,
} from '../../src/lib/failover/engine';

const cluster = (state: SimState, id: string) => state.clusters.find((candidate) => candidate.id === id)!;
const nodeOf = (state: SimState, id: string) => state.clusters.flatMap((c) => c.nodes).find((n) => n.id === id)!;
const texts = (state: SimState) => state.log.map((entry) => entry.text);

describe('the monitor cycle', () => {
  it('does nothing on a healthy system and says so once, however many cycles pass', () => {
    let state = initialState();
    for (let n = 0; n < 5; n++) state = runCycle(state, n * CYCLE_MS).state;

    expect(state.cycle).toBe(5);
    expect(state.log).toHaveLength(1);
    expect(state.log[0]).toMatchObject({ kind: 'quiet', cycle: 1, untilCycle: 5 });
    expect(state.clusters.every(isServing)).toBe(true);
  });

  it('does not notice a failure until its next cycle', () => {
    const failed = toggleNode(initialState(), 'a1', 1_000);

    expect(isServing(cluster(failed, 'a'))).toBe(false);
    expect(nodeOf(failed, 'a1').role).toBe('active');
    expect(texts(failed)).toEqual(['You failed a1, the active node in Cluster A.']);
  });

  it('fails over to the standby with the most room, and logs each step with its time', () => {
    const failed = toggleNode(initialState(), 'a1', 1_000);
    const { state } = runCycle(failed, 6_000);

    expect(nodeOf(state, 'a2').role).toBe('active');
    expect(nodeOf(state, 'a1')).toMatchObject({ role: 'standby', healthy: false });
    expect(isServing(cluster(state, 'a'))).toBe(true);
    expect(loadOf(cluster(state, 'a'), nodeOf(state, 'a2'))).toBe(65);
    expect(state.log.map((entry) => [entry.atMs, entry.kind, entry.text])).toEqual([
      [1_000, 'manual', 'You failed a1, the active node in Cluster A.'],
      [6_250, 'detect', 'Cluster A: active node a1 is not answering. Detected, 5.3 s after it failed.'],
      [6_600, 'assess', 'a2: 75% free, needs 40%: fits.'],
      [6_600, 'assess', 'a3: 55% free, needs 40%: fits.'],
      [7_300, 'act', 'Cluster A: failing over a1 → a2.'],
      [7_700, 'verify', 'Cluster A: verified, a2 is serving. Recovered 1.4 s after detection.'],
    ]);
  });

  it('skips a standby that is too busy and uses one that fits', () => {
    const { state } = runCycle(toggleNode(initialState(), 'b1', 0), 6_000);

    expect(texts(state)).toContain('b3: 30% free, needs 50%: too busy.');
    expect(nodeOf(state, 'b2').role).toBe('active');
  });

  it('refuses to fail over when no standby has capacity, and leaves every healthy node alone', () => {
    const before = toggleNode(initialState(), 'c1', 0);
    const { state } = runCycle(before, 6_000);

    expect(cluster(state, 'c').alert).toBe(true);
    expect(isServing(cluster(state, 'c'))).toBe(false);
    expect(nodeOf(state, 'c1').role).toBe('active');
    expect(nodeOf(state, 'c2')).toEqual(nodeOf(before, 'c2'));
    expect(texts(state).slice(-2)).toEqual([
      'c2: 35% free, needs 60%: too busy.',
      'Cluster C: no standby can carry the load. Refusing to fail over: it would overload a healthy node. ' +
        'Cluster C stays down and a person is paged.',
    ]);
  });

  it('keeps refusing on later cycles without repeating the whole assessment', () => {
    let state = runCycle(toggleNode(initialState(), 'c1', 0), 6_000).state;
    const afterRefusal = state.log.length;
    for (let n = 2; n <= 4; n++) state = runCycle(state, n * CYCLE_MS).state;

    expect(state.log).toHaveLength(afterRefusal + 1);
    expect(state.log.at(-1)).toMatchObject({
      kind: 'quiet',
      cycle: 2,
      untilCycle: 4,
      text: 'No change. Cluster C still has no standby with capacity; still refusing to move.',
    });
    expect(cluster(state, 'c').alert).toBe(true);
  });

  it('clears the alert when the failed node comes back by hand', () => {
    let state = runCycle(toggleNode(initialState(), 'c1', 0), 6_000).state;
    state = toggleNode(state, 'c1', 9_000);
    state = runCycle(state, 12_000).state;

    expect(cluster(state, 'c').alert).toBe(false);
    expect(isServing(cluster(state, 'c'))).toBe(true);
    expect(texts(state).at(-1)).toBe('Cluster C: c1 is answering again. Serving; alert cleared.');
  });

  it('fails over later if capacity appears while it is refusing', () => {
    // B: b1 fails and b2 takes over; then b2 fails with b1 still down and b3 too busy.
    let state = runCycle(toggleNode(initialState(), 'b1', 0), 6_000).state;
    state = runCycle(toggleNode(state, 'b2', 8_000), 12_000).state;
    expect(cluster(state, 'b').alert).toBe(true);
    expect(texts(state)).toContain('b1: needs 50%: down.');

    // b1 is repaired: it is a standby with room, so the next cycle moves the work to it.
    state = runCycle(toggleNode(state, 'b1', 14_000), 18_000).state;

    expect(nodeOf(state, 'b1')).toMatchObject({ role: 'active', healthy: true });
    expect(cluster(state, 'b').alert).toBe(false);
    expect(texts(state)).toContain('Cluster B: b1 has capacity now (90% free, needs 50%).');
    expect(texts(state).at(-1)).toMatch(/^Cluster B: verified, b1 is serving\./);
  });

  it('notes a failed standby once and moves nothing', () => {
    let state = runCycle(toggleNode(initialState(), 'a3', 0), 6_000).state;
    state = runCycle(state, 12_000).state;

    expect(texts(state).filter((text) => text.includes('standby a3 is down'))).toHaveLength(1);
    expect(nodeOf(state, 'a1').role).toBe('active');
  });

  it('handles a standby that fails between the assessment and the move', () => {
    let { state, run } = beginCycle(toggleNode(initialState(), 'a1', 0));
    let atMs = 6_000;
    // Probe A, then assess A: the plan is now to move to a2.
    for (let n = 0; n < 2; n++) ({ state, run } = advance(state, run, (atMs += nextWait(run)!)));
    expect(run.queue[0]).toEqual({ kind: 'failover', cluster: 'a', to: 'a2' });

    state = toggleNode(state, 'a2', atMs + 100);
    for (let wait = nextWait(run); wait !== null; wait = nextWait(run)) ({ state, run } = advance(state, run, (atMs += wait)));

    expect(texts(state)).toContain('Cluster A: a2 failed before the move. Assessing again.');
    expect(nodeOf(state, 'a3').role).toBe('active');
    expect(isServing(cluster(state, 'a'))).toBe(true);
  });

  it('never promotes a node that is down or that would be overloaded', () => {
    // Every order of failing three nodes, a cycle after each: no active node may exceed 100%.
    const ids = initialState().clusters.flatMap((c) => c.nodes.map((n) => n.id));
    for (const first of ids) {
      for (const second of ids) {
        for (const third of ids) {
          let state = initialState();
          let atMs = 0;
          for (const id of [first, second, third]) {
            if (nodeOf(state, id).healthy) state = toggleNode(state, id, atMs);
            ({ state, endMs: atMs } = runCycle(state, atMs + CYCLE_MS));
          }
          for (const c of state.clusters) {
            for (const n of c.nodes) {
              expect(loadOf(c, n), `${first},${second},${third}: ${n.id}`).toBeLessThanOrEqual(100);
            }
            expect(c.nodes.filter((n) => n.role === 'active')).toHaveLength(1);
          }
        }
      }
    }
  });

  it('keeps the log to a bounded length', () => {
    let state = initialState();
    for (let n = 0; n < 80; n++) state = toggleNode(state, 'a3', n);

    expect(state.log).toHaveLength(60);
  });
});

describe('assess', () => {
  it('gives each standby a verdict', () => {
    expect(assess(cluster(initialState(), 'b'))).toEqual([
      { id: 'b2', free: 65, healthy: true, fits: true },
      { id: 'b3', free: 30, healthy: true, fits: false },
    ]);
  });
});
