import { describe, expect, it } from 'vitest';
import {
  CYCLE_TICKS,
  FILES,
  FIXED_TICKS,
  FUSE_TICKS,
  TICK_MS,
  fixByHand,
  initialState,
  isBehind,
  isComparing,
  isSettled,
  pushUpdate,
  tick,
  toggleChecker,
  view,
  type DriftState,
} from '../../src/lib/drift-sim/engine';

/** Let `count` ticks pass with nobody touching anything. */
function after(state: DriftState, count: number): DriftState {
  let current = state;
  for (let n = 0; n < count; n++) current = tick(current);
  return current;
}

/** Every state from the one given until the simulation settles, the given one left out. */
function untilSettled(state: DriftState): DriftState[] {
  const seen: DriftState[] = [];
  let current = state;
  while (!isSettled(current)) {
    current = tick(current);
    seen.push(current);
    if (seen.length > 1_000) throw new Error('the simulation never settled');
  }
  return seen;
}

const checkerOff = () => toggleChecker(initialState());
/** A push with the checker off, left alone until the failover lands on it. */
const outage = () => after(pushUpdate(checkerOff()), FUSE_TICKS);

const CAUGHT =
  'The checker compared the two racks, saw the RF gateway rack was behind, pushed v2 and restarted its service. Nobody was affected.';
const RECOVERED =
  'The checker compared the two racks, saw the RF gateway rack was behind, pushed v2 and restarted its service. Subscribers are back.';
const OUTAGE =
  'A modem failover landed on the mismatch. The RF gateway rack is running old files against new ones, and subscribers are offline.';

describe('before anything is pushed', () => {
  it('starts with both racks on the same files, the checker on and nothing counted', () => {
    const state = initialState();

    expect(state).toMatchObject({ snc: 1, rf: 1, checkerOn: true, offline: false, caught: 0, outages: 0 });
    expect(state.message).toBe('Both racks have the same files. Push an update to start.');
    expect(view(state)).toMatchObject({
      status: 'agree',
      comparing: false,
      justFixed: false,
      sncVersion: 'v1',
      rfVersion: 'v1',
      rfTag: 'up to date',
      verdict: { mark: '=', text: 'They agree', note: 'both at v1' },
      impact: 'Subscribers online',
      fusePercent: 0,
      canPush: true,
      pushLabel: 'Push update v2',
      checkerLabel: 'Checker is on',
      checkerNote: 'Compares the two racks every 5 s.',
    });
    expect(FILES).toHaveLength(3);
  });

  it('is idle: time passing changes nothing until the visitor pushes an update', () => {
    const state = initialState();

    expect(isSettled(state)).toBe(true);
    expect(tick(state)).toBe(state);
    expect(after(state, 500)).toBe(state);
  });

  it('lists the three things to try, none of them done', () => {
    expect(view(initialState()).missions).toEqual([
      {
        done: false,
        text: 'Push an update and wait.',
        why: 'The checker brings the RF gateway rack up to date before any trouble.',
      },
      {
        done: false,
        text: 'Turn the checker off, then push an update.',
        why: 'Nobody notices the mismatch, and subscribers go offline.',
      },
      {
        done: false,
        text: 'Turn the checker back on.',
        why: 'It finds the rack that is behind and brings subscribers back.',
      },
    ]);
  });
});

