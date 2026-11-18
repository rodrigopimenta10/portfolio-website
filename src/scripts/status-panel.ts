// Fills the status panel from /api/status. Loaded as a deferred module, so the page has painted
// before the first request leaves.
//
// The panel has four states and looks deliberate in each: loading (rows say "checking"), slow
// (a line explains why the wait can happen), answered (state, fact and ages per row), and failed
// (every row says "could not check" and the panel says what went wrong and offers to try again).
import { SLOW_AFTER_MS, fetchStatus, type FetchResult } from '../lib/status/client';
import type { StatusResponse, SystemStatus } from '../lib/status/types';
import { STATE_LABEL, lastKnownLine, metaLine, summary, utcTime } from '../lib/status/view';

const REFRESH_MS = 60_000;
const TICK_MS = 1_000;

interface Loaded {
  data: StatusResponse;
  receivedAtMs: number;
}

function mount(panel: HTMLElement): void {
  const rows = new Map<string, HTMLElement>();
  for (const row of panel.querySelectorAll<HTMLElement>('[data-system]')) rows.set(row.dataset['system'] ?? '', row);
  const summaryLine = panel.querySelector<HTMLElement>('[data-status-summary]');
  const note = panel.querySelector<HTMLElement>('[data-status-note]');
  const noteText = panel.querySelector<HTMLElement>('[data-status-note-text]');
  const retry = panel.querySelector<HTMLButtonElement>('[data-status-retry]');
  if (!summaryLine || !note || !noteText || !retry) return;

  let loaded: Loaded | null = null;
  let inFlight = false;
  let visible = true;
  let refreshTimer: number | undefined;
  let tickTimer: number | undefined;

  function setNote(tone: 'waiting' | 'failed' | 'recorded' | null, text = '', withRetry = false): void {
    note!.hidden = tone === null;
    if (tone) note!.dataset['tone'] = tone;
    noteText!.textContent = text;
    retry!.hidden = !withRetry;
  }

  function setText(element: Element | null, text: string): void {
    // Only touch the DOM when the words change, so a screen reader is not told the same thing every second.
    if (element && element.textContent !== text) element.textContent = text;
  }

  function setRow(row: HTMLElement, state: string, label: string, fact: string, reason: string | null, meta: string): void {
    row.dataset['state'] = state;
    setText(row.querySelector('[data-state-label]'), label);
    setText(row.querySelector('[data-meta]'), meta);
    const factLine = row.querySelector<HTMLElement>('[data-fact]');
    const key = `${fact}\n${reason ?? ''}`;
    if (factLine && factLine.dataset['key'] !== key) {
      factLine.dataset['key'] = key;
      factLine.textContent = fact;
      if (reason) {
        const why = document.createElement('span');
        why.className = 'reason';
        why.textContent = reason;
        factLine.append(why);
      }
    }
  }

  function renderRow(row: HTMLElement, system: SystemStatus, current: Loaded): void {
    const now = Date.now();
    const fact = system.fact ?? (system.state === 'unknown' ? (system.reason ?? 'The check failed.') : '');
    const reason =
      system.state === 'unknown'
        ? lastKnownLine(system, current.data, current.receivedAtMs, now)
        : (system.reason ?? null);
    setRow(row, system.state, STATE_LABEL[system.state], fact, reason, metaLine(system, current.data, current.receivedAtMs, now));
  }

  function renderLoaded(): void {
    if (!loaded) return;
    const shown: SystemStatus[] = [];
    for (const system of loaded.data.systems) {
      const row = rows.get(system.id);
      if (!row) continue;
      renderRow(row, system, loaded);
      shown.push(system);
    }
    // A row the service did not mention is not "up" by omission.
    for (const [id, row] of rows) {
      if (!loaded.data.systems.some((system) => system.id === id)) {
        setRow(row, 'unknown', STATE_LABEL.unknown, 'The status service did not report on this system.', null, '');
      }
    }
    // With one row (a project's own page) the row already says the state; the header gives the time.
    const time = utcTime(loaded.data.generated_at);
    setText(summaryLine, rows.size > 1 ? `${summary(shown)} · ${time}` : `Asked at ${time}`);
  }

  function renderFailed(reason: string): void {
    const previous = loaded;
    loaded = null;
    for (const row of rows.values()) {
      setRow(row, 'unknown', STATE_LABEL.unknown, 'No answer from the status service.', null, '');
    }
    summaryLine!.textContent = 'Could not check';
    const before = previous ? ` The last answer arrived at ${utcTime(previous.data.generated_at)}.` : '';
    setNote(
      'failed',
      `The status service did not answer: ${reason}. Nothing on this panel is live right now.${before} ` +
        'The systems themselves may be fine; each name links to the real thing.',
      true,
    );
  }

  async function load(): Promise<void> {
    if (inFlight) return;
    inFlight = true;
    retry!.hidden = true;
    if (!loaded) {
      for (const row of rows.values()) {
        row.dataset['state'] = 'loading';
        setText(row.querySelector('[data-state-label]'), 'checking');
        // On a retry, the old "no answer" text goes; on the first load the placeholder stays.
        const factLine = row.querySelector<HTMLElement>('[data-fact]');
        if (factLine && factLine.dataset['key'] !== undefined) {
          delete factLine.dataset['key'];
          factLine.textContent = 'Asking again…';
        }
      }
      summaryLine!.textContent = 'Checking…';
      if (note!.dataset['tone'] === 'failed') setNote(null);
    }
    const slow = window.setTimeout(() => {
      setNote('waiting', 'Still waiting. The service scales to zero when idle, so a first answer can take a few seconds.');
    }, SLOW_AFTER_MS);

    const result: FetchResult = await fetchStatus();
    window.clearTimeout(slow);
    inFlight = false;

    if (result.ok) {
      loaded = { data: result.data, receivedAtMs: result.receivedAtMs };
      setNote(
        result.data.recorded ? 'recorded' : null,
        result.data.recorded ? 'Recorded responses, not live data: the service is running in test mode.' : '',
      );
      renderLoaded();
    } else {
      renderFailed(result.reason);
    }
    schedule();
  }

  function schedule(): void {
    window.clearTimeout(refreshTimer);
    window.clearInterval(tickTimer);
    if (!visible || document.hidden) return;
    // Ages ("checked 42 s ago") move on while the panel is on screen; nothing runs when it is not.
    tickTimer = window.setInterval(renderLoaded, TICK_MS);
    if (loaded) {
      // Ask again a minute after the last answer; at once if the tab was away for longer than that.
      const due = Math.max(0, REFRESH_MS - (Date.now() - loaded.receivedAtMs));
      refreshTimer = window.setTimeout(() => void load(), due);
    }
  }

  retry.addEventListener('click', () => void load());
  document.addEventListener('visibilitychange', schedule);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      schedule();
    }).observe(panel);
  }

  void load();
}

for (const panel of document.querySelectorAll<HTMLElement>('[data-status-panel]')) mount(panel);
