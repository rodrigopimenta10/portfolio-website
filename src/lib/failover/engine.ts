// A small simulation of a self-healing monitor: nodes in clusters, a monitor that looks at them on
// a fixed cycle, moves work off a failed node when a standby can carry it, and refuses when none can.
//
// It is generic on purpose. The clusters, names, loads and timings are made up for the page; none
// of it is taken from a real system.
//
// Everything here is pure: state in, state out, with the time passed in. The page (failover-ui.ts)
// owns the clock and the DOM; the unit tests run whole cycles with no timers at all.

/** The monitor looks at every cluster once per cycle. */
export const CYCLE_MS = 6_000;
/** How long each step of a cycle takes in the simulation. */
export const STEP_MS = { probe: 250, assess: 350, failover: 700, verify: 400 } as const;
const LOG_LIMIT = 60;

export interface SimNode {
  id: string;
  role: 'active' | 'standby';
  healthy: boolean;
  /** Share of this node's capacity already used by other work, in percent. */
  base: number;
  failedAtMs: number | null;
  /** Whether the monitor has already logged that this standby is down. */
  reported: boolean;
}

export interface SimCluster {
  id: string;
  name: string;
  /** Share of a node's capacity the cluster's workload needs, in percent. */
  demand: number;
  /** True while the monitor has refused to fail over and is waiting for capacity or a person. */
  alert: boolean;
  detectedAtMs: number | null;
  nodes: SimNode[];
}

export type LogKind = 'manual' | 'detect' | 'assess' | 'act' | 'verify' | 'refuse' | 'recover' | 'note' | 'quiet';

export interface LogEntry {
  atMs: number;
  cycle: number;
  /** Set when identical quiet cycles in a row are folded into one line. */
  untilCycle?: number;
  kind: LogKind;
  text: string;
  mergeKey?: string;
}

export interface SimState {
  cycle: number;
  clusters: SimCluster[];
  log: LogEntry[];
}

type Phase =
  | { kind: 'probe'; cluster: string }
  | { kind: 'assess'; cluster: string }
  | { kind: 'failover'; cluster: string; to: string }
  | { kind: 'verify'; cluster: string; to: string }
  | { kind: 'finish' };

/** One cycle in progress: what is left to do, and whether anything worth logging has happened. */
export interface CycleRun {
  cycle: number;
  queue: Phase[];
  events: number;
}

function node(id: string, role: SimNode['role'], base: number): SimNode {
  return { id, role, healthy: true, base, failedAtMs: null, reported: false };
}

export function initialState(): SimState {
  return {
    cycle: 0,
    log: [],
    clusters: [
      {
        id: 'a',
        name: 'Cluster A',
        demand: 40,
        alert: false,
        detectedAtMs: null,
        nodes: [node('a1', 'active', 10), node('a2', 'standby', 25), node('a3', 'standby', 45)],
      },
      {
        id: 'b',
        name: 'Cluster B',
        demand: 50,
        alert: false,
        detectedAtMs: null,
        nodes: [node('b1', 'active', 10), node('b2', 'standby', 35), node('b3', 'standby', 70)],
      },
      {
        // One standby, and it is busy: failing c1 shows the monitor refusing.
        id: 'c',
        name: 'Cluster C',
        demand: 60,
        alert: false,
        detectedAtMs: null,
        nodes: [node('c1', 'active', 15), node('c2', 'standby', 65)],
      },
    ],
  };
}

/** Percent of capacity in use on a node: its other work, plus the cluster's workload if it is serving it. */
export function loadOf(cluster: SimCluster, target: SimNode): number {
  if (!target.healthy) return 0;
  return target.base + (target.role === 'active' ? cluster.demand : 0);
}

/** True when the cluster's workload is being served. */
export function isServing(cluster: SimCluster): boolean {
  return cluster.nodes.some((candidate) => candidate.role === 'active' && candidate.healthy);
}

function seconds(ms: number): string {
  return (ms / 1000).toFixed(1);
}

function append(state: SimState, entries: Omit<LogEntry, 'cycle'>[]): SimState {
  const log = [...state.log];
  for (const entry of entries) {
    const last = log[log.length - 1];
    if (entry.mergeKey && last?.mergeKey === entry.mergeKey) {
      log[log.length - 1] = { ...last, atMs: entry.atMs, untilCycle: state.cycle };
    } else {
      log.push({ ...entry, cycle: state.cycle });
    }
  }
  return { ...state, log: log.slice(-LOG_LIMIT) };
}