describe('pushing an update', () => {
  it('reaches the SNC rack only, and starts the time until a failover lands on the mismatch', () => {
    const state = pushUpdate(initialState());

    expect(state).toMatchObject({ snc: 2, rf: 1, fuse: FUSE_TICKS, offline: false });
    expect(isBehind(state)).toBe(true);
    expect(isSettled(state)).toBe(false);
    expect(state.message).toBe(
      'You pushed v2. The SNC rack has it. The RF gateway rack has not received it yet. The checker compares them shortly.',
    );
    expect(view(state)).toMatchObject({
      status: 'behind',
      sncVersion: 'v2',
      rfVersion: 'v1',
      rfTag: 'has not received it yet',
      verdict: { mark: '≠', text: 'They disagree', note: 'v2 against v1' },
      impact: 'Nothing looks wrong yet. Trouble in 8 s',
      fusePercent: 100,
      checkerNote: 'Compares the two racks in 4 s',
    });
  });

  it('says so when nothing is comparing the racks', () => {
    const state = pushUpdate(checkerOff());

    expect(state.message).toBe(
      'You pushed v2. The SNC rack has it. The RF gateway rack has not received it yet, and nothing is comparing them.',
    );
    expect(view(state).checkerNote).toBe('Nothing is comparing the racks.');
  });

  it('is refused while the RF gateway rack is still behind', () => {
    const state = pushUpdate(initialState());

    expect(view(state)).toMatchObject({ canPush: false, pushLabel: 'Waiting for the RF gateway rack' });
    expect(pushUpdate(state)).toBe(state);
    expect(pushUpdate(outage())).toMatchObject({ snc: 2 });
  });

  it('offers the next version once the racks agree again', () => {
    const settled = after(pushUpdate(initialState()), 20);
    expect(view(settled)).toMatchObject({ canPush: true, pushLabel: 'Push update v3' });

    const again = pushUpdate(settled);
    expect(view(again)).toMatchObject({ sncVersion: 'v3', rfVersion: 'v2', verdict: { note: 'v3 against v2' } });
    expect(after(again, 7).message).toBe(CAUGHT.replace('v2', 'v3'));
  });
});

describe('the checker', () => {
  it('counts down to its pass, compares, and brings the RF gateway rack up to date before any trouble', () => {
    const pushed = pushUpdate(initialState());
    const notes = [pushed, ...Array.from({ length: 6 }, (_, n) => after(pushed, n + 1))].map((s) => view(s).checkerNote);

    expect(notes).toEqual([
      'Compares the two racks in 4 s',
      'Compares the two racks in 3 s',
      'Compares the two racks in 3 s',
      'Compares the two racks in 2 s',
      'Compares the two racks in 2 s',
      'Comparing the two racks now',
      'Comparing the two racks now',
    ]);
    const comparing = after(pushed, 6);
    expect(isComparing(comparing)).toBe(true);
    expect(view(comparing)).toMatchObject({ comparing: true, verdict: { text: 'They disagree', note: 'checker is comparing' } });

    const fixed = after(pushed, 7);
    expect(fixed).toMatchObject({ snc: 2, rf: 2, offline: false, fuse: 0, caught: 1, outages: 0 });
    expect(fixed.done).toEqual({ caught: true, outage: false, recovered: false });
    expect(fixed.message).toBe(CAUGHT);
    expect(view(fixed)).toMatchObject({
      status: 'agree',
      comparing: false,
      justFixed: true,
      rfVersion: 'v2',
      rfTag: 'updated and restarted',
      verdict: { mark: '=', text: 'They agree', note: 'both at v2' },
      impact: 'Subscribers online',
      fusePercent: 0,
      checkerNote: 'Compares the two racks every 5 s.',
    });
  });

  it('drops the "updated and restarted" mark after a few seconds, and then nothing moves', () => {
    const fixed = after(pushUpdate(initialState()), 7);

    expect(view(after(fixed, FIXED_TICKS - 1))).toMatchObject({ justFixed: true, rfTag: 'updated and restarted' });
    const settled = after(fixed, FIXED_TICKS);
    expect(view(settled)).toMatchObject({ justFixed: false, rfTag: 'up to date' });
    expect(isSettled(settled)).toBe(true);
    expect(after(settled, 100)).toBe(settled);
    expect(settled.message).toBe(CAUGHT);
  });

  it('can be turned off and on while the racks agree, and time still stands still', () => {
    const off = checkerOff();
    expect(off.message).toBe('You turned the checker off. A mismatch will now sit there unseen.');
    expect(view(off)).toMatchObject({ checkerLabel: 'Checker is off', checkerNote: 'Nothing is comparing the racks.' });
    expect(isSettled(off)).toBe(true);

    const on = toggleChecker(off);
    expect(on.message).toBe('You turned the checker back on. It compares the two racks on its next pass.');
    expect(view(on)).toMatchObject({ checkerLabel: 'Checker is on', checkerNote: 'Compares the two racks every 5 s.' });
    expect(after(on, 50)).toBe(on);
  });

  it('still catches the mismatch when it is turned on before its pass', () => {
    const state = after(toggleChecker(after(pushUpdate(checkerOff()), 3)), 4);

    expect(state).toMatchObject({ rf: 2, caught: 1, outages: 0, message: CAUGHT });
  });

  it('is too late when it is turned on after its pass: the failover lands first, then the next pass repairs it', () => {
    const late = toggleChecker(after(pushUpdate(checkerOff()), 8));

    const down = after(late, FUSE_TICKS - 8);
    expect(down).toMatchObject({ offline: true, outages: 1, message: OUTAGE });
    const back = tick(down);
    expect(back).toMatchObject({ offline: false, rf: 2, caught: 0, outages: 1, message: RECOVERED });
    expect(back.done).toEqual({ caught: false, outage: true, recovered: true });
  });
});

