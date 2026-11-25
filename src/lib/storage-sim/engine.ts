// A small simulation of a self-healing storage monitor. Each cluster has two active nodes, which
// share its work, and one standby: a common layout for a Ceph file system's metadata servers. The
// visitor hurts a node, and the monitor, which looks every few seconds, decides what to do:
//
//   - the standby would have room: move the work there.
//   - the node is completely down and the standby is busy: move it anyway and flag the standby,
//     because a slow node is better than a dead one.
//   - the node is only struggling and the standby would be worse off: refuse, and call a person.
//
// After a move the two nodes swap roles. A repaired node stays the standby: the work does not move
// back by itself. The clusters, names, loads and timings are made up for the page. None of it is
// taken from a real system.
//
// Everything here is pure: state in, state out, with the time passed in. The page
// (storage-sim-ui.ts) owns the clock and the DOM. The unit tests run whole checks with no timers.

/** The monitor looks at every cluster this often. */
export const CHECK_EVERY_MS = 3_000;
/** One second on the page stands for one minute of clients waiting. */
const MS_PER_MINUTE = 1_000;
/** How long a failure has to sit with the monitor off before the last mission counts. */
const BY_HAND_AFTER_MS = 4_000;
const LOG_LIMIT = 5;
/**
 * A struggling standby counts as this much busier than its number says. It is large enough that
 * no struggling standby ever "has room": with less, two struggling nodes in Cluster A would hand
 * the same work back and forth on every check.
 */
const STRUGGLING_PENALTY = 65;

export type Role = 'active' | 'standby';
/** 'slow' is struggling but still up. 'down' has failed completely. */
export type Health = 'ok' | 'slow' | 'down';

export interface SimNode {
  id: string;
  role: Role;
  health: Health;
  /** Share of this node's capacity already used by other work, in percent. */
  base: number;
  /** True once the monitor has told a person about this node, so it says so only once. */
  escalated: boolean;
  /** Whether the monitor has already dealt with this node as a hurt standby. */
  reported: boolean;
}

export interface SimCluster {
  id: string;
  name: string;
  about: string;
  /** Share of a node's capacity that each active node's part of the work needs, in percent. */
  demand: number;
  /** How long clients of a hurt active node have been waiting. */
  waitedMs: number;
  nodes: SimNode[];
}

export type LogKind = 'you' | 'heal' | 'forced' | 'refuse' | 'note' | 'quiet';

export interface LogEntry {
  /** Counts up with every new line. A quiet line that is only updated keeps its id. */
  id: number;
  kind: LogKind;
  text: string;
}

export const MISSIONS = [
  {
    id: 'heal',
    text: 'Click an active node in Cluster A.',
    why: 'Its standby has room, so the work moves within one check.',
  },
  {
    id: 'refuse',
    text: 'Click b1 in Cluster B once, so it struggles.',
    why: 'Its standby b3 would be in worse condition, so the monitor says no and tells you why.',
  },
  {
    id: 'forced',
    text: 'Click b1 again, so it is completely down.',
    why: 'Now even a busy b3 is better than a dead node, so the monitor moves the work.',
  },
  {
    id: 'byHand',
    text: 'Turn the monitor off, then click an active node.',
    why: 'The wait keeps growing until you repair it yourself.',
  },
] as const;

export type MissionId = (typeof MISSIONS)[number]['id'];

export interface SimState {
  /** Simulated time since something went wrong. It stands still while every node is healthy. */
  clockMs: number;
  monitorOn: boolean;
  checks: number;
  healed: number;
  refusals: number;
  done: Record<MissionId, boolean>;
  clusters: SimCluster[];
  /** Newest first, at most five lines. */
  log: LogEntry[];
  /** How many lines have been said in all. */
  said: number;
}

function node(id: string, role: Role, base: number): SimNode {
  return { id, role, health: 'ok', base, escalated: false, reported: false };
}

export function initialState(): SimState {
  return {
    clockMs: 0,
    monitorOn: true,
    checks: 0,
    healed: 0,
    refusals: 0,
    done: { heal: false, refuse: false, forced: false, byHand: false },
    clusters: [
      {
        id: 'a',
        name: 'Cluster A',
        about: 'its standby has room',
        demand: 30,
        waitedMs: 0,
        nodes: [node('a1', 'active', 10), node('a2', 'active', 15), node('a3', 'standby', 25)],
      },
      {
        id: 'b',
        name: 'Cluster B',
        about: 'its standby is busy',
        demand: 45,
        waitedMs: 0,
        nodes: [node('b1', 'active', 15), node('b2', 'active', 10), node('b3', 'standby', 70)],
      },
    ],
    log: [{ id: 0, kind: 'note', text: 'Nothing is wrong yet. Click a node to slow it down.' }],
    said: 0,
  };
}

