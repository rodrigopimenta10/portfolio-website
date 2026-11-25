import { describe, expect, it } from 'vitest';
import {
  CHECK_EVERY_MS,
  MISSIONS,
  advance,
  initialState,
  isIdle,
  loadOf,
  longestTexts,
  toggleMonitor,
  toggleNode,
  view,
  wouldCarry,
  type SimState,
} from '../../src/lib/storage-sim/engine';

const cluster = (state: SimState, id: string) => state.clusters.find((candidate) => candidate.id === id)!;
const nodeOf = (state: SimState, id: string) => state.clusters.flatMap((c) => c.nodes).find((n) => n.id === id)!;
const shown = (state: SimState, id: string) => view(state).clusters.flatMap((c) => c.nodes).find((n) => n.id === id)!;
const newest = (state: SimState) => state.log[0]!;
const roles = (state: SimState, id: string) => cluster(state, id).nodes.map((n) => n.role);

/** Click each node in turn, with no time passing in between. */
const click = (state: SimState, ...ids: string[]) => ids.reduce(toggleNode, state);
/** Let the monitor look `times` times. */
const checks = (state: SimState, times = 1) => advance(state, times * CHECK_EVERY_MS);

describe('the starting picture', () => {
  it('has two clusters, each with two active nodes and one standby', () => {
    const state = initialState();

    expect(state.clusters.map((c) => [c.name, c.about])).toEqual([
      ['Cluster A', 'its standby has room'],
      ['Cluster B', 'its standby is busy'],
    ]);
    for (const c of state.clusters) expect(c.nodes.map((n) => n.role)).toEqual(['active', 'active', 'standby']);
  });

  it('gives Cluster A a standby with room and Cluster B one that would be overloaded', () => {
    const state = initialState();

    expect(wouldCarry(cluster(state, 'a'), nodeOf(state, 'a3'))).toBe(55);
    expect(wouldCarry(cluster(state, 'b'), nodeOf(state, 'b3'))).toBe(115);
    expect(loadOf(cluster(state, 'a'), nodeOf(state, 'a1'))).toBe(40);
    expect(loadOf(cluster(state, 'a'), nodeOf(state, 'a3'))).toBe(25);
  });

  it('says nothing is wrong, with the monitor on and every counter at zero', () => {
    const state = initialState();

    expect(state.log).toEqual([{ id: 0, kind: 'note', text: 'Nothing is wrong yet. Click a node to slow it down.' }]);
    expect(state).toMatchObject({ monitorOn: true, checks: 0, healed: 0, refusals: 0 });
    expect(Object.values(state.done)).toEqual([false, false, false, false]);
  });
});

describe('while every node is healthy', () => {
  it('nothing ticks, however much time passes', () => {
    const state = initialState();

    expect(isIdle(state)).toBe(true);
    expect(advance(state, 60_000)).toBe(state);
    expect(view(state)).toMatchObject({
      countdownText: 'The monitor checks every 3 s. Click a node to see it act.',
      countdown: 0,
    });
  });

  it('stops again once everything is repaired, and the next failure starts a fresh wait', () => {
    let state = click(initialState(), 'b2', 'b2', 'b2');
    expect(isIdle(state)).toBe(true);
    expect(advance(state, 10_000)).toBe(state);

    // a1 is hurt 2 s into a wait, repaired, and hurt again: the monitor is a full 3 s away, not 1 s.
    state = advance(click(initialState(), 'a1'), 2_000);
    state = click(state, 'a1', 'a1', 'a1');
    expect(state.clockMs).toBe(0);
    expect(view(state).countdownText).toBe('Monitor looks again in 3 s');
  });

  it('does not let the monitor off switch start the clock', () => {
    const state = toggleMonitor(initialState());

    expect(isIdle(state)).toBe(true);
    expect(advance(state, 10_000)).toBe(state);
    expect(view(state).countdownText).toBe('Nothing is watching. Failures wait for a person.');
  });
});

