import { describe, expect, it } from 'vitest';
import { fetchStatus, isStatusResponse } from '../../src/lib/status/client';
import type { StatusResponse } from '../../src/lib/status/types';
import { age, ageOf, lastKnownLine, metaLine, summary, utcTime } from '../../src/lib/status/view';

const answer: StatusResponse = {
  generated_at: '2026-11-18T19:14:19Z',
  recorded: false,
  systems: [
    { id: 'sightline', name: 'Sightline', url: 'https://lunarsightline.com', state: 'up', checked_at: '2026-11-18T19:14:05Z', fact: 'Serving revision r1 in us-east4' },
    {
      id: 'orbital-watch',
      name: 'Orbital Watch',
      url: 'https://orbital.rodrigopimenta.com',
      state: 'up',
      checked_at: '2026-11-18T19:14:19Z',
      fact: '7 of 7 data sources fresh',
      since: '2026-11-18T18:02:05Z',
      since_label: 'data built',
    },
  ],
};

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
    const odd = { ...answer, systems: [{ ...answer.systems[0], state: 'fine' }] };

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
    expect(metaLine(answer.systems[1]!, answer, 0, 0)).toBe('checked just now · data built 1 h 12 min ago');
    expect(metaLine(answer.systems[0]!, answer, 0, 0)).toBe('checked 14 s ago');
  });

  it('formats a time of day in UTC', () => {
    expect(utcTime('2026-11-18T19:14:19.912385Z')).toBe('19:14:19 UTC');
  });
});

describe('summary', () => {
  const row = (state: StatusResponse['systems'][number]['state']) => ({ ...answer.systems[0]!, state });

  it('says when everything is up', () => {
    expect(summary([row('up'), row('up'), row('up'), row('up')])).toBe('All 4 up');
  });

  it('counts what is not', () => {
    expect(summary([row('up'), row('degraded'), row('unknown'), row('unknown')])).toBe('1 of 4 up, 1 degraded, 2 could not check');
    expect(summary([row('down'), row('up')])).toBe('1 of 2 up, 1 down');
  });
});

describe('lastKnownLine', () => {
  it('says what the last good check found, and when', () => {
    const failing = {
      ...answer.systems[0]!,
      state: 'unknown' as const,
      last_known: { state: 'up' as const, fact: 'Serving revision r1 in us-east4', checked_at: '2026-11-18T19:10:19Z' },
    };

    expect(lastKnownLine(failing, answer, 0, 0)).toBe('Last known, 4 min ago: up. Serving revision r1 in us-east4');
    expect(lastKnownLine(answer.systems[0]!, answer, 0, 0)).toBeNull();
  });
});
