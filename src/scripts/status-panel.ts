// Fills the status panel from /api/status. Loaded as a deferred module, so the page has painted
// before the first request leaves.
//
// The panel has four states and looks deliberate in each: loading (rows say "checking"), slow
// (a line explains why the wait can happen), answered (state, fact and ages per row), and failed
// (every row says "could not check" and the panel says what went wrong and offers to try again).
//
// Once it has an answer, a visitor can also make one check fail on purpose. Nothing is sent
// anywhere: for a few seconds one row is drawn as it would be if its check had timed out, with
// its last known answer, and then drawn as it really is again. The panel says it is simulated
// the whole time.
import { SLOW_AFTER_MS, fetchStatus, type FetchResult } from '../lib/status/client';
import type { StatusResponse, SystemStatus } from '../lib/status/types';
import { STATE_LABEL, lastKnownLine, metaLine, summary, utcTime } from '../lib/status/view';

const REFRESH_MS = 60_000;
const TICK_MS = 1_000;
/** How long the row stays failed in a drill, and how long the panel then says it recovered. */
const DRILL_FAILED_MS = 6_000;
const DRILL_RECOVERED_MS = 5_000;
const RECORDED_NOTE = 'Recorded responses, not live data: the service is running in test mode.';

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
  const drillButton = panel.querySelector<HTMLButtonElement>('[data-status-drill]');
  if (!summaryLine || !note || !noteText || !retry) return;

  let loaded: Loaded | null = null;
  let inFlight = false;
  let visible = true;
  let refreshTimer: number | undefined;
  let tickTimer: number | undefined;
  /** The system whose check is failing on purpose, while a drill is on. */
  let drilled: string | null = null;
  let drillTimer: number | undefined;

  function setNote(tone: 'waiting' | 'failed' | 'recorded' | 'drill' | null, text = '', withRetry = false): void {
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
    for (const real of loaded.data.systems) {
      const system = real.id === drilled ? timedOut(real) : real;
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

  /** A system as the service would report it if its check had just timed out: no fact, a reason, and the last known answer. */
  function timedOut(system: SystemStatus): SystemStatus {
    const { fact, since, since_label, latency_ms, ...rest } = system;
    void since;
    void since_label;
    void latency_ms;
    return {
      ...rest,
      state: 'unknown',
      reason: 'Simulated: this check timed out after 4 s.',
      ...(fact ? { last_known: { state: system.state, fact, checked_at: system.checked_at } } : {}),
    };
  }

  function restNote(): void {
    setNote(loaded?.data.recorded ? 'recorded' : null, loaded?.data.recorded ? RECORDED_NOTE : '');
  }

  function endDrill(): void {
    window.clearTimeout(drillTimer);
    drilled = null;
    if (drillButton) {
      drillButton.disabled = false;
      drillButton.textContent = 'Fail one check on purpose';
    }
  }

  function startDrill(): void {
    if (!loaded || drilled || !drillButton) return;
    const target = loaded.data.systems.find((system) => system.state === 'up' && rows.has(system.id));
    if (!target) return;
    drilled = target.id;
    drillButton.disabled = true;
    drillButton.textContent = 'Failing one on purpose…';
    setNote('drill', `Simulated: the check of ${target.name} is failing on purpose. Nothing real is broken. The row keeps its last known answer and says how old it is.`);
    renderLoaded();
    drillTimer = window.setTimeout(() => {
      drilled = null;
      renderLoaded();
      setNote('drill', `Recovered: ${target.name} is checked again. That is what this panel does when a real check fails.`);
      drillTimer = window.setTimeout(() => {
        endDrill();
        restNote();
      }, DRILL_RECOVERED_MS);
    }, DRILL_FAILED_MS);
  }

  function renderFailed(reason: string): void {
    endDrill();
    if (drillButton) drillButton.hidden = true;
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
      // A drill in progress keeps its own words; they give way when it ends.
      if (!drilled && note!.dataset['tone'] !== 'drill') restNote();
      renderLoaded();
      // Offered on the full panel only, and only when something is up to fail.
      if (drillButton) drillButton.hidden = rows.size < 2 || !result.data.systems.some((system) => system.state === 'up');
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
  drillButton?.addEventListener('click', startDrill);
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
