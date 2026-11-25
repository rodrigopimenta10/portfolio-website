// The page side of the Tools page: stepping through a script and filtering the dashboard. The
// steps, the components and the rules are in src/lib/tools/. Every line and every row is already in
// the HTML, so this only decides which of them are on show. Nothing here runs on a timer.
import { fleet, isFilter, keptBy, type Filter } from '../lib/tools/fleet';
import { advance, canGoBack, explain, goBack, lineStates, runLabel, walkthroughs } from '../lib/tools/walkthrough';

export function mountWalkthroughs(root: HTMLElement): void {
  const picks = [...root.querySelectorAll<HTMLButtonElement>('[data-pick]')];
  const panels = [...root.querySelectorAll<HTMLElement>('[data-script]')];
  const runs = root.querySelectorAll<HTMLButtonElement>('[data-run]');
  const back = root.querySelector<HTMLButtonElement>('[data-back]');
  const label = root.querySelector<HTMLElement>('[data-why-label]');
  const title = root.querySelector<HTMLElement>('[data-why-title]');
  const text = root.querySelector<HTMLElement>('[data-why-text]');
  if (!back || !label || !title || !text || panels.length !== walkthroughs.length) return;

  let chosen = 0;
  let step = 0;

  function render(): void {
    const walkthrough = walkthroughs[chosen];
    if (!walkthrough) return;

    picks.forEach((pick, index) => pick.setAttribute('aria-pressed', String(index === chosen)));
    const states = lineStates(walkthrough, step);
    panels.forEach((panel, index) => {
      panel.hidden = index !== chosen;
      if (index !== chosen) return;
      panel.querySelectorAll<HTMLElement>('[data-line]').forEach((line, at) => {
        line.dataset['state'] = states[at] ?? 'waiting';
      });
    });

    for (const run of runs) run.textContent = runLabel(walkthrough, step);
    // Back stays focusable when there is nowhere to go back to, so a keyboard user who pressed it
    // down to the first step is not dropped at the top of the page.
    back!.setAttribute('aria-disabled', String(!canGoBack(step)));

    const why = explain(walkthrough, step);
    label!.textContent = why.label;
    title!.textContent = why.title;
    text!.textContent = why.text;
  }

  picks.forEach((pick, index) => {
    pick.addEventListener('click', () => {
      chosen = index;
      step = 0;
      render();
    });
  });

  for (const run of runs) {
    run.addEventListener('click', () => {
      const walkthrough = walkthroughs[chosen];
      if (walkthrough) step = advance(walkthrough, step);
      render();
    });
  }

  back.addEventListener('click', () => {
    const walkthrough = walkthroughs[chosen];
    if (walkthrough) step = goBack(walkthrough, step);
    render();
  });

  // Until now the page showed every step of every script, for a reader without JavaScript.
  for (const heading of root.querySelectorAll('[data-script-name]')) heading.classList.add('visually-hidden');
  root.dataset['live'] = '';
  render();
}

export function mountFleet(root: HTMLElement): void {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  const rows = root.querySelectorAll<HTMLElement>('[data-component]');

  function show(filter: Filter): void {
    const kept = new Set(keptBy(filter, fleet).map((component) => component.name));
    for (const row of rows) row.hidden = !kept.has(row.dataset['component'] ?? '');
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset['filter'] === filter));
  }

  for (const button of buttons) {
    const filter = button.dataset['filter'];
    if (!isFilter(filter)) continue;
    button.disabled = false;
    button.addEventListener('click', () => show(filter));
  }
}