function mapCluster(state: SimState, id: string, change: (cluster: SimCluster) => SimCluster): SimState {
  return { ...state, clusters: state.clusters.map((cluster) => (cluster.id === id ? change(cluster) : cluster)) };
}

function mapNode(cluster: SimCluster, id: string, change: (target: SimNode) => SimNode): SimCluster {
  return { ...cluster, nodes: cluster.nodes.map((target) => (target.id === id ? change(target) : target)) };
}

function find(state: SimState, nodeId: string): { cluster: SimCluster; target: SimNode } | null {
  for (const cluster of state.clusters) {
    const target = cluster.nodes.find((candidate) => candidate.id === nodeId);
    if (target) return { cluster, target };
  }
  return null;
}

/** The visitor's one action: fail a healthy node, or bring a failed one back. */
export function toggleNode(state: SimState, nodeId: string, atMs: number): SimState {
  const found = find(state, nodeId);
  if (!found) return state;
  const { cluster, target } = found;
  if (target.healthy) {
    const next = mapCluster(state, cluster.id, (current) =>
      mapNode(current, nodeId, (old) => ({ ...old, healthy: false, failedAtMs: atMs, reported: false })),
    );
    return append(next, [
      { atMs, kind: 'manual', text: `You failed ${nodeId}, ${target.role === 'active' ? 'the active node' : 'a standby'} in ${cluster.name}.` },
    ]);
  }
  const next = mapCluster(state, cluster.id, (current) =>
    mapNode(current, nodeId, (old) => ({ ...old, healthy: true, failedAtMs: null, reported: false })),
  );
  return append(next, [{ atMs, kind: 'manual', text: `You brought ${nodeId} back.` }]);
}

/** Start a cycle: one probe per cluster, then a closing step. */
export function beginCycle(state: SimState): { state: SimState; run: CycleRun } {
  const cycle = state.cycle + 1;
  return {
    state: { ...state, cycle },
    run: {
      cycle,
      events: 0,
      queue: [...state.clusters.map((cluster) => ({ kind: 'probe', cluster: cluster.id }) as Phase), { kind: 'finish' }],
    },
  };
}

/** How long the next step takes, or null when the cycle is finished. */
export function nextWait(run: CycleRun): number | null {
  const phase = run.queue[0];
  if (!phase) return null;
  return phase.kind === 'finish' ? 0 : STEP_MS[phase.kind];
}

interface Verdict {
  id: string;
  free: number;
  fits: boolean;
  healthy: boolean;
}

/** For each standby: is it up, and does it have room for the cluster's workload? */
export function assess(cluster: SimCluster): Verdict[] {
  return cluster.nodes
    .filter((candidate) => candidate.role === 'standby')
    .map((candidate) => {
      const free = 100 - candidate.base;
      return { id: candidate.id, free, healthy: candidate.healthy, fits: candidate.healthy && free >= cluster.demand };
    });
}

