// "Fail one check on purpose": what the panel draws when a visitor asks to see a failed check.
//
// It is a demonstration and nothing else. No request is made and nothing is stored: one system of
// the reading already on screen is redrawn, in this browser only, the way the service would report
// it if its check had timed out. The panel says so for as long as it lasts (see panel.ts), and
// pressing the button again or reloading the page brings back the reading as it was read.
import type { SystemStatus } from './types';

/** The button's words: what pressing it does next. */
export const DEMO_BUTTON = { start: 'Fail one check on purpose', stop: 'Run the checks again' } as const;

/** What the failed row says. The service gives each check four seconds. */
export const DEMO_REASON = 'The check timed out after 4 seconds.';

/**
 * Which check the demonstration fails: the first system that is up, so the row has a last known
 * answer to show. `null` when nothing is up, and then there is nothing to demonstrate.
 */
export function demoTarget(systems: readonly SystemStatus[]): string | null {
  return systems.find((system) => system.state === 'up')?.id ?? null;
}

/** A system as the service reports one whose check just timed out: no fact, a reason, and its last good answer. */
function timedOut(system: SystemStatus): SystemStatus {
  return {
    id: system.id,
    name: system.name,
    url: system.url,
    state: 'unknown',
    checked_at: system.checked_at,
    reason: DEMO_REASON,
    last_known: { state: system.state, fact: system.fact ?? '', checked_at: system.checked_at },
  };
}

/**
 * The same systems with `target` drawn as failed. `null` when the target is not up in this reading:
 * a real change of state is never painted over by the demonstration.
 */
export function withFailedCheck(systems: readonly SystemStatus[], target: string): SystemStatus[] | null {
  if (systems.find((system) => system.id === target)?.state !== 'up') return null;
  return systems.map((system) => (system.id === target ? timedOut(system) : system));
}