describe('a click on a node', () => {
  it('slows it, then fails it, then repairs it', () => {
    let state = click(initialState(), 'a1');
    expect(nodeOf(state, 'a1').health).toBe('slow');
    expect(newest(state)).toMatchObject({
      kind: 'you',
      text: 'You slowed a1, an active node in Cluster A. It is struggling but still up. The monitor has not looked yet.',
    });

    state = click(state, 'a1');
    expect(nodeOf(state, 'a1').health).toBe('down');
    expect(newest(state).text).toBe('You failed a1 completely. The monitor has not looked yet.');

    state = click(state, 'a1');
    expect(nodeOf(state, 'a1').health).toBe('ok');
    expect(newest(state).text).toBe('You repaired a1. It is carrying its work again.');
  });

  it('says so when the node is the standby, which carries no work', () => {
    const state = click(initialState(), 'a3');

    expect(newest(state).text).toBe('You slowed a3, the standby in Cluster A. It is struggling but still up.');
    expect(shown(state, 'a3')).toMatchObject({ label: 'standby, struggling', note: 'carries no work' });
  });

  it('leaves the state alone for a node that does not exist', () => {
    const state = initialState();

    expect(toggleNode(state, 'z9')).toBe(state);
  });

  it('never changes the state it was given', () => {
    const before = initialState();
    const frozen = structuredClone(before);
    checks(click(before, 'a1', 'b1'), 3);

    expect(before).toEqual(frozen);
  });
});

