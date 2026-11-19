// A small simulation of a self-healing monitor: nodes in clusters, a monitor that looks at them on
// a fixed cycle, moves work off a failed node when the standby can carry it, and refuses when it
// cannot.
//
// Each cluster has two active nodes, which share its work, and one standby: a common layout for a
// Ceph file system's metadata servers. Everything else is generic on purpose. The clusters, names,
// loads and timings are made up for the page; none of it is taken from a real system.
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
  /** When the monitor first saw this active node down, until its work is served again. */
  detectedAtMs: number | null;
  /** True while the monitor has refused to move this node's work and is waiting for capacity or a person. */
  refused: boolean;
}

export interface SimCluster {
  id: string;
  name: string;
  /** Share of a node's capacity that each active node's part of the work needs, in percent. */
  demand: number;
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
  | { kind: 'assess'; cluster: string; node: string }
  | { kind: 'failover'; cluster: string; from: string; to: string }
  | { kind: 'verify'; cluster: string; from: string; to: string }
  | { kind: 'finish' };

/** One cycle in progress: what is left to do, and whether anything worth logging has happened. */
export interface CycleRun {
  cycle: number;
  queue: Phase[];
  events: number;
}

function node(id: string, role: SimNode['role'], base: number): SimNode {
  return { id, role, healthy: true, base, failedAtMs: null, reported: false, detectedAtMs: null, refused: false };
}

export function initialState(): SimState {
  return {
    cycle: 0,
    log: [],
    clusters: [
      {
        id: 'a',
        name: 'Cluster A',
        demand: 30,
        nodes: [node('a1', 'active', 10), node('a2', 'active', 15), node('a3', 'standby', 25)],
      },
      {
        id: 'b',
        name: 'Cluster B',
        demand: 35,
        nodes: [node('b1', 'active', 10), node('b2', 'active', 20), node('b3', 'standby', 40)],
      },
      {
        // Its standby is busy: failing c1 or c2 shows the monitor refusing.
        id: 'c',
        name: 'Cluster C',
        demand: 45,
        nodes: [node('c1', 'active', 15), node('c2', 'active', 10), node('c3', 'standby', 70)],
      },
    ],
  };
}

/** Percent of capacity in use on a node: its other work, plus its part of the cluster's work if it is active. */
export function loadOf(cluster: SimCluster, target: SimNode): number {
  if (!target.healthy) return 0;
  return target.base + (target.role === 'active' ? cluster.demand : 0);
}

/** How many of the cluster's two active nodes are up and serving their part of the work. */
export function activeUp(cluster: SimCluster): number {
  return cluster.nodes.filter((candidate) => candidate.role === 'active' && candidate.healthy).length;
}

/** True when every part of the cluster's work is being served. */
export function isServing(cluster: SimCluster): boolean {
  return activeUp(cluster) === cluster.nodes.filter((candidate) => candidate.role === 'active').length;
}

/** True while the monitor is refusing to move some node's work in this cluster. */
export function isRefusing(cluster: SimCluster): boolean {
  return cluster.nodes.some((candidate) => candidate.refused);
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
      { atMs, kind: 'manual', text: `You failed ${nodeId}, ${target.role === 'active' ? 'an active node' : 'the standby'} in ${cluster.name}.` },
    ]);
  }
  const next = mapCluster(state, cluster.id, (current) =>
    // A node the monitor is refusing over keeps that mark until the next check sees it answering.
    mapNode(current, nodeId, (old) => ({
      ...old,
      healthy: true,
      failedAtMs: null,
      reported: false,
      detectedAtMs: old.refused ? old.detectedAtMs : null,
    })),
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

/** For each standby: is it up, and does it have room for one active node's part of the work? */
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
      const waiting = next.clusters.filter(isRefusing).map((cluster) => cluster.name);
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
  const change = (id: string, to: (old: SimNode) => SimNode) => {
    next = mapCluster(next, cluster.id, (current) => mapNode(current, id, to));
  };

  if (phase.kind === 'probe') {
    const assessments: Phase[] = [];
    for (const member of cluster.nodes) {
      if (member.role === 'standby') {
        if (!member.healthy && !member.reported) {
          log('note', `${cluster.name}: standby ${member.id} is down. Nothing to move; no spare until it is back.`);
          change(member.id, (old) => ({ ...old, reported: true }));
          events++;
        }
      } else if (member.healthy) {
        if (member.refused) {
          log('recover', `${cluster.name}: ${member.id} is answering again. Serving; alert cleared.`);
          events++;
        }
        if (member.refused || member.detectedAtMs !== null) {
          change(member.id, (old) => ({ ...old, refused: false, detectedAtMs: null }));
        }
      } else {
        if (member.detectedAtMs === null) {
          const lag = member.failedAtMs === null ? '' : `, ${seconds(atMs - member.failedAtMs)} s after it failed`;
          log('detect', `${cluster.name}: active node ${member.id} is not answering. Detected${lag}.`);
          change(member.id, (old) => ({ ...old, detectedAtMs: atMs }));
          events++;
        }
        assessments.push({ kind: 'assess', cluster: cluster.id, node: member.id });
      }
    }
    queue = [...assessments, ...queue];
  }

  if (phase.kind === 'assess') {
    const failed = cluster.nodes.find((candidate) => candidate.id === phase.node);
    if (!failed || failed.healthy || failed.role !== 'active') return { state: next, run: { ...run, queue, events } };
    const verdicts = assess(cluster);
    if (!failed.refused) {
      for (const verdict of verdicts) {
        const outcome = !verdict.healthy ? 'down' : verdict.fits ? 'fits' : 'too busy';
        log('assess', `${verdict.id}: ${verdict.healthy ? `${verdict.free}% free, ` : ''}needs ${cluster.demand}%: ${outcome}.`);
      }
    }
    const best = verdicts.filter((verdict) => verdict.fits).sort((a, b) => b.free - a.free)[0];
    if (best) {
      if (failed.refused) {
        log('assess', `${cluster.name}: ${best.id} has capacity now (${best.free}% free, needs ${cluster.demand}%).`);
      }
      events++;
      queue = [{ kind: 'failover', cluster: cluster.id, from: failed.id, to: best.id }, ...queue];
    } else if (!failed.refused) {
      log(
        'refuse',
        `${cluster.name}: the standby cannot carry ${failed.id}'s work. Refusing to fail over: it would overload a healthy node. ` +
          `${failed.id}'s part of ${cluster.name} stays down and a person is paged.`,
      );
      change(failed.id, (old) => ({ ...old, refused: true }));
      events++;
    }
  }

  if (phase.kind === 'failover') {
    const failed = cluster.nodes.find((candidate) => candidate.id === phase.from);
    const target = cluster.nodes.find((candidate) => candidate.id === phase.to);
    if (!failed || failed.healthy) {
      log('note', `${cluster.name}: ${phase.from} came back before the move. Nothing to do.`);
      change(phase.from, (old) => ({ ...old, refused: false, detectedAtMs: null }));
    } else if (!target?.healthy || target.role !== 'standby') {
      log('note', `${cluster.name}: ${phase.to} failed before the move. Assessing again.`);
      queue = [{ kind: 'assess', cluster: cluster.id, node: failed.id }, ...queue];
    } else {
      log('act', `${cluster.name}: failing over ${failed.id} → ${target.id}.`);
      change(failed.id, (old) => ({ ...old, role: 'standby', reported: true, refused: false }));
      change(target.id, (old) => ({ ...old, role: 'active' }));
      queue = [{ kind: 'verify', cluster: cluster.id, from: failed.id, to: target.id }, ...queue];
    }
    events++;
  }

  if (phase.kind === 'verify') {
    const failed = cluster.nodes.find((candidate) => candidate.id === phase.from);
    const target = cluster.nodes.find((candidate) => candidate.id === phase.to);
    if (target?.healthy && target.role === 'active') {
      const since = failed?.detectedAtMs ?? null;
      const took = since === null ? '' : ` Recovered ${seconds(atMs - since)} s after detection.`;
      log('verify', `${cluster.name}: verified, ${target.id} is serving.${took}`);
    } else {
      log('note', `${cluster.name}: could not verify ${phase.to}; it is not answering. Checking again next cycle.`);
    }
    change(phase.from, (old) => ({ ...old, detectedAtMs: null }));
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