/** Run the next step of a cycle against the state as it is now, at simulation time `atMs`. */
export function advance(state: SimState, run: CycleRun, atMs: number): { state: SimState; run: CycleRun } {
  const [phase, ...rest] = run.queue;
  if (!phase) return { state, run };
  let next = state;
  let events = run.events;
  let queue = rest;
  const log = (kind: LogKind, text: string, mergeKey?: string) => {
    next = append(next, [{ atMs, kind, text, ...(mergeKey ? { mergeKey } : {}) }]);
  };

  if (phase.kind === 'finish') {
    if (events === 0) {
      const waiting = next.clusters.filter((cluster) => cluster.alert).map((cluster) => cluster.name);
      if (waiting.length === 0) {
        log('quiet', 'All clusters healthy. Nothing to do.', 'quiet:healthy');
      } else {
        const names = waiting.join(' and ');
        log(
          'quiet',
          `No change. ${names} still ${waiting.length === 1 ? 'has' : 'have'} no standby with capacity; still refusing to move.`,
          `quiet:${waiting.join(',')}`,
        );
      }
    }
    return { state: next, run: { ...run, queue, events } };
  }

  const cluster = next.clusters.find((candidate) => candidate.id === phase.cluster);
  if (!cluster) return { state: next, run: { ...run, queue, events } };
  const active = cluster.nodes.find((candidate) => candidate.role === 'active');

  if (phase.kind === 'probe') {
    for (const standby of cluster.nodes) {
      if (standby.role === 'standby' && !standby.healthy && !standby.reported) {
        log('note', `${cluster.name}: standby ${standby.id} is down. Nothing to move; one fewer spare.`);
        next = mapCluster(next, cluster.id, (current) => mapNode(current, standby.id, (old) => ({ ...old, reported: true })));
        events++;
      }
    }
    if (active?.healthy) {
      if (cluster.alert) {
        log('recover', `${cluster.name}: ${active.id} is answering again. Serving; alert cleared.`);
        next = mapCluster(next, cluster.id, (current) => ({ ...current, alert: false, detectedAtMs: null }));
        events++;
      }
    } else if (active) {
      if (!cluster.alert) {
        const lag = active.failedAtMs === null ? '' : `, ${seconds(atMs - active.failedAtMs)} s after it failed`;
        log('detect', `${cluster.name}: active node ${active.id} is not answering. Detected${lag}.`);
        next = mapCluster(next, cluster.id, (current) => ({ ...current, detectedAtMs: atMs }));
        events++;
      }
      queue = [{ kind: 'assess', cluster: cluster.id }, ...queue];
    }
  }

  if (phase.kind === 'assess') {
    if (!active || active.healthy) return { state: next, run: { ...run, queue, events } };
    const verdicts = assess(cluster);
    if (!cluster.alert) {
      for (const verdict of verdicts) {
        const outcome = !verdict.healthy ? 'down' : verdict.fits ? 'fits' : 'too busy';
        log('assess', `${verdict.id}: ${verdict.healthy ? `${verdict.free}% free, ` : ''}needs ${cluster.demand}%: ${outcome}.`);
      }
    }
    const best = verdicts.filter((verdict) => verdict.fits).sort((a, b) => b.free - a.free)[0];
    if (best) {
      if (cluster.alert) {
        log('assess', `${cluster.name}: ${best.id} has capacity now (${best.free}% free, needs ${cluster.demand}%).`);
      }
      events++;
      queue = [{ kind: 'failover', cluster: cluster.id, to: best.id }, ...queue];
    } else if (!cluster.alert) {
      log(
        'refuse',
        `${cluster.name}: no standby can carry the load. Refusing to fail over: it would overload a healthy node. ` +
          `${cluster.name} stays down and a person is paged.`,
      );
      next = mapCluster(next, cluster.id, (current) => ({ ...current, alert: true }));
      events++;
    }
  }

  if (phase.kind === 'failover') {
    const target = cluster.nodes.find((candidate) => candidate.id === phase.to);
    if (!active || active.healthy) {
      log('note', `${cluster.name}: ${active?.id ?? 'the active node'} came back before the move. Nothing to do.`);
    } else if (!target?.healthy || target.role !== 'standby') {
      log('note', `${cluster.name}: ${phase.to} failed before the move. Assessing again.`);
      queue = [{ kind: 'assess', cluster: cluster.id }, ...queue];
    } else {
      log('act', `${cluster.name}: failing over ${active.id} → ${target.id}.`);
      next = mapCluster(next, cluster.id, (current) => ({
        ...current,
        alert: false,
        nodes: current.nodes.map((candidate) =>
          candidate.id === active.id
            ? { ...candidate, role: 'standby', reported: true }
            : candidate.id === target.id
              ? { ...candidate, role: 'active' }
              : candidate,
        ),
      }));
      queue = [{ kind: 'verify', cluster: cluster.id, to: target.id }, ...queue];
    }
    events++;
  }

  if (phase.kind === 'verify') {
    const target = cluster.nodes.find((candidate) => candidate.id === phase.to);
    if (target?.healthy && target.role === 'active') {
      const took = cluster.detectedAtMs === null ? '' : ` Recovered ${seconds(atMs - cluster.detectedAtMs)} s after detection.`;
      log('verify', `${cluster.name}: verified, ${target.id} is serving.${took}`);
      next = mapCluster(next, cluster.id, (current) => ({ ...current, detectedAtMs: null }));
    } else {
      log('note', `${cluster.name}: could not verify ${phase.to}; it is not answering. Checking again next cycle.`);
    }
    events++;
  }

  return { state: next, run: { ...run, queue, events } };
}

/** Run one whole cycle starting at `startMs`, with each step taking its simulated time. For tests. */
export function runCycle(state: SimState, startMs: number): { state: SimState; endMs: number } {
  let { state: current, run } = beginCycle(state);
  let atMs = startMs;
  for (let wait = nextWait(run); wait !== null; wait = nextWait(run)) {
    atMs += wait;
    ({ state: current, run } = advance(current, run, atMs));
  }
  return { state: current, endMs: atMs };
}
