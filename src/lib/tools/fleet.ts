// The dashboard on the Tools page: a handful of made-up components, and for each one the single
// thing it needs next. Pure data and rules. The page (src/scripts/tools-ui.ts) owns the DOM.

export interface Component {
  name: string;
  rack: 'RF gateway' | 'SNC';
  /** The software version it is running, and the one it should be running. */
  running: string;
  target: string;
  /**
   * A configuration fix has two causes: an update that has not reached the component (drifted), or
   * a change in the network that the component's configuration now has to follow (change).
   */
  config: 'matches' | 'drifted' | 'change';
  /** "ok", or what is wrong with it. */
  hardware: string;
}

export type Need = 'software' | 'config' | 'hardware' | 'none';
export type Filter = 'all' | Need;
/** How a value should read at a glance: wants attention, is broken, or is fine. Null is unremarkable. */
export type Tone = 'warn' | 'bad' | 'good' | null;

export interface Cell {
  text: string;
  tone: Tone;
}

/** One line of the table, ready to print. */
export interface Row {
  name: string;
  rack: string;
  software: Cell;
  config: Cell;
  hardware: Cell;
  need: Cell;
}

export const fleet: readonly Component[] = [
  { name: 'modem-pool-01', rack: 'RF gateway', running: '4.2', target: '4.2', config: 'matches', hardware: 'ok' },
  { name: 'modem-pool-02', rack: 'RF gateway', running: '4.1', target: '4.2', config: 'matches', hardware: 'ok' },
  { name: 'timing-unit-01', rack: 'SNC', running: '2.8', target: '2.8', config: 'drifted', hardware: 'ok' },
  { name: 'controller-01', rack: 'SNC', running: '3.0', target: '3.1', config: 'matches', hardware: 'ok' },
  { name: 'upconverter-03', rack: 'RF gateway', running: '1.9', target: '1.9', config: 'matches', hardware: 'fan failing' },
  { name: 'controller-02', rack: 'SNC', running: '3.1', target: '3.1', config: 'matches', hardware: 'ok' },
  { name: 'switch-02', rack: 'RF gateway', running: '7.4', target: '7.4', config: 'change', hardware: 'ok' },
  { name: 'storage-node-04', rack: 'SNC', running: '5.0', target: '5.0', config: 'matches', hardware: 'ok' },
];

/** The filter buttons, in the order they are shown. Each label follows its count: "2 need a software upgrade". */
export const filters: readonly { key: Filter; label: string; tone: Tone }[] = [
  { key: 'all', label: 'components', tone: null },
  { key: 'software', label: 'need a software upgrade', tone: 'warn' },
  { key: 'config', label: 'need a configuration fix', tone: 'warn' },
  { key: 'hardware', label: 'need a hardware replacement', tone: 'bad' },
  { key: 'none', label: 'need nothing', tone: 'good' },
];

const needCells: Record<Need, Cell> = {
  software: { text: 'software upgrade', tone: 'warn' },
  config: { text: 'configuration fix', tone: 'warn' },
  hardware: { text: 'hardware replacement', tone: 'bad' },
  none: { text: 'nothing', tone: 'good' },
};

/**
 * The one thing a component needs next. A component with more than one thing wrong is counted once,
 * under the first of these that applies: hardware, then configuration, then software.
 */
export function needOf(component: Component): Need {
  if (component.hardware !== 'ok') return 'hardware';
  if (component.config !== 'matches') return 'config';
  if (component.running !== component.target) return 'software';
  return 'none';
}

/** The components a filter keeps, in their original order. */
export function keptBy(filter: Filter, components: readonly Component[] = fleet): Component[] {
  return components.filter((component) => filter === 'all' || needOf(component) === filter);
}

/** The number on a filter button. */
export function countFor(filter: Filter, components: readonly Component[] = fleet): number {
  return keptBy(filter, components).length;
}

export function isFilter(value: string | undefined): value is Filter {
  return filters.some((filter) => filter.key === value);
}

/** A component as the table prints it. */
export function toRow(component: Component): Row {
  const upToDate = component.running === component.target;
  return {
    name: component.name,
    rack: component.rack,
    software: upToDate
      ? { text: component.running, tone: null }
      : { text: `${component.running} → ${component.target}`, tone: 'warn' },
    config:
      component.config === 'matches'
        ? { text: 'matches', tone: null }
        : { text: component.config === 'drifted' ? 'drifted' : 'change needed', tone: 'warn' },
    hardware: { text: component.hardware, tone: component.hardware === 'ok' ? null : 'bad' },
    need: needCells[needOf(component)],
  };
}
