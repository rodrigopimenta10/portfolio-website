// A small simulation of configuration drift: two racks that must hold the same files, an update
// that reaches one of them first, and a checker that compares them on a cycle and brings the one
// that is behind up to date. With the checker off the mismatch does no harm until a modem failover
// lands on it, and then subscribers go offline.
//
// The racks, the file names, the versions and the timings are made up for the page. None of it is
// taken from a real system.
//
// Everything here is pure: state in, state out. Time is counted in ticks and only passes when
// tick() is called. The page (drift-sim-ui.ts) owns the clock and the DOM, and the unit tests run
// whole stories with no timers at all.

/** How long one tick stands for. */
export const TICK_MS = 500;
/** The checker makes one pass per cycle. */
export const CYCLE_TICKS = 10;
// A pass opens the cycle: the checker compares for this many ticks and acts on the last of them.
const COMPARE_TICKS = 3;
/** How long a mismatch stays harmless: the time until a modem failover lands on it. */
export const FUSE_TICKS = 16;
/** How long the rack keeps its "updated and restarted" mark after the checker has fixed it. */
export const FIXED_TICKS = 6;
// A push lands in the middle of a cycle, so the checker's next pass is a few seconds away and the
// mismatch is on screen long enough to be seen.
const PUSH_AT_TICK = 5;

export const FILES = ['config file 1', 'config file 2', 'config file 3'] as const;

export interface DriftState {
  /** Where the checker's cycle is. It stands still while the simulation is settled. */
  ticks: number;
  checkerOn: boolean;
  /** Version of the files on the SNC rack, which gets every update first. */
  snc: number;
  /** Version of the files on the RF gateway rack. */
  rf: number;
  /** Ticks left before a failover lands on the mismatch. */
  fuse: number;
  offline: boolean;
  /** Ticks left of the "updated and restarted" mark. */
  fixed: number;
  /** Mismatches the checker fixed before anyone was affected. */
  caught: number;
  outages: number;
  /** The three things to try, in the order the page lists them. */
  done: { caught: boolean; outage: boolean; recovered: boolean };
  /** The last thing that happened, in words. */
  message: string;
}

export function initialState(): DriftState {
  return {
    ticks: 0,
    checkerOn: true,
    snc: 1,
    rf: 1,
    fuse: 0,
    offline: false,
    fixed: 0,
    caught: 0,
    outages: 0,
    done: { caught: false, outage: false, recovered: false },
    message: 'Both racks have the same files. Push an update to start.',
  };
}

/** True while the RF gateway rack does not have the files the SNC rack has. */
export function isBehind(state: DriftState): boolean {
  return state.rf !== state.snc;
}

/** True while the checker is on its pass over a mismatch. */
export function isComparing(state: DriftState): boolean {
  return state.checkerOn && isBehind(state) && state.ticks % CYCLE_TICKS < COMPARE_TICKS;
}

/**
 * True when more time changes nothing: the racks agree and no mark is fading, or subscribers are
 * offline and nothing is looking. The page stops its clock here and waits for the visitor.
 */
export function isSettled(state: DriftState): boolean {
  if (!isBehind(state)) return state.fixed <= 0;
  return state.offline && !state.checkerOn;
}

/** One tick of time. */
export function tick(state: DriftState): DriftState {
  if (isSettled(state)) return state;
  const next: DriftState = { ...state, ticks: state.ticks + 1, fixed: Math.max(0, state.fixed - 1) };
  if (!isBehind(next)) return next;

  if (next.checkerOn && next.ticks % CYCLE_TICKS === COMPARE_TICKS - 1) {
    const wasOffline = next.offline;
    const did = `The checker compared the two racks, saw the RF gateway rack was behind, pushed v${next.snc} and restarted its service.`;
    return {
      ...next,
      rf: next.snc,
      fuse: 0,
      offline: false,
      fixed: FIXED_TICKS,
      caught: wasOffline ? next.caught : next.caught + 1,
      done: wasOffline ? { ...next.done, recovered: true } : { ...next.done, caught: true },
      message: `${did} ${wasOffline ? 'Subscribers are back.' : 'Nobody was affected.'}`,
    };
  }

  if (next.offline) return next;
  const fuse = next.fuse - 1;
  if (fuse > 0) return { ...next, fuse };
  return {
    ...next,
    fuse: 0,
    offline: true,
    outages: next.outages + 1,
    done: { ...next.done, outage: true },
    message:
      'A modem failover landed on the mismatch. The RF gateway rack is running old files against new ones, and subscribers are offline.',
  };
}