describe('with the checker off', () => {
  it('leaves the mismatch unseen while the time runs out', () => {
    const pushed = pushUpdate(checkerOff());

    expect(view(after(pushed, 1))).toMatchObject({ impact: 'Nothing looks wrong yet. Trouble in 8 s', comparing: false });
    expect(view(after(pushed, 2)).impact).toBe('Nothing looks wrong yet. Trouble in 7 s');
    expect(view(after(pushed, 8))).toMatchObject({ fusePercent: 50, impact: 'Nothing looks wrong yet. Trouble in 4 s' });
    const last = after(pushed, FUSE_TICKS - 1);
    expect(last).toMatchObject({ offline: false, outages: 0 });
    expect(view(last)).toMatchObject({ status: 'behind', impact: 'Nothing looks wrong yet. Trouble in 1 s' });
  });

  it('takes subscribers offline when the failover lands on it', () => {
    const state = outage();

    expect(state).toMatchObject({ snc: 2, rf: 1, offline: true, outages: 1, caught: 0, message: OUTAGE });
    expect(state.done).toEqual({ caught: false, outage: true, recovered: false });
    expect(view(state)).toMatchObject({
      status: 'offline',
      rfTag: 'old files in use',
      verdict: { mark: '≠', text: 'They disagree', note: 'v2 against v1' },
      impact: 'Subscribers offline',
      fusePercent: 0,
      canPush: false,
      pushLabel: 'Waiting for the RF gateway rack',
    });
  });

  it('then waits for the visitor: nothing is looking, so nothing more happens', () => {
    const state = outage();

    expect(isSettled(state)).toBe(true);
    expect(after(state, 500)).toBe(state);
  });

  it('is repaired by the checker as soon as it is turned back on', () => {
    const on = toggleChecker(outage());
    expect(on.message).toBe('You turned the checker back on. It compares the two racks on its next pass.');
    expect(isSettled(on)).toBe(false);
    expect(view(on)).toMatchObject({ status: 'offline', comparing: true, checkerNote: 'Comparing the two racks now' });

    const back = untilSettled(on);
    expect(back[0]).toMatchObject({ rf: 2, offline: false, outages: 1, caught: 0, message: RECOVERED });
    expect(back[0]?.done).toEqual({ caught: false, outage: true, recovered: true });
    expect(view(back[0]!)).toMatchObject({ status: 'agree', rfTag: 'updated and restarted', impact: 'Subscribers online' });
    expect(back.length * TICK_MS).toBeLessThanOrEqual(5_000);
  });
});