/** Percent of capacity a node is using now: its other work, plus its part of the cluster's work if it is active. */
export function loadOf(cluster: SimCluster, target: SimNode): number {
  if (target.health === 'down') return 0;
  return target.base + (target.role === 'active' ? cluster.demand : 0);
}

/** How busy a standby is before it takes anything on. */
export function busyOf(target: SimNode): number {
  return target.base + (target.health === 'slow' ? STRUGGLING_PENALTY : 0);
}

/** What a standby would be carrying if it took one active node's part of the work. */
export function wouldCarry(cluster: SimCluster, standby: SimNode): number {
  return busyOf(standby) + cluster.demand;
}

/** An active node the monitor has to do something about: hurt, or healthy but carrying more than it can. */
export function needsHelp(cluster: SimCluster, target: SimNode): boolean {
  return target.role === 'active' && (target.health !== 'ok' || loadOf(cluster, target) > 100);
}

/** True while every node is healthy and within its capacity. Time does not pass then. */
export function isIdle(state: SimState): boolean {
  return state.clusters.every((cluster) =>
    cluster.nodes.every((member) => member.health === 'ok' && !needsHelp(cluster, member)),
  );
}

function minutes(cluster: SimCluster): number {
  return Math.max(1, Math.round(cluster.waitedMs / MS_PER_MINUTE));
}

function hasHurtActive(cluster: SimCluster): boolean {
  return cluster.nodes.some((member) => member.role === 'active' && member.health !== 'ok');
}

// Each change works on its own copy of the state, so the state passed in is never touched.
function copy(state: SimState): SimState {
  return {
    ...state,
    done: { ...state.done },
    clusters: state.clusters.map((cluster) => ({ ...cluster, nodes: cluster.nodes.map((member) => ({ ...member })) })),
    log: [...state.log],
  };
}

function say(draft: SimState, kind: LogKind, text: string): void {
  draft.said += 1;
  draft.log = [{ id: draft.said, kind, text }, ...draft.log].slice(0, LOG_LIMIT);
}

/** The visitor's click on a node: one slows it, a second fails it completely, a third repairs it. */
export function toggleNode(state: SimState, nodeId: string): SimState {
  const draft = copy(state);
  const cluster = draft.clusters.find((candidate) => candidate.nodes.some((member) => member.id === nodeId));
  const target = cluster?.nodes.find((member) => member.id === nodeId);
  if (!cluster || !target) return state;

  // The first thing to go wrong starts the clock, so the monitor's next look is a full wait away.
  if (isIdle(draft)) draft.clockMs = 0;
  // Anything the visitor changes is worth a fresh look, and a fresh call to a person if it comes to that.
  for (const member of cluster.nodes) member.escalated = false;
  target.reported = false;

  const what = target.role === 'active' ? 'an active node' : 'the standby';
  const monitor =
    target.role !== 'active'
      ? ''
      : draft.monitorOn
        ? ' The monitor has not looked yet.'
        : ' The monitor is off, so nothing will move its work.';
  if (target.health === 'ok') {
    target.health = 'slow';
    say(draft, 'you', `You slowed ${target.id}, ${what} in ${cluster.name}. It is struggling but still up.${monitor}`);
  } else if (target.health === 'slow') {
    target.health = 'down';
    say(draft, 'you', `You failed ${target.id} completely.${monitor}`);
  } else {
    target.health = 'ok';
    say(
      draft,
      'you',
      target.role === 'active'
        ? `You repaired ${target.id}. It is carrying its work again.`
        : `You repaired ${target.id}. It is the standby now. The work stays where it is, and ${target.id} is ready if another node fails.`,
    );
  }
  // A wait belongs to one failure: the next one starts from nothing.
  if (!hasHurtActive(cluster)) cluster.waitedMs = 0;
  return draft;
}

