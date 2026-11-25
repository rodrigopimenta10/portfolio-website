import { describe, expect, it } from 'vitest';
import { countFor, filters, fleet, isFilter, keptBy, needOf, toRow, type Component } from '../../src/lib/tools/fleet';
import {
  advance,
  beforeItRuns,
  canGoBack,
  clampStep,
  explain,
  goBack,
  lineStates,
  runLabel,
  walkthroughs,
  type Walkthrough,
} from '../../src/lib/tools/walkthrough';

const health = walkthroughs[0]!;
const names = (components: readonly Component[]) => components.map((component) => component.name);
const component = (changes: Partial<Component>): Component => ({
  name: 'example-01',
  rack: 'SNC',
  running: '1.0',
  target: '1.0',
  config: 'matches',
  hardware: 'ok',
  ...changes,
});

describe('the script walkthroughs', () => {
  it('has three scripts, each with a command, and every step says what it prints and why', () => {
    expect(walkthroughs.map((walkthrough) => walkthrough.id)).toEqual(['health', 'storage', 'drift']);
    for (const walkthrough of walkthroughs) {
      expect(walkthrough.command).toMatch(/^uv run python [a-z-]+ --satellite AURORA-2 --gateway northgate/);
      expect(walkthrough.steps.length).toBeGreaterThan(0);
      for (const step of walkthrough.steps) {
        for (const part of [step.verb, step.text, step.title, step.why]) expect(part.trim()).not.toBe('');
      }
    }
  });

  it('keeps semicolons out of everything a visitor reads', () => {
    const shown = walkthroughs.flatMap((walkthrough) => [
      walkthrough.name,
      ...walkthrough.steps.flatMap((step) => [step.text, step.title, step.why]),
    ]);
    expect([...shown, beforeItRuns.title, beforeItRuns.text].filter((text) => text.includes(';'))).toEqual([]);
  });

  it('prints nothing before the first press', () => {
    expect(lineStates(health, 0)).toEqual(['waiting', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting']);
    expect(explain(health, 0)).toBe(beforeItRuns);
    expect(runLabel(health, 0)).toBe('Run it');
    expect(canGoBack(0)).toBe(false);
  });

  it('prints one more line per press, and marks only the newest as the latest', () => {
    expect(lineStates(health, 1)).toEqual(['latest', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting']);
    expect(lineStates(health, 3)).toEqual(['earlier', 'earlier', 'latest', 'waiting', 'waiting', 'waiting']);
    expect(lineStates(health, 6)).toEqual(['earlier', 'earlier', 'earlier', 'earlier', 'earlier', 'latest']);
  });

  it('advances one step per press, and starts over at the first line after the last', () => {
    const visited = [0];
    for (let press = 0; press < 8; press++) visited.push(advance(health, visited[visited.length - 1]!));

    expect(visited).toEqual([0, 1, 2, 3, 4, 5, 6, 1, 2]);
  });

  it('says what the next press does', () => {
    expect([0, 1, 5, 6].map((step) => runLabel(health, step))).toEqual(['Run it', 'Next step', 'Next step', 'Start over']);
  });

  it('goes back one step at a time, but never to before the first line', () => {
    expect(goBack(health, 4)).toBe(3);
    expect(goBack(health, 2)).toBe(1);
    expect(goBack(health, 1)).toBe(1);
    expect(goBack(health, 0)).toBe(0);
    expect([0, 1, 2, 6].map(canGoBack)).toEqual([false, false, true, true]);
  });

  it('explains the step whose line was just printed', () => {
    expect(explain(health, 2)).toEqual({
      label: 'Step 2 of 6',
      title: health.steps[1]!.title,
      text: health.steps[1]!.why,
    });
    for (const walkthrough of walkthroughs) {
      const last = walkthrough.steps.length;
      expect(explain(walkthrough, last).label).toBe(`Step ${last} of ${last}`);
    }
  });

  it('treats a step that does not exist as the nearest one that does', () => {
    const short: Walkthrough = { id: 'short', name: 'Short', command: 'true', steps: health.steps.slice(0, 2) };

    expect([-3, 0, 1.9, 2, 99].map((step) => clampStep(short, step))).toEqual([0, 0, 1, 2, 2]);
    expect(lineStates(short, 99)).toEqual(['earlier', 'latest']);
    expect(advance(short, 99)).toBe(1);
    expect(explain(short, -1)).toBe(beforeItRuns);
  });
});

describe('the dashboard', () => {
  it('names the one thing a component needs: hardware first, then configuration, then software', () => {
    expect(needOf(component({}))).toBe('none');
    expect(needOf(component({ target: '1.1' }))).toBe('software');
    expect(needOf(component({ target: '1.1', config: 'drifted' }))).toBe('config');
    expect(needOf(component({ config: 'change' }))).toBe('config');
    expect(needOf(component({ target: '1.1', config: 'drifted', hardware: 'fan failing' }))).toBe('hardware');
  });

  it('keeps every component under "all", in order', () => {
    expect(keptBy('all')).toEqual(fleet);
  });

  it('keeps only the components with that need', () => {
    expect(names(keptBy('software'))).toEqual(['modem-pool-02', 'controller-01']);
    expect(names(keptBy('config'))).toEqual(['timing-unit-01', 'switch-02']);
    expect(names(keptBy('hardware'))).toEqual(['upconverter-03']);
    expect(names(keptBy('none'))).toEqual(['modem-pool-01', 'controller-02', 'storage-node-04']);
  });

  it('counts each component under exactly one need, so the counts add up to the whole', () => {
    const counts = Object.fromEntries(filters.map((filter) => [filter.key, countFor(filter.key)]));

    expect(counts).toEqual({ all: 8, software: 2, config: 2, hardware: 1, none: 3 });
    expect(counts['software']! + counts['config']! + counts['hardware']! + counts['none']!).toBe(counts['all']);
  });

  it('counts and filters whatever list it is given', () => {
    const two = [component({ name: 'a' }), component({ name: 'b', hardware: 'disk failing' })];

    expect(countFor('hardware', two)).toBe(1);
    expect(names(keptBy('none', two))).toEqual(['a']);
    expect(countFor('software', [])).toBe(0);
  });

  it('recognises its own filter names and nothing else', () => {
    expect(filters.every((filter) => isFilter(filter.key))).toBe(true);
    expect([undefined, '', 'everything'].some(isFilter)).toBe(false);
  });

  it('prints a healthy component quietly', () => {
    expect(toRow(component({ running: '3.1', target: '3.1' }))).toEqual({
      name: 'example-01',
      rack: 'SNC',
      software: { text: '3.1', tone: null },
      config: { text: 'matches', tone: null },
      hardware: { text: 'ok', tone: null },
      need: { text: 'nothing', tone: 'good' },
    });
  });

  it('prints what is wrong, and how serious it is', () => {
    expect(toRow(component({ running: '4.1', target: '4.2' }))).toMatchObject({
      software: { text: '4.1 → 4.2', tone: 'warn' },
      need: { text: 'software upgrade', tone: 'warn' },
    });
    expect(toRow(component({ config: 'drifted' })).config).toEqual({ text: 'drifted', tone: 'warn' });
    expect(toRow(component({ config: 'change' }))).toMatchObject({
      config: { text: 'change needed', tone: 'warn' },
      need: { text: 'configuration fix', tone: 'warn' },
    });
    expect(toRow(component({ hardware: 'fan failing' }))).toMatchObject({
      hardware: { text: 'fan failing', tone: 'bad' },
      need: { text: 'hardware replacement', tone: 'bad' },
    });
  });
});