describe('pushing the files by hand', () => {
  it('ends the mismatch at once, and counts for nothing: no check found it', () => {
    const state = fixByHand(after(pushUpdate(checkerOff()), 4));

    expect(state).toMatchObject({ snc: 2, rf: 2, offline: false, fuse: 0, caught: 0, outages: 0 });
    expect(state.done).toEqual({ caught: false, outage: false, recovered: false });
    expect(state.message).toBe('You pushed the files to the RF gateway rack by hand.');
    expect(view(state)).toMatchObject({ status: 'agree', rfTag: 'up to date', justFixed: false, pushLabel: 'Push update v3' });
    expect(isSettled(state)).toBe(true);
  });

  it('brings subscribers back after an outage, without ticking off the mission that belongs to the checker', () => {
    const state = fixByHand(outage());

    expect(state).toMatchObject({ rf: 2, offline: false, outages: 1, caught: 0 });
    expect(state.done).toEqual({ caught: false, outage: true, recovered: false });
    expect(state.message).toBe('You pushed the files to the RF gateway rack by hand. Subscribers are back.');
    expect(view(state).impact).toBe('Subscribers online');
  });

  it('does nothing while the racks agree', () => {
    const state = initialState();

    expect(fixByHand(state)).toBe(state);
  });
});

describe('the whole story', () => {
  it('ticks off the three things to try in the order the page lists them', () => {
    const done = (state: DriftState) => view(state).missions.map((mission) => mission.done);
    let state = initialState();

    state = after(pushUpdate(state), 20);
    expect(done(state)).toEqual([true, false, false]);

    state = after(pushUpdate(toggleChecker(state)), 20);
    expect(done(state)).toEqual([true, true, false]);
    expect(view(state)).toMatchObject({ status: 'offline', sncVersion: 'v3', rfVersion: 'v2' });

    state = after(toggleChecker(state), 20);
    expect(done(state)).toEqual([true, true, true]);
    expect(state).toMatchObject({ snc: 3, rf: 3, caught: 1, outages: 1, offline: false });
    expect(isSettled(state)).toBe(true);
  });

  it('never runs for more than a few seconds after the last thing the visitor did', () => {
    const withChecker = untilSettled(pushUpdate(initialState()));
    const without = untilSettled(pushUpdate(checkerOff()));
    const repair = untilSettled(toggleChecker(outage()));

    expect(withChecker.length * TICK_MS).toBe(6_500);
    expect(without.length * TICK_MS).toBe(FUSE_TICKS * TICK_MS);
    expect(Math.max(withChecker.length, without.length, repair.length) * TICK_MS).toBeLessThanOrEqual(8_000);
    // The checker's first pass after a push always comes before the failover does.
    expect(withChecker.every((state) => !state.offline)).toBe(true);
    expect(CYCLE_TICKS).toBeLessThan(FUSE_TICKS);
  });

  it('starts over on reset: a fresh state that shares nothing with the old one', () => {
    const used = after(toggleChecker(outage()), 3);
    const fresh = initialState();

    expect(fresh).toEqual(initialState());
    expect(fresh).not.toBe(initialState());
    expect(fresh.done).not.toBe(used.done);
    expect(view(fresh)).toMatchObject({ pushLabel: 'Push update v2', checkerLabel: 'Checker is on' });
    expect(view(fresh).missions.every((mission) => !mission.done)).toBe(true);
  });

  it('changes nothing it is given', () => {
    const frozen = <T extends object>(value: T): T => {
      for (const part of Object.values(value)) if (part && typeof part === 'object') Object.freeze(part);
      return Object.freeze(value);
    };
    const start = frozen(initialState());
    const pushed = frozen(pushUpdate(start));
    const off = frozen(toggleChecker(pushed));

    expect(() => after(off, FUSE_TICKS)).not.toThrow();
    expect(() => fixByHand(off)).not.toThrow();
    expect(start).toEqual(initialState());
  });

  it('never puts a semicolon in front of a visitor', () => {
    const words = (state: DriftState) => JSON.stringify([state.message, view(state)]);
    const story = [
      initialState(),
      ...untilSettled(pushUpdate(initialState())),
      checkerOff(),
      pushUpdate(checkerOff()),
      ...untilSettled(pushUpdate(checkerOff())),
      toggleChecker(outage()),
      ...untilSettled(toggleChecker(outage())),
      fixByHand(outage()),
    ];

    for (const state of story) expect(words(state)).not.toContain(';');
  });
});
