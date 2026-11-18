// Words for the status panel: state labels, ages, the one-line summary. No DOM.
import type { State, StatusResponse, SystemStatus } from './types';

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

/** The line under a row's fact: when it was checked, and the age that goes with the fact. */
export function metaLine(system: SystemStatus, response: StatusResponse, receivedAtMs: number, nowMs: number): string {
  const parts = [`checked ${ageOf(system.checked_at, response, receivedAtMs, nowMs)}`];
  if (system.since && system.since_label) {
    parts.push(`${system.since_label} ${ageOf(system.since, response, receivedAtMs, nowMs)}`);
  }
  return parts.join(' · ');
}

/** What a row says when its check failed but an earlier one had worked. */
export function lastKnownLine(system: SystemStatus, response: StatusResponse, receivedAtMs: number, nowMs: number): string | null {
  const last = system.last_known;
  if (!last) return null;
  const when = ageOf(last.checked_at, response, receivedAtMs, nowMs);
  return `Last known, ${when}: ${STATE_LABEL[last.state]}. ${last.fact}`;
}

/** "All 4 up", "3 of 4 up, 1 could not check", "2 of 4 up, 1 degraded, 1 down". */
export function summary(systems: readonly SystemStatus[]): string {
  const count = (state: State) => systems.filter((system) => system.state === state).length;
  const total = systems.length;
  const up = count('up');
  if (up === total) return `All ${total} up`;
  const rest = (['degraded', 'down', 'unknown'] as const)
    .filter((state) => count(state) > 0)
    .map((state) => `${count(state)} ${STATE_LABEL[state]}`);
  return [`${up} of ${total} up`, ...rest].join(', ');
}