describe('the monitor', () => {
  it('looks every 3 seconds and not before', () => {
    const hurt = click(initialState(), 'a1');

    const early = advance(hurt, CHECK_EVERY_MS - 1);
    expect(early.checks).toBe(0);
    expect(roles(early, 'a')).toEqual(['active', 'active', 'standby']);
    expect(view(early).countdownText).toBe('Monitor looks again in 1 s');

    expect(advance(early, 1).checks).toBe(1);
    expect(checks(hurt, 4).checks).toBe(4);
  });

  it('moves a struggling node’s work to a standby with room, and the two swap roles', () => {
    const state = checks(click(initialState(), 'a1'));

    expect(roles(state, 'a')).toEqual(['standby', 'active', 'active']);
    expect(loadOf(cluster(state, 'a'), nodeOf(state, 'a3'))).toBe(55);
    // The other active node kept its own work and was not used as a spare.
    expect(loadOf(cluster(state, 'a'), nodeOf(state, 'a2'))).toBe(45);
    expect(state).toMatchObject({ healed: 1, refusals: 0 });
    expect(state.done.heal).toBe(true);
    expect(newest(state)).toMatchObject({
      kind: 'heal',
      text: "a1 was struggling. a3 had room (25% + 30% = 55%), so the monitor moved the work there and checked the cluster's own log to confirm it. Clients waited 3 min.",
    });
  });

  it('moves a failed node’s work the same way', () => {
    const state = checks(click(initialState(), 'a2', 'a2'));

    expect(roles(state, 'a')).toEqual(['active', 'standby', 'active']);
    expect(newest(state).text).toBe(
      "a2 was down. a3 had room (25% + 30% = 55%), so the monitor moved the work there and checked the cluster's own log to confirm it. Clients waited 3 min.",
    );
  });

  it('leaves a repaired node as the standby: the work does not move back by itself', () => {
    let state = checks(click(initialState(), 'a1'));
    state = click(state, 'a1', 'a1');

    expect(newest(state).text).toBe(
      'You repaired a1. It is the standby now. The work stays where it is, and a1 is ready if another node fails.',
    );
    expect(isIdle(state)).toBe(true);
    expect(advance(state, 30_000)).toBe(state);
    expect(roles(state, 'a')).toEqual(['standby', 'active', 'active']);
  });

  it('refuses to move a struggling node’s work onto a standby that would be worse off, and calls a person', () => {
    const before = click(initialState(), 'b1');
    const state = checks(before);

    expect(roles(state, 'b')).toEqual(['active', 'active', 'standby']);
    expect(nodeOf(state, 'b1')).toMatchObject({ health: 'slow', escalated: true });
    expect(nodeOf(state, 'b2')).toEqual(nodeOf(before, 'b2'));
    expect(nodeOf(state, 'b3')).toEqual(nodeOf(before, 'b3'));
    expect(state).toMatchObject({ healed: 0, refusals: 1 });
    expect(state.done.refuse).toBe(true);
    expect(newest(state)).toMatchObject({
      kind: 'refuse',
      text: 'b1 is struggling but still up, and b3 would be in worse condition (70% + 45% = 115%). Moving the work would trade a slow node for an overloaded one, so the monitor left it where it is and called a person.',
    });
  });

  it('refuses once, then folds the checks with nothing to do into one line', () => {
    let state = checks(click(initialState(), 'b1'));
    const refusal = newest(state);

    state = checks(state);
    expect(newest(state)).toMatchObject({ kind: 'quiet', text: 'Check 2: nothing new to do.' });
    const quiet = newest(state);

    state = checks(state, 3);
    expect(newest(state)).toEqual({ ...quiet, text: 'Check 5: nothing new to do.' });
    expect(state.log[1]).toEqual(refusal);
    expect(state.refusals).toBe(1);
  });

  it('moves a completely failed node’s work even to a busy standby, and flags that standby as overloaded', () => {
    const state = checks(click(initialState(), 'b1', 'b1'));

    expect(roles(state, 'b')).toEqual(['standby', 'active', 'active']);
    expect(nodeOf(state, 'b3')).toMatchObject({ health: 'ok', escalated: true });
    expect(loadOf(cluster(state, 'b'), nodeOf(state, 'b3'))).toBe(115);
    expect(state).toMatchObject({ healed: 1, refusals: 0 });
    expect(state.done).toMatchObject({ forced: true, heal: false });
    expect(newest(state)).toMatchObject({
      kind: 'forced',
      text: 'b1 is completely down. b3 is busy (70% + 45% = 115%), but a slow node is better than a dead one, so the monitor moved the work there and flagged b3 as overloaded. Clients waited 3 min. Repair b1.',
    });
    expect(shown(state, 'b3')).toMatchObject({ look: 'over', note: '115% · overloaded', label: 'active' });
    expect(view(state).clusters[1]).toMatchObject({ status: 'serving every client, slowly', tone: 'warn' });
  });

  it('takes the work off an overloaded standby as soon as the failed node is repaired', () => {
    let state = checks(click(initialState(), 'b1', 'b1'));
    state = checks(click(state, 'b1'));

    expect(roles(state, 'b')).toEqual(['active', 'active', 'standby']);
    expect(newest(state).text).toBe(
      "b3 was overloaded. b1 had room (15% + 45% = 60%), so the monitor moved the work there and checked the cluster's own log to confirm it.",
    );
    expect(isIdle(state)).toBe(true);
    // Relieving an overloaded node is not the first mission: nothing was hurt.
    expect(state.done.heal).toBe(false);
  });

  it('waits for a person when a node is hurt and the standby is down', () => {
    let state = checks(click(initialState(), 'a3', 'a3', 'a1'));

    expect(roles(state, 'a')).toEqual(['active', 'active', 'standby']);
    expect(state.refusals).toBe(1);
    // A refusal for want of a standby is not the second mission, which is about a standby that is worse off.
    expect(state.done.refuse).toBe(false);
    expect(state.log.map((entry) => entry.text).slice(0, 2)).toEqual([
      'a3, a standby, is down. No work is waiting on it, so there is nothing to move. Reported, so someone looks at it.',
      'a1 is struggling and Cluster A has no working standby to take its work. The monitor is waiting for a person.',
    ]);
    expect(shown(state, 'a1').note).toBe('requests waiting · a person was called');

    // Repair the standby, and the next check moves the work.
    state = checks(click(state, 'a3'));
    expect(roles(state, 'a')).toEqual(['standby', 'active', 'active']);
    expect(newest(state).text).toContain('a1 was struggling. a3 had room (25% + 30% = 55%)');
    expect(newest(state).text).toContain('Clients waited 6 min.');
  });

  it('reports a hurt standby once, and moves nothing', () => {
    let state = checks(click(initialState(), 'b3'));

    expect(newest(state)).toMatchObject({
      kind: 'note',
      text: 'b3, a standby, is struggling. No work is waiting on it, so there is nothing to move. Reported, so someone looks at it.',
    });
    expect(state).toMatchObject({ healed: 0, refusals: 0 });

    state = checks(state);
    expect(newest(state).text).toBe('Check 2: nothing new to do.');
    expect(state.log.filter((entry) => entry.kind === 'note')).toHaveLength(2);
  });

  it('uses the one standby for the first of two failures and waits for a person on the second', () => {
    const state = checks(click(initialState(), 'a1', 'a1', 'a2', 'a2'));

    expect(roles(state, 'a')).toEqual(['standby', 'active', 'active']);
    expect(nodeOf(state, 'a2')).toMatchObject({ health: 'down', escalated: true });
    expect(state).toMatchObject({ healed: 1, refusals: 1 });
    expect(newest(state).text).toBe(
      'a2 is down and Cluster A has no working standby to take its work. The monitor is waiting for a person.',
    );
    expect(shown(state, 'a2').note).toBe('waiting for a person');
    expect(view(state).clusters[0]).toMatchObject({ status: 'half the clients waiting · 3 min', tone: 'bad' });
  });

  it('does not trade one struggling node for another', () => {
    // a1 struggles and its work moves to a3. Then a2 struggles, and the only standby is the struggling a1.
    let state = checks(click(initialState(), 'a1'));
    state = checks(click(state, 'a2'));

    expect(roles(state, 'a')).toEqual(['standby', 'active', 'active']);
    expect(state).toMatchObject({ healed: 1, refusals: 1 });
    expect(newest(state).text).toBe(
      'a2 is struggling but still up, and a1 would be in worse condition (75% + 30% = 105%). Moving the work would trade a slow node for an overloaded one, so the monitor left it where it is and called a person.',
    );
  });

  it('left alone, it settles: from every state a visitor can reach, nothing moves after two more checks', () => {
    const shape = (state: SimState) =>
      JSON.stringify([state.monitorOn, state.clusters.map((c) => c.nodes.map((n) => [n.role, n.health, n.escalated, n.reported]))]);
    const ids = initialState().clusters.flatMap((c) => c.nodes.map((n) => n.id));
    const moves = [...ids.map((id) => (state: SimState) => toggleNode(state, id)), (state: SimState) => checks(state)];

    const seen = new Set<string>();
    const queue = [initialState()];
    for (let state = queue.pop(); state; state = queue.pop()) {
      if (seen.has(shape(state))) continue;
      seen.add(shape(state));

      const settled = checks(state, 2);
      const later = checks(settled, 5);
      expect(later.healed, shape(state)).toBe(settled.healed);
      expect(later.refusals, shape(state)).toBe(settled.refusals);
      expect(later.clusters.map((c) => c.nodes.map((n) => n.role))).toEqual(settled.clusters.map((c) => c.nodes.map((n) => n.role)));

      queue.push(...moves.map((move) => move(state)));
    }
    expect(seen.size).toBeGreaterThan(100);
  });
});

