import { describe, expect, it } from 'vitest';
import { fetchStatus, isStatusResponse, type FetchResult } from '../../src/lib/status/client';
import { DEMO_BUTTON, DEMO_REASON, demoTarget, withFailedCheck } from '../../src/lib/status/demo';
import { LINE_LINK, LINE_WIDEST, lineView } from '../../src/lib/status/line';
import { INITIAL, answered, asking, panelView, stillWaiting, toggleDemo, type PanelState } from '../../src/lib/status/panel';
import { SYSTEMS, type State, type StatusResponse, type SystemStatus } from '../../src/lib/status/types';
import { age, ageOf, listedSystems, metaLine, rowView, summary, utcTime } from '../../src/lib/status/view';

const sightline: SystemStatus = {
  id: 'sightline',
  name: 'Sightline',
  url: 'https://lunarsightline.com',
  state: 'up',
  checked_at: '2026-11-18T19:14:05Z',
  fact: 'Serving revision r1 in us-east4',
};
const orbital: SystemStatus = {
  id: 'orbital-watch',
  name: 'Orbital Watch',
  url: 'https://orbital.rodrigopimenta.com',
  state: 'up',
  checked_at: '2026-11-18T19:14:19Z',
  fact: '7 of 7 data sources fresh',
  since: '2026-11-18T18:02:05Z',
  since_label: 'data published',
};
const aws: SystemStatus = {
  id: 'aws-platform',
  name: 'AWS platform',
  url: 'https://github.com/rodrigopimenta10/aws-platform-terraform/actions/workflows/live-drill.yml',
  state: 'up',
  checked_at: '2026-11-18T19:14:19Z',
  fact: 'Last live drill passed',
};
// The service also reports on the site itself. The panel does not list it.
const thisSite: SystemStatus = {
  id: 'this-site',
  name: 'This site',
  url: 'https://rodrigopimenta.com/how-this-site-runs',
  state: 'up',
  checked_at: '2026-11-18T19:14:19Z',
  fact: 'Status service running',
};

const answer: StatusResponse = { generated_at: '2026-11-18T19:14:19Z', recorded: false, systems: [sightline, orbital, aws, thisSite] };

const withStates = (...states: State[]): StatusResponse => ({
  ...answer,
  systems: [sightline, orbital, aws].map((system, index) => ({ ...system, state: states[index] ?? 'up' })),
});
const ok = (data: StatusResponse, receivedAtMs = 0): FetchResult => ({ ok: true, data, receivedAtMs });
const read = (data: StatusResponse = answer): PanelState => answered(INITIAL, ok(data));

