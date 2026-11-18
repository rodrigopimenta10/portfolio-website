// The page side of the failover simulation: the clock, the buttons and the log. The rules are in
// src/lib/failover/engine.ts. One interval runs while the section is on screen and the tab is in
// front; off screen, hidden or paused, nothing is scheduled at all.
import {
  CYCLE_MS,
  advance,
  beginCycle,
  initialState,
  isServing,
  loadOf,
  nextWait,
  toggleNode,
  type CycleRun,
  type LogEntry,
  type SimState,
} from '../lib/failover/engine';

const TICK_MS = 100;

function stamp(entry: LogEntry): string {
  return `t+${(entry.atMs / 1000).toFixed(1)}s`;
}

export function mount(section: HTMLElement): void {
  const timerText = section.querySelector<HTMLElement>('[data-timer-text]');
  const timerFill = section.querySelector<SVGRectElement>('[data-timer-fill]');
  const pause = section.querySelector<HTMLButtonElement>('[data-pause]');
  const reset = section.querySelector<HTMLButtonElement>('[data-reset]');
  const log = section.querySelector<HTMLElement>('[data-log]');
  const latest = section.querySelector<HTMLElement>('[data-latest]');
  if (!timerText || !timerFill || !pause || !reset || !log) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let state: SimState = initialState();
  let run: CycleRun | null = null;
  let simMs = 0;
  let cycleStartedMs = 0;
  let stepDueMs = 0;
  let lastTick = 0;
  let paused = false;
  let onScreen = false;
  let timer: number | undefined;
  let shownLog: string[] = [];
  let shownSecond = -1;

  function renderNodes(): void {
    for (const cluster of state.clusters) {
      const box = section.querySelector<HTMLElement>(`[data-cluster="${cluster.id}"]`);
      if (!box) continue;
      const serving = isServing(cluster);
      box.dataset['serving'] = String(serving);
      const label = box.querySelector('[data-cluster-state]');
      if (label) label.textContent = serving ? 'serving' : cluster.alert ? 'down · refused to move' : 'down';
      for (const node of cluster.nodes) {
        const button = box.querySelector<HTMLButtonElement>(`[data-node="${node.id}"]`);
        if (!button) continue;
        const load = loadOf(cluster, node);
        button.dataset['role'] = node.role;
        button.dataset['healthy'] = String(node.healthy);
        button.setAttribute('aria-pressed', String(!node.healthy));
        button.setAttribute(
          'aria-label',
          node.healthy
            ? `${node.id}, ${node.role}, ${load}% in use. Press to fail it.`
            : `${node.id}, failed${node.role === 'active' ? ', was serving' : ''}. Press to bring it back.`,
        );
        const role = button.querySelector('[data-node-role]');
        if (role) role.textContent = node.healthy ? node.role : 'failed';
        const text = button.querySelector('[data-node-load]');
        if (text) text.textContent = node.healthy ? `${load}% in use` : 'bring back';
        button.querySelector('[data-node-fill]')?.setAttribute('width', String(load));
      }
    }
  }

  function fill(item: HTMLElement, entry: LogEntry): void {
    item.dataset['kind'] = entry.kind;
    const at = document.createElement('span');
    at.className = 'at';
    at.textContent = stamp(entry);
    const text = document.createElement('span');
    text.className = 'text';
    const checks = entry.untilCycle
      ? `Checks ${entry.cycle} to ${entry.untilCycle}: `
      : entry.kind === 'quiet'
        ? `Check ${entry.cycle}: `
        : '';
    text.textContent = checks + entry.text;
    item.replaceChildren(at, text);
  }

  // Lines are added or changed in place, never rebuilt wholesale, so a screen reader following the
  // log hears each new line once.
  function renderLog(): void {
    const keys = state.log.map((entry) => `${entry.atMs}|${entry.untilCycle ?? ''}|${entry.text}`);
    const stale = keys.length < shownLog.length || shownLog.some((key, index) => index < keys.length - 1 && key !== keys[index]);
    if (stale || keys.length === 0) {
      log!.replaceChildren();
      shownLog = [];
    }
    if (keys.length === 0) {
      const waiting = document.createElement('li');
      waiting.className = 'placeholder';
      waiting.textContent = 'Nothing yet. The first check is on its way.';
      log!.append(waiting);
      return;
    }
    log!.querySelector('.placeholder')?.remove();
    let changed = false;
    state.log.forEach((entry, index) => {
      if (shownLog[index] === keys[index]) return;
      const existing = log!.children[index] as HTMLElement | undefined;
      const item = existing ?? document.createElement('li');
      fill(item, entry);
      if (!existing) log!.append(item);
      changed = true;
    });
    shownLog = keys;
    if (changed) log!.scrollTop = log!.scrollHeight;
    const last = state.log[state.log.length - 1];
    if (latest && last) latest.textContent = last.text;
  }

  function renderTimer(): void {
    if (paused) {
      timerText!.textContent = 'Monitor paused';
      return;
    }
    if (run) {
      timerText!.textContent = `Check ${run.cycle} running…`;
      timerFill!.setAttribute('width', '100');
      return;
    }
    const left = Math.max(0, cycleStartedMs + CYCLE_MS - simMs);
    const second = Math.ceil(left / 1000);
    if (second !== shownSecond) {
      shownSecond = second;
      timerText!.textContent = `Next check in ${second} s`;
    }
    // The bar fills smoothly; with reduced motion it moves once a second, with the number.
    const done = reducedMotion.matches ? 1 - second / (CYCLE_MS / 1000) : 1 - left / CYCLE_MS;
    timerFill!.setAttribute('width', (done * 100).toFixed(1));
  }

  function render(): void {
    renderNodes();
    renderLog();
    shownSecond = -1;
    renderTimer();
  }

  function tick(): void {
    const now = performance.now();
    simMs += now - lastTick;
    lastTick = now;
    let changed = false;
    if (!run && simMs >= cycleStartedMs + CYCLE_MS) {
      cycleStartedMs += CYCLE_MS;
      ({ state, run } = beginCycle(state));
      stepDueMs = cycleStartedMs + (nextWait(run) ?? 0);
    }
    while (run && simMs >= stepDueMs) {
      ({ state, run } = advance(state, run, stepDueMs));
      const wait = nextWait(run);
      if (wait === null) run = null;
      else stepDueMs += wait;
      changed = true;
    }
    if (changed) render();
    else renderTimer();
  }

  function sync(): void {
    const shouldRun = onScreen && !paused && !document.hidden;
    if (shouldRun && timer === undefined) {
      lastTick = performance.now();
      timer = window.setInterval(tick, TICK_MS);
    } else if (!shouldRun && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
    renderTimer();
  }

  for (const button of section.querySelectorAll<HTMLButtonElement>('[data-node]')) {
    button.disabled = false;
    button.addEventListener('click', () => {
      state = toggleNode(state, button.dataset['node'] ?? '', simMs);
      render();
    });
  }

  pause.disabled = false;
  pause.addEventListener('click', () => {
    paused = !paused;
    pause.setAttribute('aria-pressed', String(paused));
    pause.textContent = paused ? 'Resume' : 'Pause';
    shownSecond = -1;
    sync();
  });

  reset.disabled = false;
  reset.addEventListener('click', () => {
    if (latest) latest.textContent = 'Press a node to fail it.';
    state = initialState();
    run = null;
    simMs = 0;
    cycleStartedMs = 0;
    lastTick = performance.now();
    render();
  });

  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver((entries) => {
    onScreen = entries.some((entry) => entry.isIntersecting);
    sync();
  }).observe(section);

  render();
}