describe('with the monitor off', () => {
  it('nothing moves and the wait keeps growing until the visitor repairs the node', () => {
    let state = toggleMonitor(initialState());
    expect(newest(state).text).toBe('You turned the monitor off. This is on-call by hand.');

    state = click(state, 'a1');
    expect(newest(state).text).toBe(
      'You slowed a1, an active node in Cluster A. It is struggling but still up. The monitor is off, so nothing will move its work.',
    );

    state = advance(state, 3_900);
    expect(state.done.byHand).toBe(false);
    state = advance(state, 100);
    expect(state.done.byHand).toBe(true);

    state = advance(state, 8_000);
    expect(state.checks).toBe(0);
    expect(roles(state, 'a')).toEqual(['active', 'active', 'standby']);
    expect(view(state)).toMatchObject({ countdownText: 'Nothing is watching. Failures wait for a person.', countdown: 0 });
    expect(view(state).clusters[0]).toMatchObject({ status: 'half the clients slowed · 12 min', tone: 'warn' });
    // The standby does not show a sum nobody is doing.
    expect(shown(state, 'a3')).toMatchObject({ note: '25% in use', ghost: 0 });

    state = click(state, 'a1', 'a1');
    expect(isIdle(state)).toBe(true);
    expect(view(state).clusters[0]!.status).toBe('serving every client');
  });

  it('picks the failure up on the next check once it is back on', () => {
    let state = advance(click(toggleMonitor(initialState()), 'a1'), 7_000);
    state = toggleMonitor(state);
    expect(newest(state).text).toBe('You turned the monitor back on. It looks at every cluster on its next check.');

    state = advance(state, 2_000);
    expect(roles(state, 'a')).toEqual(['standby', 'active', 'active']);
    expect(newest(state).text).toContain('Clients waited 9 min.');
  });

  it('starts each wait from nothing', () => {
    let state = advance(click(toggleMonitor(initialState()), 'a1'), 9_000);
    state = click(state, 'a1', 'a1', 'a1');

    expect(view(state).clusters[0]!.status).toBe('half the clients slowed · 1 min');
  });
});