/** Turn the monitor off, to see on-call by hand, or back on. */
export function toggleMonitor(state: SimState): SimState {
  const draft = copy(state);
  draft.monitorOn = !draft.monitorOn;
  say(
    draft,
    'you',
    draft.monitorOn
      ? 'You turned the monitor back on. It looks at every cluster on its next check.'
      : 'You turned the monitor off. This is on-call by hand.',
  );
  return draft;
}

// One look at every cluster. Works on a draft that advance() has already copied.
function check(draft: SimState): void {
  draft.checks += 1;
  let spoke = false;

  for (const cluster of draft.clusters) {
    for (const hurt of cluster.nodes) {
      if (!needsHelp(cluster, hurt)) continue;
      const word = hurt.health === 'down' ? 'down' : hurt.health === 'slow' ? 'struggling' : 'overloaded';
      const standby = cluster.nodes.find((member) => member.role === 'standby');
      const waited = minutes(cluster);

      if (!standby || standby.health === 'down') {
        if (!hurt.escalated) {
          hurt.escalated = true;
          draft.refusals += 1;
          say(
            draft,
            'refuse',
            `${hurt.id} is ${word} and ${cluster.name} has no working standby to take its work. The monitor is waiting for a person.`,
          );
          spoke = true;
        }
        continue;
      }

      const total = wouldCarry(cluster, standby);
      const sum = `${busyOf(standby)}% + ${cluster.demand}% = ${total}%`;
      const move = (): void => {
        standby.role = 'active';
        hurt.role = 'standby';
        hurt.escalated = false;
        // Its work is somewhere safe now, so there is nothing more to report about it.
        hurt.reported = true;
        draft.healed += 1;
        spoke = true;
      };

      if (total <= 100) {
        const wasHurt = hurt.health !== 'ok';
        move();
        if (wasHurt) draft.done.heal = true;
        say(
          draft,
          'heal',
          `${hurt.id} was ${word}. ${standby.id} had room (${sum}), so the monitor moved the work there and checked the cluster's own log to confirm it.` +
            (wasHurt ? ` Clients waited ${waited} min.` : ''),
        );
      } else if (hurt.health === 'down') {
        // A busy standby is still in better condition than a dead node.
        move();
        standby.escalated = true;
        draft.done.forced = true;
        say(
          draft,
          'forced',
          `${hurt.id} is completely down. ${standby.id} is busy (${sum}), but a slow node is better than a dead one, so the monitor moved the work there and flagged ${standby.id} as overloaded. Clients waited ${waited} min. Repair ${hurt.id}.`,
        );
      } else if (!hurt.escalated) {
        hurt.escalated = true;
        draft.refusals += 1;
        draft.done.refuse = true;
        say(
          draft,
          'refuse',
          `${hurt.id} is ${word} but still up, and ${standby.id} would be in worse condition (${sum}). Moving the work would trade a slow node for an overloaded one, so the monitor left it where it is and called a person.`,
        );
        spoke = true;
      }
    }

    for (const member of cluster.nodes) {
      if (member.role !== 'standby' || member.health === 'ok' || member.reported) continue;
      member.reported = true;
      say(
        draft,
        'note',
        `${member.id}, a standby, is ${member.health === 'down' ? 'down' : 'struggling'}. No work is waiting on it, so there is nothing to move. Reported, so someone looks at it.`,
      );
      spoke = true;
    }
  }

  if (spoke) return;
  // Checks with nothing to do share one line, which only counts up.
  const text = `Check ${draft.checks}: nothing new to do.`;
  const newest = draft.log[0];
  if (newest?.kind === 'quiet') draft.log[0] = { ...newest, text };
  else say(draft, 'quiet', text);
}

/**
 * Move the simulation forward by `elapsedMs`. Time passes only while something is wrong, and the
 * monitor, when it is on, looks each time the clock reaches a multiple of CHECK_EVERY_MS.
 */
export function advance(state: SimState, elapsedMs: number): SimState {
  if (elapsedMs <= 0 || isIdle(state)) return state;
  const draft = copy(state);
  let left = elapsedMs;
  while (left > 0 && !isIdle(draft)) {
    const untilCheck = CHECK_EVERY_MS - (draft.clockMs % CHECK_EVERY_MS);
    const step = Math.min(left, untilCheck);
    left -= step;
    draft.clockMs += step;
    for (const cluster of draft.clusters) {
      cluster.waitedMs = hasHurtActive(cluster) ? cluster.waitedMs + step : 0;
      if (!draft.monitorOn && cluster.waitedMs >= BY_HAND_AFTER_MS) draft.done.byHand = true;
    }
    if (step === untilCheck && draft.monitorOn) check(draft);
  }
  return draft;
}