/** The visitor pushes the next version. It reaches the SNC rack only. Refused while the racks disagree. */
export function pushUpdate(state: DriftState): DriftState {
  if (isBehind(state)) return state;
  const snc = state.snc + 1;
  const start = `You pushed v${snc}. The SNC rack has it. The RF gateway rack has not received it yet`;
  return {
    ...state,
    snc,
    ticks: PUSH_AT_TICK,
    fuse: FUSE_TICKS,
    fixed: 0,
    message: state.checkerOn ? `${start}. The checker compares them shortly.` : `${start}, and nothing is comparing them.`,
  };
}

/** The visitor copies the files over. It counts for nothing: no check found the mismatch. */
export function fixByHand(state: DriftState): DriftState {
  if (!isBehind(state)) return state;
  const did = 'You pushed the files to the RF gateway rack by hand.';
  return {
    ...state,
    rf: state.snc,
    fuse: 0,
    offline: false,
    message: state.offline ? `${did} Subscribers are back.` : did,
  };
}

export function toggleChecker(state: DriftState): DriftState {
  const checkerOn = !state.checkerOn;
  return {
    ...state,
    checkerOn,
    message: checkerOn
      ? 'You turned the checker back on. It compares the two racks on its next pass.'
      : 'You turned the checker off. A mismatch will now sit there unseen.',
  };
}

function seconds(ticks: number): number {
  return Math.ceil((ticks * TICK_MS) / 1000);
}

export interface Mission {
  done: boolean;
  text: string;
  why: string;
}

/** Everything the page shows that is worked out from the state. Colours follow `status`. */
export interface DriftView {
  status: 'agree' | 'behind' | 'offline';
  comparing: boolean;
  /** True while the RF gateway rack carries its "updated and restarted" mark. */
  justFixed: boolean;
  sncVersion: string;
  rfVersion: string;
  rfTag: string;
  verdict: { mark: string; text: string; note: string };
  impact: string;
  /** How much of the fuse is left, 0 to 100. Zero whenever no fuse is burning. */
  fusePercent: number;
  canPush: boolean;
  pushLabel: string;
  checkerLabel: string;
  checkerNote: string;
  missions: [Mission, Mission, Mission];
}

export function view(state: DriftState): DriftView {
  const behind = isBehind(state);
  const comparing = isComparing(state);
  const burning = behind && !state.offline;
  const justFixed = !behind && state.fixed > 0;
  const untilPass = (COMPARE_TICKS - 1 - (state.ticks % CYCLE_TICKS) + CYCLE_TICKS) % CYCLE_TICKS;

  return {
    status: state.offline ? 'offline' : behind ? 'behind' : 'agree',
    comparing,
    justFixed,
    sncVersion: `v${state.snc}`,
    rfVersion: `v${state.rf}`,
    rfTag: state.offline
      ? 'old files in use'
      : behind
        ? 'has not received it yet'
        : justFixed
          ? 'updated and restarted'
          : 'up to date',
    verdict: {
      mark: behind ? '≠' : '=',
      text: behind ? 'They disagree' : 'They agree',
      note: comparing ? 'checker is comparing' : behind ? `v${state.snc} against v${state.rf}` : `both at v${state.snc}`,
    },
    impact: state.offline
      ? 'Subscribers offline'
      : behind
        ? `Nothing looks wrong yet. Trouble in ${seconds(state.fuse)} s`
        : 'Subscribers online',
    fusePercent: burning ? Math.round((state.fuse / FUSE_TICKS) * 100) : 0,
    canPush: !behind,
    pushLabel: behind ? 'Waiting for the RF gateway rack' : `Push update v${state.snc + 1}`,
    checkerLabel: state.checkerOn ? 'Checker is on' : 'Checker is off',
    checkerNote: !state.checkerOn
      ? 'Nothing is comparing the racks.'
      : !behind
        ? `Compares the two racks every ${seconds(CYCLE_TICKS)} s.`
        : comparing
          ? 'Comparing the two racks now'
          : `Compares the two racks in ${seconds(untilPass)} s`,
    missions: [
      {
        done: state.done.caught,
        text: 'Push an update and wait.',
        why: 'The checker brings the RF gateway rack up to date before any trouble.',
      },
      {
        done: state.done.outage,
        text: 'Turn the checker off, then push an update.',
        why: 'Nobody notices the mismatch, and subscribers go offline.',
      },
      {
        done: state.done.recovered,
        text: 'Turn the checker back on.',
        why: 'It finds the rack that is behind and brings subscribers back.',
      },
    ],
  };
}