describe('the four things to try', () => {
  it('are worded for the two clusters on the page', () => {
    expect(MISSIONS.map((mission) => mission.text)).toEqual([
      'Click an active node in Cluster A.',
      'Click b1 in Cluster B once, so it struggles.',
      'Click b1 again, so it is completely down.',
      'Turn the monitor off, then click an active node.',
    ]);
  });

  it('are each ticked by doing what they say, in order', () => {
    const done = (state: SimState) => view(state).missions.filter((mission) => mission.done).map((mission) => mission.id);

    let state = checks(click(initialState(), 'a1'));
    expect(done(state)).toEqual(['heal']);

    state = checks(click(state, 'b1'));
    expect(done(state)).toEqual(['heal', 'refuse']);

    state = checks(click(state, 'b1'));
    expect(done(state)).toEqual(['heal', 'refuse', 'forced']);

    state = advance(click(toggleMonitor(state), 'a2'), 4_000);
    expect(done(state)).toEqual(['heal', 'refuse', 'forced', 'byHand']);
  });
});

describe('the log', () => {
  it('keeps the last five lines, newest first', () => {
    let state = initialState();
    for (let n = 0; n < 4; n++) state = click(state, 'a2', 'a2', 'a2');

    expect(state.log).toHaveLength(5);
    expect(state.said).toBe(12);
    expect(state.log.map((entry) => entry.id)).toEqual([12, 11, 10, 9, 8]);
    expect(newest(state).text).toBe('You repaired a2. It is carrying its work again.');
  });
});