// ---------- What the page shows ----------
//
// The words and numbers for one state, worked out in one place so the first picture (rendered at
// build time) and every later one (drawn by the script) cannot disagree.

export type Tone = 'plain' | 'good' | 'warn' | 'bad';

export interface NodeView {
  id: string;
  role: Role;
  /** What the node is drawn as: its health, or 'over' for a healthy node carrying more than it can. */
  look: Health | 'over';
  /** The role, and the state when it is not healthy: "standby, struggling". */
  label: string;
  note: string;
  noteTone: Tone;
  /** What the next click does. */
  action: string;
  /** The accessible name: id, role, state and what a click does. */
  name: string;
  pressed: boolean;
  /** Percent of the bar that is filled. */
  bar: number;
  /** Percent the standby would take on, drawn after the bar while the monitor weighs a move. */
  ghost: number;
  ghostFits: boolean;
}

export interface ClusterView {
  id: string;
  name: string;
  about: string;
  status: string;
  tone: Exclude<Tone, 'plain'>;
  nodes: NodeView[];
}

export interface SimView {
  clusters: ClusterView[];
  monitorOn: boolean;
  monitorLabel: string;
  countdownText: string;
  /** How far through the wait for the next check, in percent. */
  countdown: number;
  healed: number;
  refusals: number;
  missions: { id: MissionId; text: string; why: string; done: boolean }[];
  log: LogEntry[];
}

function viewNode(state: SimState, cluster: SimCluster, target: SimNode, pending: boolean): NodeView {
  const load = loadOf(cluster, target);
  const standby = target.role === 'standby';
  const overloaded = target.health === 'ok' && load > 100;
  // While an active node needs help, the standby shows the sum the monitor is doing.
  const weighing = standby && target.health !== 'down' && pending && state.monitorOn;
  const busy = busyOf(target);
  const total = wouldCarry(cluster, target);
  const fits = total <= 100;

  let note = `${load}% in use`;
  let noteTone: Tone = 'plain';
  if (target.health === 'down') {
    note = target.escalated ? 'waiting for a person' : standby ? 'carries no work' : 'its work is stuck';
    noteTone = 'bad';
  } else if (weighing) {
    note = `${fits ? 'room' : 'would be worse'}: ${busy}% + ${cluster.demand}% = ${total}%`;
    noteTone = fits ? 'good' : 'warn';
  } else if (target.health === 'slow') {
    note = standby ? 'carries no work' : target.escalated ? 'requests waiting · a person was called' : 'requests waiting';
    noteTone = 'warn';
  } else if (overloaded) {
    note = `${load}% · overloaded`;
    noteTone = 'warn';
  }

  const stateWord = target.health === 'down' ? 'failed' : target.health === 'slow' ? 'struggling' : `${load}% in use`;
  const action =
    target.health === 'ok' ? 'Click to slow it' : target.health === 'slow' ? 'Click to fail it' : 'Click to repair';
  // A struggling node that still carries work is flat out. A struggling standby shows how busy it counts as.
  const bar = target.health === 'slow' && !standby ? 100 : Math.min(target.health === 'slow' ? busy : load, 100);

  return {
    id: target.id,
    role: target.role,
    look: overloaded ? 'over' : target.health,
    label: target.health === 'ok' ? target.role : `${target.role}, ${stateWord}`,
    note,
    noteTone,
    action,
    name: `${target.id}, ${target.role}, ${stateWord}. ${action}.`,
    pressed: target.health !== 'ok',
    bar,
    ghost: weighing ? Math.max(0, Math.min(cluster.demand, 100 - Math.min(busy, 100))) : 0,
    ghostFits: fits,
  };
}

