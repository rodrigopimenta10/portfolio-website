// The page side of the storage simulation: the clock, the buttons and the text. The rules and the
// wording are in src/lib/storage-sim/engine.ts. The one interval runs only while something is
// wrong, the simulation is on screen and the tab is in front. While every node is healthy, nothing
// is scheduled at all.
//
// Each simulation on a page is mounted by itself and keeps its own state. The compact one has no
// toolbar, missions or second cluster, so every piece outside the nodes is optional here.
import {
  CHECK_EVERY_MS,
  advance,
  initialState,
  isIdle,
  toggleMonitor,
  toggleNode,
  view,
  type SimState,
} from '../lib/storage-sim/engine';

const TICK_MS = 100;

// Text and attributes are written only when they change, so 10 ticks a second touch the page only
// when a number moves.
function write(element: Element | null | undefined, text: string): void {
  if (element && element.textContent !== text) element.textContent = text;
}

function set(element: Element | null | undefined, name: string, value: string): void {
  if (element && element.getAttribute(name) !== value) element.setAttribute(name, value);
}

export function mount(root: HTMLElement): void {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-node]')];
  if (buttons.length === 0) return;

  const one = <T extends Element = HTMLElement>(selector: string): T | null => root.querySelector<T>(selector);
  const monitor = one<HTMLButtonElement>('[data-monitor]');
  const reset = one<HTMLButtonElement>('[data-reset]');
  const log = one('[data-log]');
  const latest = one('[data-latest]');
  const announcer = one('[data-announce]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let state: SimState = initialState();
  let onScreen = false;
  let timer: number | undefined;
  let shownLog = '';
  let announced = state.log[0]?.id;

  function renderLog(): void {
    const newest = state.log[0];
    if (!newest) return;
    if (latest) {
      set(latest, 'data-kind', newest.kind);
      write(latest.querySelector('[data-latest-text]'), newest.text);
    }
    const key = state.log.map((entry) => `${entry.id}:${entry.text}`).join('|');
    if (log && key !== shownLog) {
      shownLog = key;
      log.replaceChildren(
        ...state.log.map((entry) => {
          const line = document.createElement('li');
          line.dataset['kind'] = entry.kind;
          line.textContent = entry.text;
          return line;
        }),
      );
    }
    // Each new line is read out once. The line that only counts quiet checks keeps its id, so a
    // screen reader is not told "nothing new" every three seconds.
    if (newest.id !== announced) {
      announced = newest.id;
      write(announcer, newest.text);
    }
  }

  function render(): void {
    const shown = view(state);

    for (const cluster of shown.clusters) {
      const box = one(`[data-cluster="${cluster.id}"]`);
      if (!box) continue;
      set(box, 'data-tone', cluster.tone);
      write(box.querySelector('[data-cluster-state]'), cluster.status);
      for (const node of cluster.nodes) {
        const button = box.querySelector(`[data-node="${node.id}"]`);
        if (!button) continue;
        set(button, 'data-role', node.role);
        set(button, 'data-look', node.look);
        set(button, 'aria-pressed', String(node.pressed));
        set(button, 'aria-label', node.name);
        write(button.querySelector('[data-node-label]'), node.label);
        write(button.querySelector('[data-node-action]'), node.action);
        const note = button.querySelector('[data-node-note]');
        set(note, 'data-tone', node.noteTone);
        write(note, node.note);
        set(button.querySelector('[data-node-fill]'), 'width', String(node.bar));
        const ghost = button.querySelector('[data-node-ghost]');
        set(ghost, 'x', String(node.bar));
        set(ghost, 'width', String(node.ghost));
        set(ghost, 'data-fits', String(node.ghostFits));
      }
    }

    set(monitor, 'aria-pressed', String(shown.monitorOn));
    write(one('[data-monitor-label]'), shown.monitorLabel);
    write(one('[data-healed]'), String(shown.healed));
    write(one('[data-refusals]'), String(shown.refusals));
    write(one('[data-countdown-text]'), shown.countdownText);
    // The bar fills smoothly. With reduced motion it moves once a second, with the number.
    const seconds = CHECK_EVERY_MS / 1_000;
    const filled = reducedMotion.matches ? (Math.floor((shown.countdown / 100) * seconds) / seconds) * 100 : shown.countdown;
    set(one('[data-countdown-fill]'), 'width', filled.toFixed(1));

    for (const mission of shown.missions) {
      const item = one(`[data-mission="${mission.id}"]`);
      if (!item) continue;
      set(item, 'data-done', String(mission.done));
      const done = item.querySelector<HTMLElement>('[data-mission-done]');
      if (done) done.hidden = !mission.done;
    }

    renderLog();
  }

  function sync(): void {
    const shouldRun = !isIdle(state) && onScreen && !document.hidden;
    if (shouldRun && timer === undefined) {
      timer = window.setInterval(tick, TICK_MS);
    } else if (!shouldRun && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  }

  // Each tick is a fixed slice of simulated time, so a throttled tab slows the simulation down
  // and never makes it jump.
  function tick(): void {
    state = advance(state, TICK_MS);
    render();
    sync();
  }

  function act(change: (current: SimState) => SimState): void {
    state = change(state);
    render();
    sync();
  }

  for (const button of buttons) {
    button.disabled = false;
    button.addEventListener('click', () => act((current) => toggleNode(current, button.dataset['node'] ?? '')));
  }
  if (monitor) {
    monitor.disabled = false;
    monitor.addEventListener('click', () => act(toggleMonitor));
  }
  if (reset) {
    reset.disabled = false;
    reset.addEventListener('click', () => act(initialState));
  }

  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver((entries) => {
    onScreen = entries.at(-1)?.isIntersecting ?? false;
    sync();
  }).observe(root);

  render();
}
