// The page side of the config drift simulation: the clock, the buttons and the text. The rules are
// in src/lib/drift-sim/engine.ts. The one interval runs only while something is still due to
// happen, the simulation is on screen and the tab is in front. Before the first push, and again
// once the racks have settled, nothing is scheduled at all.
import {
  TICK_MS,
  fixByHand,
  initialState,
  isSettled,
  pushUpdate,
  tick,
  toggleChecker,
  view,
  type DriftState,
} from '../lib/drift-sim/engine';

export function mount(root: HTMLElement): void {
  const push = root.querySelector<HTMLButtonElement>('[data-push]');
  const checker = root.querySelector<HTMLButtonElement>('[data-checker]');
  const reset = root.querySelector<HTMLButtonElement>('[data-reset]');
  const byHand = root.querySelector<HTMLButtonElement>('[data-by-hand]');
  const fuse = root.querySelector<SVGRectElement>('[data-fuse-fill]');
  if (!push || !checker || !reset || !byHand || !fuse) return;

  const missions = [...root.querySelectorAll<HTMLElement>('[data-mission]')];
  // Every place a piece of text is shown, by name. A version appears on the rack and on each file.
  const outputs = new Map<string, HTMLElement[]>();
  for (const element of root.querySelectorAll<HTMLElement>('[data-out]')) {
    const name = element.dataset['out'] ?? '';
    outputs.set(name, [...(outputs.get(name) ?? []), element]);
  }

  let state: DriftState = initialState();
  let onScreen = false;
  let timer: number | undefined;

  // Text is written only when it has changed, so the status line is announced once per event and
  // not on every tick.
  function write(name: string, text: string): void {
    for (const element of outputs.get(name) ?? []) {
      if (element.textContent !== text) element.textContent = text;
    }
  }

  function render(): void {
    const shown = view(state);
    root.dataset['status'] = shown.status;
    root.dataset['comparing'] = String(shown.comparing);
    root.dataset['fixed'] = String(shown.justFixed);

    write('snc-version', shown.sncVersion);
    write('rf-version', shown.rfVersion);
    write('rf-tag', shown.rfTag);
    write('verdict-text', shown.verdict.text);
    write('verdict-note', shown.verdict.note);
    write('impact', shown.impact);
    write('caught', String(state.caught));
    write('outages', String(state.outages));
    write('message', state.message);
    write('push-label', shown.pushLabel);
    write('checker-label', shown.checkerLabel);
    write('checker-note', shown.checkerNote);

    push!.disabled = !shown.canPush;
    checker!.setAttribute('aria-pressed', String(state.checkerOn));
    byHand!.disabled = shown.status === 'agree';
    fuse!.setAttribute('width', String(shown.fusePercent));

    shown.missions.forEach((mission, index) => {
      const item = missions[index];
      if (!item) return;
      item.dataset['done'] = String(mission.done);
      const label = item.querySelector('[data-mission-state]');
      if (label) label.textContent = mission.done ? 'Done:' : 'Not done yet:';
    });
  }

  function stop(): void {
    window.clearInterval(timer);
    timer = undefined;
  }

  function sync(): void {
    const shouldRun = onScreen && !document.hidden && !isSettled(state);
    if (shouldRun && timer === undefined) timer = window.setInterval(step, TICK_MS);
    else if (!shouldRun && timer !== undefined) stop();
  }

  function step(): void {
    state = tick(state);
    render();
    sync();
  }

  function act(change: (current: DriftState) => DriftState): void {
    state = change(state);
    render();
    sync();
  }

  push.addEventListener('click', () => {
    // Start the clock afresh, so the first tick comes a whole tick after the press.
    stop();
    act(pushUpdate);
  });

  checker.addEventListener('click', () => act(toggleChecker));

  byHand.addEventListener('click', () => {
    act(fixByHand);
    // The button has just been disabled. Hand the keyboard on to the next thing there is to do.
    push.focus();
  });

  reset.addEventListener('click', () => act(initialState));

  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver((entries) => {
    onScreen = entries.some((entry) => entry.isIntersecting);
    sync();
  }).observe(root);

  checker.disabled = false;
  reset.disabled = false;
  render();
}
