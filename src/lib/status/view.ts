// Words for the status panel: state labels, ages, what one row says, the one-line summary. No DOM.
import { SYSTEMS, type State, type StatusResponse, type SystemStatus } from './types';

export const STATE_LABEL: Record<State, string> = {
  up: 'up',
  degraded: 'degraded',
  down: 'down',
  unknown: 'could not check',
};

/** "just now", "42 s ago", "3 min ago", "1 h 4 min ago", "2 days ago". */
export function age(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 90) return `${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h ago` : `${hours} h ${rest} min ago`;
  }
  return `${Math.floor(hours / 24)} days ago`;
}

/**
 * How long ago `iso` was, measured on the service's clock: the service says what time it was when
 * it answered (`generated_at`), and the page adds the time since that answer arrived. The visitor's
 * own clock, which may be wrong, is never compared with the service's.
 */
export function ageOf(iso: string, response: StatusResponse, receivedAtMs: number, nowMs: number): string {
  const serviceNow = Date.parse(response.generated_at) + (nowMs - receivedAtMs);
  return age(serviceNow - Date.parse(iso));
}

/** "19:14:19 UTC" */
export function utcTime(iso: string): string {
  return `${new Date(iso).toISOString().slice(11, 19)} UTC`;
}

/**
 * One entry for each row of the panel, in the panel's order. A system the service reports and the
 * panel does not list is ignored. A listed system the service did not mention is "could not check":
 * nothing is up by omission.
 */
export function listedSystems(response: StatusResponse): SystemStatus[] {
  return SYSTEMS.map(
    (listed): SystemStatus =>
      response.systems.find((system) => system.id === listed.id) ?? {
        ...listed,
        state: 'unknown',
        checked_at: response.generated_at,
        reason: 'The status service did not report on this system.',
      },
  );
}

/** The line under a row's fact: when it was checked, and the age that goes with the fact. */
export function metaLine(system: SystemStatus, response: StatusResponse, receivedAtMs: number, nowMs: number): string {
  // A check that failed has nothing new to date. What it can say is how old the last good answer is.
  if (system.state === 'unknown' && system.last_known) {
    const { state, checked_at } = system.last_known;
    return `last known answer: ${STATE_LABEL[state]}, ${ageOf(checked_at, response, receivedAtMs, nowMs)}`;
  }
  const parts = [`checked ${ageOf(system.checked_at, response, receivedAtMs, nowMs)}`];
  if (system.since && system.since_label) {
    parts.push(`${system.since_label} ${ageOf(system.since, response, receivedAtMs, nowMs)}`);
  }
  return parts.join(' · ');
}

/** What one row of the panel shows. */
export interface RowView {
  id: string;
  /** "loading" is the row before any answer: the same row, saying "checking". */
  state: State | 'loading';
  label: string;
  /** The row's main line. `null` leaves the placeholder that is in the HTML from the start. */
  fact: string | null;
  /** A second line under the fact: why a system that answered is degraded or down. */
  reason: string | null;
  meta: string;
}

export function rowView(system: SystemStatus, response: StatusResponse, receivedAtMs: number, nowMs: number): RowView {
  return {
    id: system.id,
    state: system.state,
    label: STATE_LABEL[system.state],
    // A failed check has no fact, so its reason takes the main line.
    fact: system.fact ?? system.reason ?? (system.state === 'unknown' ? 'The check failed.' : ''),
    reason: system.fact ? (system.reason ?? null) : null,
    meta: metaLine(system, response, receivedAtMs, nowMs),
  };
}

/** "All 3 up", "2 up · 1 could not check", "1 up · 1 degraded · 1 down". */
export function summary(systems: readonly SystemStatus[]): string {
  const count = (state: State) => systems.filter((system) => system.state === state).length;
  if (count('up') === systems.length) return `All ${systems.length} up`;
  return (['up', 'degraded', 'down', 'unknown'] as const)
    .filter((state) => state === 'up' || count(state) > 0)
    .map((state) => `${count(state)} ${STATE_LABEL[state]}`)
    .join(' · ');
}
