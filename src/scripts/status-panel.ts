// The page side of the status panel: the requests, the timers and the DOM. What the panel says in
// each state is decided in src/lib/status/panel.ts. This file asks /api/status and paints the answer.
//
// Loaded as a deferred module, so the page has painted before the first request leaves. Ages
// ("checked 42 s ago") move on and the service is asked again once a minute, but only while the
// panel is on screen and the tab is in front.
import { SLOW_AFTER_MS, fetchStatus } from '../lib/status/client';
import { INITIAL, answered, asking, panelView, stillWaiting, toggleDemo, type PanelState } from '../lib/status/panel';
import type { RowView } from '../lib/status/view';

const REFRESH_MS = 60_000;
const TICK_MS = 1_000;

function setText(element: Element | null, text: string): void {
  // Only touch the DOM when the words change, so a screen reader is not told the same thing every second.
  if (element && element.textContent !== text) element.textContent = text;
}

function paintRow(row: HTMLElement, view: RowView): void {
  row.dataset['state'] = view.state;
  setText(row.querySelector('[data-state-label]'), view.label);
  setText(row.querySelector('[data-meta]'), view.meta);
  const factLine = row.querySelector<HTMLElement>('[data-fact]');
  if (!factLine || view.fact === null) return;
  const key = `${view.fact}\n${view.reason ?? ''}`;
  if (factLine.dataset['key'] === key) return;
  factLine.dataset['key'] = key;
  factLine.textContent = view.fact;
  if (view.reason) {
    const why = document.createElement('span');
    why.className = 'reason';
    why.textContent = view.reason;
    factLine.append(why);
  }
}

function mount(panel: HTMLElement): void {
  const rows = new Map<string, HTMLElement>();
  for (const row of panel.querySelectorAll<HTMLElement>('[data-system]')) rows.set(row.dataset['system'] ?? '', row);
  const summaryLine = panel.querySelector<HTMLElement>('[data-status-summary]');
  const foot = panel.querySelector<HTMLElement>('[data-status-foot]');
  const note = panel.querySelector<HTMLElement>('[data-status-note]');
  const retry = panel.querySelector<HTMLButtonElement>('[data-status-retry]');
  const demo = panel.querySelector<HTMLButtonElement>('[data-status-demo]');
  if (!summaryLine || !foot || !note || !retry || !demo) return;

  let state: PanelState = INITIAL;
  let inFlight = false;
  let visible = true;
  let refreshTimer: number | undefined;
  let tickTimer: number | undefined;

  function paint(): void {
    const view = panelView(state, Date.now());
    setText(summaryLine, view.summary);
    for (const row of view.rows) {
      const element = rows.get(row.id);
      if (element) paintRow(element, row);
    }
    // The note takes the place of the small print (the stylesheet hides that while a tone is set).
    setText(note, view.note?.text ?? '');
    if (view.note) foot!.dataset['tone'] = view.note.tone;
    else delete foot!.dataset['tone'];
    retry!.hidden = !view.canRetry;
    demo!.hidden = view.canRetry;
    demo!.disabled = !view.demo.available;
    setText(demo, view.demo.label);
    panel.toggleAttribute('data-demo', view.demo.on);
  }

  function set(next: PanelState): void {
    state = next;
    paint();
  }

  async function load(): Promise<void> {
    if (inFlight) return;
    inFlight = true;
    set(asking(state));
    const slow = window.setTimeout(() => set(stillWaiting(state)), SLOW_AFTER_MS);
    const result = await fetchStatus();
    window.clearTimeout(slow);
    inFlight = false;
    set(answered(state, result));
    schedule();
  }

  function schedule(): void {
    window.clearTimeout(refreshTimer);
    window.clearInterval(tickTimer);
    if (!visible || document.hidden || state.phase !== 'read') return;
    tickTimer = window.setInterval(paint, TICK_MS);
    // Ask again a minute after the last answer, or at once if the tab was away for longer than that.
    const due = Math.max(0, REFRESH_MS - (Date.now() - state.receivedAtMs));
    refreshTimer = window.setTimeout(() => void load(), due);
  }

  retry.addEventListener('click', () => void load());
  demo.addEventListener('click', () => {
    const wasOn = state.phase === 'read' && state.demo !== null;
    set(toggleDemo(state));
    // "Run the checks again" means it: the real reading is drawn at once, and the service is asked afresh.
    if (wasOn) void load();
  });
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