describe('what the page shows', () => {
  it('names each node by id, role and state, and says what a click will do', () => {
    let state = initialState();
    expect(shown(state, 'a1')).toMatchObject({ name: 'a1, active, 40% in use. Click to slow it.', pressed: false });
    expect(shown(state, 'a3')).toMatchObject({ name: 'a3, standby, 25% in use. Click to slow it.', pressed: false });

    state = click(state, 'a1', 'a3');
    expect(shown(state, 'a1')).toMatchObject({ name: 'a1, active, struggling. Click to fail it.', pressed: true });
    expect(shown(state, 'a3')).toMatchObject({ name: 'a3, standby, struggling. Click to fail it.', pressed: true });

    state = click(state, 'a1');
    expect(shown(state, 'a1')).toMatchObject({ name: 'a1, active, failed. Click to repair.', label: 'active, failed' });
  });

  it('keeps the role in the label, so a struggling active node and a struggling standby read differently', () => {
    const state = click(initialState(), 'b1', 'b3');

    expect(shown(state, 'b1')).toMatchObject({ role: 'active', look: 'slow', label: 'active, struggling', note: 'requests waiting' });
    expect(shown(state, 'b3')).toMatchObject({ role: 'standby', look: 'slow', label: 'standby, struggling' });
    expect(shown(state, 'b2')).toMatchObject({ role: 'active', look: 'ok', label: 'active', note: '55% in use' });
  });

  it('shows, on the standby, the sum the monitor is weighing', () => {
    const roomy = click(initialState(), 'a1');
    expect(shown(roomy, 'a3')).toMatchObject({ note: 'room: 25% + 30% = 55%', noteTone: 'good', bar: 25, ghost: 30, ghostFits: true });
    // A struggling node that still carries work is flat out.
    expect(shown(roomy, 'a1')).toMatchObject({ bar: 100, ghost: 0 });

    const busy = click(initialState(), 'b1');
    expect(shown(busy, 'b3')).toMatchObject({
      note: 'would be worse: 70% + 45% = 115%',
      noteTone: 'warn',
      bar: 70,
      // Only what is left of the bar: the rest of the work would not fit.
      ghost: 30,
      ghostFits: false,
    });
    expect(shown(initialState(), 'b3')).toMatchObject({ note: '70% in use', noteTone: 'plain', ghost: 0 });
  });

  it('says how many clients are affected and for how long', () => {
    const one = advance(click(initialState(), 'a1'), 1_600);
    expect(view(one).clusters[0]).toMatchObject({ status: 'half the clients slowed · 2 min', tone: 'warn' });
    expect(view(one).clusters[1]).toMatchObject({ status: 'serving every client', tone: 'good' });

    const both = click(initialState(), 'a1', 'a2', 'a2');
    expect(view(both).clusters[0]).toMatchObject({ status: 'every client waiting · 1 min', tone: 'bad' });
    expect(shown(both, 'a2').note).toBe('its work is stuck');
  });

  it('counts down to the next check', () => {
    const hurt = click(initialState(), 'a1');

    expect(view(hurt)).toMatchObject({ countdownText: 'Monitor looks again in 3 s', countdown: 0, monitorLabel: 'Monitor is on' });
    expect(view(advance(hurt, 1_500))).toMatchObject({ countdownText: 'Monitor looks again in 2 s', countdown: 50 });
    expect(view(toggleMonitor(hurt)).monitorLabel).toBe('Monitor is off');
  });
});

describe('the longest text each part can show', () => {
  it('is found by walking every state, so the page can hold room for it', () => {
    const longest = longestTexts(['a', 'b']);

    expect(longest).toMatchObject({
      label: 'standby, struggling',
      note: 'requests waiting · a person was called',
      action: 'Click to slow it',
      countdown: 'The monitor checks every 3 s. Click a node to see it act.',
    });
    // One line of each kind: you, heal, forced, refuse, note and quiet.
    expect(longest.lines).toHaveLength(6);
    expect(longest.lines.some((line) => line.includes('would be in worse condition (135% + 45% = 180%)'))).toBe(true);
  });

  it('keeps to the clusters it is asked about, and allows for a long wait', () => {
    const lines = longestTexts(['a']).lines;

    expect(lines.join(' ')).not.toMatch(/\bb[123]\b|Cluster B/);
    // A wait of ten minutes or more makes a line longer than the same line after three.
    expect(lines.find((line) => line.includes('is completely down'))).toMatch(/Clients waited \d{2,} min\./);
  });
});