function viewCluster(state: SimState, cluster: SimCluster): ClusterView {
  const actives = cluster.nodes.filter((member) => member.role === 'active');
  const down = actives.filter((member) => member.health === 'down').length;
  const slow = actives.filter((member) => member.health === 'slow').length;
  const over = actives.some((member) => member.health === 'ok' && loadOf(cluster, member) > 100);
  const pending = cluster.nodes.some((member) => needsHelp(cluster, member));
  // Two active nodes share the work, so one hurt node is half the clients.
  const share = down + slow === 1 ? 'half the clients' : 'every client';

  let status = 'serving every client';
  let tone: ClusterView['tone'] = 'good';
  if (down > 0) {
    status = `${share} waiting · ${minutes(cluster)} min`;
    tone = 'bad';
  } else if (slow > 0) {
    status = `${share} slowed · ${minutes(cluster)} min`;
    tone = 'warn';
  } else if (over) {
    status = 'serving every client, slowly';
    tone = 'warn';
  }

  return {
    id: cluster.id,
    name: cluster.name,
    about: cluster.about,
    status,
    tone,
    nodes: cluster.nodes.map((member) => viewNode(state, cluster, member, pending)),
  };
}

export function view(state: SimState): SimView {
  const idle = isIdle(state);
  const into = idle ? 0 : state.clockMs % CHECK_EVERY_MS;
  const seconds = Math.ceil((CHECK_EVERY_MS - into) / 1_000);

  return {
    clusters: state.clusters.map((cluster) => viewCluster(state, cluster)),
    monitorOn: state.monitorOn,
    monitorLabel: state.monitorOn ? 'Monitor is on' : 'Monitor is off',
    countdownText: !state.monitorOn
      ? 'Nothing is watching. Failures wait for a person.'
      : idle
        ? `The monitor checks every ${CHECK_EVERY_MS / 1_000} s. Click a node to see it act.`
        : `Monitor looks again in ${seconds} s`,
    countdown: state.monitorOn ? (into / CHECK_EVERY_MS) * 100 : 0,
    healed: state.healed,
    refusals: state.refusals,
    missions: MISSIONS.map((mission) => ({ ...mission, done: state.done[mission.id] })),
    log: state.log,
  };
}

// ---------- Holding the page still ----------

export interface LongestTexts {
  label: string;
  note: string;
  action: string;
  countdown: string;
  /** The longest log line of each kind. A shorter line can still wrap onto more rows than a longer one of another kind. */
  lines: string[];
}

/**
 * The longest text each part of the page can ever show for these clusters, found by walking every
 * state a visitor can reach by clicking nodes, switching the monitor and waiting. The page keeps
 * an unseen copy of each under the real text, so nothing moves when a short text becomes a long one.
 */
export function longestTexts(clusterIds: string[]): LongestTexts {
  const longest = { label: '', note: '', action: '', countdown: '' };
  const lines = new Map<LogKind, string>();
  const keep = (part: keyof typeof longest, text: string): void => {
    if (text.length > longest[part].length) longest[part] = text;
  };
  const longWait = 10 * MS_PER_MINUTE;
  // Two states that look the same lead to the same places, whatever their clocks and logs say.
  // A wait of ten minutes or more is told apart, because its number is a character longer.
  const shape = (state: SimState): string =>
    JSON.stringify([
      state.monitorOn,
      state.clusters.map((cluster) => [
        cluster.waitedMs >= longWait,
        cluster.nodes.map((member) => [member.role, member.health, member.escalated, member.reported]),
      ]),
    ]);

  // Clusters do not affect one another, so each is walked by itself.
  for (const id of clusterIds) {
    const start = initialState();
    const nodeIds = start.clusters.find((cluster) => cluster.id === id)?.nodes.map((member) => member.id) ?? [];
    const moves: ((state: SimState) => SimState)[] = [
      ...nodeIds.map((nodeId) => (state: SimState) => toggleNode(state, nodeId)),
      toggleMonitor,
      (state) => advance(state, CHECK_EVERY_MS),
      (state) => advance(state, longWait + CHECK_EVERY_MS),
    ];
    const seen = new Set<string>();
    const queue = [start];
    for (let state = queue.pop(); state; state = queue.pop()) {
      const shown = view(state);
      keep('countdown', shown.countdownText);
      for (const member of shown.clusters.find((cluster) => cluster.id === id)?.nodes ?? []) {
        keep('label', member.label);
        keep('note', member.note);
        keep('action', member.action);
      }
      // What a move says is read here even when the state it leads to has been seen before.
      const said = state.log[0];
      if (said && said.text.length > (lines.get(said.kind)?.length ?? 0)) lines.set(said.kind, said.text);
      if (seen.has(shape(state))) continue;
      seen.add(shape(state));
      queue.push(...moves.map((move) => move(state)));
    }
  }
  return { ...longest, lines: [...lines.values()] };
}