const respond = (body: unknown, status = 200) =>
  (async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as typeof fetch;

describe('fetchStatus', () => {
  it('returns the answer and when it arrived', async () => {
    const result = await fetchStatus(respond(answer), { now: () => 1234 });

    expect(result).toEqual({ ok: true, data: answer, receivedAtMs: 1234 });
  });

  it('reports an error status without throwing', async () => {
    expect(await fetchStatus(respond({ error: 'x' }, 503))).toEqual({ ok: false, reason: 'it answered HTTP 503' });
  });

  it('reports an HTML page where JSON was expected', async () => {
    expect(await fetchStatus(respond('<!doctype html><title>Not found</title>'))).toEqual({ ok: false, reason: 'its answer was not JSON' });
  });

  it('reports JSON of the wrong shape', async () => {
    expect(await fetchStatus(respond({ systems: 'no' }))).toEqual({ ok: false, reason: 'its answer was not in the expected shape' });
  });

  it('reports a network failure', async () => {
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;

    expect(await fetchStatus(offline)).toEqual({ ok: false, reason: 'the request did not get through' });
  });

  it('gives up after the timeout', async () => {
    const never = ((_url: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as typeof fetch;

    expect(await fetchStatus(never, { timeoutMs: 20 })).toEqual({ ok: false, reason: 'no answer within 0 seconds' });
  });
});

describe('isStatusResponse', () => {
  it('rejects a row with a state the page does not know', () => {
    const odd = { ...answer, systems: [{ ...sightline, state: 'fine' }] };

    expect(isStatusResponse(odd)).toBe(false);
    expect(isStatusResponse(answer)).toBe(true);
  });
});

describe('ages', () => {
  it.each([
    [0, 'just now'],
    [4_400, 'just now'],
    [42_000, '42 s ago'],
    [89_000, '89 s ago'],
    [90_000, '1 min ago'],
    [59 * 60_000, '59 min ago'],
    [60 * 60_000, '1 h ago'],
    [72 * 60_000 + 14_000, '1 h 12 min ago'],
    [47 * 3_600_000, '47 h ago'],
    [49 * 3_600_000, '2 days ago'],
    [-5_000, 'just now'],
  ])('%d ms is "%s"', (ms, text) => {
    expect(age(ms)).toBe(text);
  });

  it('measures on the service clock, so a wrong visitor clock does not matter', () => {
    // The answer arrived when the visitor's clock read 5_000_000 (a nonsense time), 30 s ago.
    const received = 5_000_000;

    expect(ageOf('2026-11-18T19:14:05Z', answer, received, received)).toBe('14 s ago');
    expect(ageOf('2026-11-18T19:14:05Z', answer, received, received + 30_000)).toBe('44 s ago');
  });

  it('writes the line under a fact', () => {
    expect(metaLine(orbital, answer, 0, 0)).toBe('checked just now · data published 1 h 12 min ago');
    expect(metaLine(sightline, answer, 0, 0)).toBe('checked 14 s ago');
  });

  it('formats a time of day in UTC', () => {
    expect(utcTime('2026-11-18T19:14:19.912385Z')).toBe('19:14:19 UTC');
  });
});

describe('the systems the panel lists', () => {
  it('are three, and the site itself is not one of them', () => {
    expect(SYSTEMS.map((system) => system.id)).toEqual(['sightline', 'orbital-watch', 'aws-platform']);
  });

  it('leaves out a system the service reports and the panel does not list', () => {
    expect(listedSystems(answer)).toEqual([sightline, orbital, aws]);
  });

  it('keeps the panel order whatever order the service answers in', () => {
    const shuffled = { ...answer, systems: [thisSite, aws, sightline, orbital] };

    expect(listedSystems(shuffled).map((system) => system.id)).toEqual(['sightline', 'orbital-watch', 'aws-platform']);
  });

  it('does not count a system as up because the service left it out', () => {
    const systems = listedSystems({ ...answer, systems: [sightline, aws, thisSite] });

    expect(systems[1]).toMatchObject({ id: 'orbital-watch', name: 'Orbital Watch', state: 'unknown', reason: 'The status service did not report on this system.' });
    expect(summary(systems)).toBe('2 up · 1 could not check');
  });
});

describe('summary', () => {
  it('says when everything is up', () => {
    expect(summary(listedSystems(answer))).toBe('All 3 up');
  });

  it('counts what is not', () => {
    expect(summary(listedSystems(withStates('unknown', 'up', 'up')))).toBe('2 up · 1 could not check');
    expect(summary(listedSystems(withStates('up', 'degraded', 'down')))).toBe('1 up · 1 degraded · 1 down');
    expect(summary(listedSystems(withStates('unknown', 'unknown', 'down')))).toBe('0 up · 1 down · 2 could not check');
  });
});

describe('a row', () => {
  it('shows the fact and when it was checked', () => {
    expect(rowView(orbital, answer, 0, 0)).toEqual({
      id: 'orbital-watch',
      state: 'up',
      label: 'up',
      fact: '7 of 7 data sources fresh',
      reason: null,
      meta: 'checked just now · data published 1 h 12 min ago',
    });
  });

  it('keeps its fact when degraded and adds why', () => {
    const degraded: SystemStatus = { ...orbital, state: 'degraded', fact: '3 of 7 data sources fresh', reason: '4 of its 7 sources are stale.' };

    expect(rowView(degraded, answer, 0, 0)).toMatchObject({ label: 'degraded', fact: '3 of 7 data sources fresh', reason: '4 of its 7 sources are stale.' });
  });

  it('says why a check failed and how old the last good answer is', () => {
    const failing: SystemStatus = {
      id: sightline.id,
      name: sightline.name,
      url: sightline.url,
      state: 'unknown',
      checked_at: '2026-11-18T19:14:19Z',
      reason: 'No answer within 4 seconds.',
      last_known: { state: 'up', fact: 'Serving revision r1 in us-east4', checked_at: '2026-11-18T19:10:19Z' },
    };

    expect(rowView(failing, answer, 0, 0)).toMatchObject({
      state: 'unknown',
      label: 'could not check',
      fact: 'No answer within 4 seconds.',
      reason: null,
      meta: 'last known answer: up, 4 min ago',
    });
  });

  it('claims no last known answer when there is none', () => {
    const failing: SystemStatus = { id: 'sightline', name: 'Sightline', url: sightline.url, state: 'unknown', checked_at: '2026-11-18T19:14:19Z' };

    expect(rowView(failing, answer, 0, 0)).toMatchObject({ fact: 'The check failed.', meta: 'checked just now' });
  });
});

describe('failing one check on purpose', () => {
  it('picks the first system that is up', () => {
    expect(demoTarget(listedSystems(answer))).toBe('sightline');
    expect(demoTarget(listedSystems(withStates('down', 'up', 'up')))).toBe('orbital-watch');
    expect(demoTarget(listedSystems(withStates('down', 'unknown', 'degraded')))).toBeNull();
  });

  it('draws that system as a timed-out check with its real answer as the last known one', () => {
    const staged = withFailedCheck(listedSystems(answer), 'sightline');

    expect(staged?.[0]).toEqual({
      id: 'sightline',
      name: 'Sightline',
      url: 'https://lunarsightline.com',
      state: 'unknown',
      checked_at: sightline.checked_at,
      reason: DEMO_REASON,
      last_known: { state: 'up', fact: 'Serving revision r1 in us-east4', checked_at: sightline.checked_at },
    });
    expect(staged?.slice(1)).toEqual([orbital, aws]);
  });

  it('changes nothing in the reading it was given', () => {
    const real = listedSystems(answer);
    const before = structuredClone(real);

    withFailedCheck(real, 'sightline');

    expect(real).toEqual(before);
  });

  it('refuses to paint over a system that is not up', () => {
    expect(withFailedCheck(listedSystems(withStates('degraded', 'up', 'up')), 'sightline')).toBeNull();
    expect(withFailedCheck(listedSystems(answer), 'no-such-system')).toBeNull();
  });
});

describe('the panel', () => {
  it('starts by checking, with the rows it will fill and nothing claimed', () => {
    const view = panelView(asking(INITIAL), 0);

    expect(view.summary).toBe('Checking…');
    expect(view.rows).toHaveLength(3);
    expect(view.rows.every((row) => row.state === 'loading' && row.label === 'checking' && row.fact === null)).toBe(true);
    expect(view.note).toBeNull();
    expect(view.canRetry).toBe(false);
    expect(view.demo).toEqual({ on: false, label: DEMO_BUTTON.start, available: false });
  });

  it('explains a slow first answer', () => {
    const view = panelView(stillWaiting(asking(INITIAL)), 0);

    expect(view.note?.tone).toBe('waiting');
    expect(view.note?.text).toMatch(/^Still waiting\./);
  });

  it('shows three rows and counts three once the service answers', () => {
    const view = panelView(read(), 0);

    expect(view.summary).toBe('All 3 up');
    expect(view.rows.map((row) => row.id)).toEqual(['sightline', 'orbital-watch', 'aws-platform']);
    expect(view.note).toBeNull();
    expect(view.demo).toEqual({ on: false, label: 'Fail one check on purpose', available: true });
  });

  it('says so when the answers are recorded ones', () => {
    expect(panelView(read({ ...answer, recorded: true }), 0).note).toEqual({
      tone: 'recorded',
      text: 'Recorded responses, not live data: the service is running in test mode.',
    });
  });

  it('claims nothing when the service does not answer, and offers to try again', () => {
    const view = panelView(answered(asking(INITIAL), { ok: false, reason: 'it answered HTTP 502' }), 0);

    expect(view.summary).toBe('Could not check');
    expect(view.rows.every((row) => row.state === 'unknown' && row.label === 'could not check')).toBe(true);
    expect(view.note).toEqual({
      tone: 'failed',
      text: 'The status service did not answer: it answered HTTP 502. Nothing on this panel is live right now. The systems themselves may be fine.',
    });
    expect(view.canRetry).toBe(true);
    expect(view.demo.available).toBe(false);
  });

  it('remembers when the last answer arrived if a later request fails', () => {
    const view = panelView(answered(read(), { ok: false, reason: 'the request did not get through' }), 0);

    expect(view.note?.text).toContain('The last answer arrived at 19:14:19 UTC.');
  });

  it('says it is asking again on a retry, and a reading on screen stays while it is refreshed', () => {
    const failed = answered(INITIAL, { ok: false, reason: 'x' });

    expect(panelView(asking(failed), 0).rows[0]).toMatchObject({ state: 'loading', fact: 'Asking again…' });
    expect(asking(read())).toEqual(read());
    expect(stillWaiting(read())).toEqual(read());
  });

  it('has nothing to demonstrate before a reading, or when nothing is up', () => {
    expect(toggleDemo(INITIAL)).toEqual(INITIAL);

    const noneUp = read(withStates('down', 'unknown', 'degraded'));
    expect(panelView(noneUp, 0).demo.available).toBe(false);
    expect(panelView(toggleDemo(noneUp), 0).demo.on).toBe(false);
  });

  it('draws one check as failed and says everywhere that it is a demonstration', () => {
    const view = panelView(toggleDemo(read()), 26_000);

    expect(view.rows[0]).toEqual({
      id: 'sightline',
      state: 'unknown',
      label: 'could not check',
      fact: 'The check timed out after 4 seconds.',
      reason: null,
      meta: 'last known answer: up, 40 s ago',
    });
    expect(view.rows.slice(1).map((row) => row.state)).toEqual(['up', 'up']);
    expect(view.summary).toBe('Demonstration: 2 up · 1 could not check');
    expect(view.note).toEqual({
      tone: 'demo',
      text: 'A demonstration, not a real reading: Sightline is drawn the way a failed check looks, in your browser only. Nothing has failed.',
    });
    expect(view.demo).toEqual({ on: true, label: 'Run the checks again', available: true });
  });

  it('goes back to the reading as it was read when the button is pressed again', () => {
    const before = read();

    expect(toggleDemo(toggleDemo(before))).toEqual(before);
    expect(panelView(toggleDemo(toggleDemo(before)), 0)).toEqual(panelView(before, 0));
  });

  it('keeps the demonstration over a fresh reading, and drops it when its system is really not up', () => {
    const on = toggleDemo(read());

    const stillUp = answered(on, ok(answer, 60_000));
    expect(stillUp).toMatchObject({ phase: 'read', receivedAtMs: 60_000, demo: 'sightline' });

    const reallyDown = withStates('down', 'up', 'up');
    const dropped = answered(on, ok(reallyDown, 60_000));
    expect(dropped).toMatchObject({ phase: 'read', demo: null });
    expect(panelView(dropped, 60_000).summary).toBe('2 up · 1 down');
  });

  it('ends the demonstration when the service stops answering', () => {
    const view = panelView(answered(toggleDemo(read()), { ok: false, reason: 'no answer within 10 seconds' }), 0);

    expect(view.summary).toBe('Could not check');
    expect(view.demo.on).toBe(false);
  });
});

describe('the line on the home page', () => {
  it('is the plain link until something was read', () => {
    expect(lineView(null)).toEqual({ state: 'unread', text: 'See the live status panel →' });
  });

  it('says all three are up only when the service said so', () => {
    expect(lineView(ok(answer))).toEqual({ state: 'all-up', text: 'All 3 up right now. See the live status panel →' });
  });

  it('says how many of the three are up when fewer are', () => {
    expect(lineView(ok(withStates('unknown', 'up', 'up')))).toEqual({ state: 'some-up', text: '2 of 3 up right now. See the live status panel →' });
    expect(lineView(ok(withStates('down', 'degraded', 'unknown'))).text).toBe('0 of 3 up right now. See the live status panel →');
    // A system the service left out is not up.
    expect(lineView(ok({ ...answer, systems: [sightline, thisSite] })).text).toBe('1 of 3 up right now. See the live status panel →');
  });

  it('claims nothing when the service did not answer or answered from recordings', () => {
    expect(lineView({ ok: false, reason: 'it answered HTTP 502' })).toEqual({ state: 'unread', text: LINE_LINK });
    expect(lineView(ok({ ...answer, recorded: true }))).toEqual({ state: 'unread', text: LINE_LINK });
  });

  it('never says anything longer than the text that sets its size', () => {
    const said = [null, ok(answer), ok(withStates('unknown', 'up', 'up')), ok(withStates('down', 'down', 'down'))].map((result) => lineView(result).text);

    expect(said.every((text) => text.length <= LINE_WIDEST.length)).toBe(true);
  });
});
