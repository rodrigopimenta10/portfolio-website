// The status panel as states and what each one shows. No DOM and no clock: the page
// (src/scripts/status-panel.ts) owns the requests and the timers, and paints what `panelView` returns.
//
// The panel is always in one of three phases and looks deliberate in each:
//   loading   rows say "checking". After a few seconds a line explains why the wait can happen.
//   read      the service answered: state, fact and ages for each row.
//   failed    the service did not answer: every row says "could not check", the panel says what
//             went wrong and that nothing on it is live, and offers to try again.
import type { FetchResult } from './client';
import { DEMO_BUTTON, demoTarget, withFailedCheck } from './demo';
import { SYSTEMS, type StatusResponse } from './types';
import { STATE_LABEL, listedSystems, rowView, summary, utcTime, type RowView } from './view';

export type PanelState =
  | { phase: 'loading'; again: boolean; slow: boolean }
  | { phase: 'failed'; reason: string; lastAnswerAt: string | null }
  | {
      phase: 'read';
      data: StatusResponse;
      /** When the answer arrived, on the visitor's clock. */
      receivedAtMs: number;
      /** The system whose check is drawn as failed, while the demonstration is on. */
      demo: string | null;
    };

export type NoteTone = 'waiting' | 'failed' | 'demo' | 'recorded';

export interface PanelView {
  summary: string;
  /** One for each row, in the order of `SYSTEMS`. */
  rows: RowView[];
  /** A line that takes the place of the panel's small print while there is something to say. */
  note: { tone: NoteTone; text: string } | null;
  canRetry: boolean;
  demo: { on: boolean; label: string; available: boolean };
}

export const INITIAL: PanelState = { phase: 'loading', again: false, slow: false };

/** A request is about to leave. A reading already on screen stays there until the new one arrives. */
export function asking(state: PanelState): PanelState {
  if (state.phase === 'read') return state;
  return { phase: 'loading', again: state.phase === 'failed' || (state.phase === 'loading' && state.again), slow: false };
}

/** No answer yet, for long enough that the panel should say why. */
export function stillWaiting(state: PanelState): PanelState {
  return state.phase === 'loading' ? { ...state, slow: true } : state;
}

/** The request ended. */
export function answered(state: PanelState, result: FetchResult): PanelState {
  if (!result.ok) {
    const lastAnswerAt = state.phase === 'read' ? state.data.generated_at : state.phase === 'failed' ? state.lastAnswerAt : null;
    return { phase: 'failed', reason: result.reason, lastAnswerAt };
  }
  // A demonstration that is on stays on over the new reading, unless its system is no longer up.
  const demo = state.phase === 'read' && state.demo && withFailedCheck(listedSystems(result.data), state.demo) ? state.demo : null;
  return { phase: 'read', data: result.data, receivedAtMs: result.receivedAtMs, demo };
}

/** The visitor pressed the demonstration button: on if there is something up to fail, off if it was on. */
export function toggleDemo(state: PanelState): PanelState {
  if (state.phase !== 'read') return state;
  return { ...state, demo: state.demo ? null : demoTarget(listedSystems(state.data)) };
}

const NO_DEMO = { on: false, label: DEMO_BUTTON.start, available: false } as const;

export function panelView(state: PanelState, nowMs: number): PanelView {
  if (state.phase === 'loading') {
    return {
      summary: 'Checking…',
      // On the first load the placeholder in the HTML stays. On a retry the old "no answer" goes.
      rows: SYSTEMS.map(({ id }) => ({ id, state: 'loading', label: 'checking', fact: state.again ? 'Asking again…' : null, reason: null, meta: '' })),
      note: state.slow
        ? { tone: 'waiting', text: 'Still waiting. The service scales to zero when idle, so a first answer can take a few seconds.' }
        : null,
      canRetry: false,
      demo: NO_DEMO,
    };
  }

  if (state.phase === 'failed') {
    const before = state.lastAnswerAt ? ` The last answer arrived at ${utcTime(state.lastAnswerAt)}.` : '';
    return {
      summary: 'Could not check',
      rows: SYSTEMS.map(({ id }) => ({ id, state: 'unknown', label: STATE_LABEL.unknown, fact: 'No answer from the status service.', reason: null, meta: '' })),
      note: {
        tone: 'failed',
        text: `The status service did not answer: ${state.reason}. Nothing on this panel is live right now.${before} The systems themselves may be fine.`,
      },
      canRetry: true,
      demo: NO_DEMO,
    };
  }

  const real = listedSystems(state.data);
  const staged = state.demo ? withFailedCheck(real, state.demo) : null;
  const shown = staged ?? real;
  const rows = shown.map((system) => rowView(system, state.data, state.receivedAtMs, nowMs));

  if (staged) {
    const name = real.find((system) => system.id === state.demo)?.name ?? 'One system';
    return {
      // Both lines a screen reader hears say that this is not a reading.
      summary: `Demonstration: ${summary(shown)}`,
      rows,
      note: {
        tone: 'demo',
        text: `A demonstration, not a real reading: ${name} is drawn the way a failed check looks, in your browser only. Nothing has failed.`,
      },
      canRetry: false,
      demo: { on: true, label: DEMO_BUTTON.stop, available: true },
    };
  }

  return {
    summary: summary(shown),
    rows,
    // The test service answers from files, and the panel does not pass them off as live.
    note: state.data.recorded ? { tone: 'recorded', text: 'Recorded responses, not live data: the service is running in test mode.' } : null,
    canRetry: false,
    demo: { on: false, label: DEMO_BUTTON.start, available: demoTarget(real) !== null },
  };
}
