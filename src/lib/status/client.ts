// Fetching and reading /api/status. No DOM here, so it is unit-tested as plain functions.
import type { State, StatusResponse, SystemStatus } from './types';

export const STATUS_URL = '/api/status';
/** Give up after this long. A cold start of the service takes a few seconds; this is well past that. */
export const TIMEOUT_MS = 10_000;
/** After this long without an answer the panel says it is still waiting, and why that can happen. */
export const SLOW_AFTER_MS = 2_500;

export type FetchResult =
  | { ok: true; data: StatusResponse; receivedAtMs: number }
  | { ok: false; reason: string };

const STATES: readonly State[] = ['up', 'degraded', 'down', 'unknown'];

function isSystem(value: unknown): value is SystemStatus {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row['id'] === 'string' &&
    typeof row['name'] === 'string' &&
    typeof row['url'] === 'string' &&
    typeof row['checked_at'] === 'string' &&
    STATES.includes(row['state'] as State)
  );
}

export function isStatusResponse(value: unknown): value is StatusResponse {
  if (typeof value !== 'object' || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body['generated_at'] === 'string' &&
    !Number.isNaN(Date.parse(body['generated_at'])) &&
    Array.isArray(body['systems']) &&
    body['systems'].every(isSystem)
  );
}

/**
 * Ask the status service once. Never throws: a timeout, a network error, an error status or an
 * answer of the wrong shape all come back as `{ ok: false, reason }`, with a reason fit to show.
 */
export async function fetchStatus(
  fetchImpl: typeof fetch = fetch,
  options: { timeoutMs?: number; now?: () => number; url?: string } = {},
): Promise<FetchResult> {
  const { timeoutMs = TIMEOUT_MS, now = Date.now, url = STATUS_URL } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) return { ok: false, reason: `it answered HTTP ${response.status}` };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { ok: false, reason: 'its answer was not JSON' };
    }
    if (!isStatusResponse(body)) return { ok: false, reason: 'its answer was not in the expected shape' };
    return { ok: true, data: body, receivedAtMs: now() };
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, reason: `no answer within ${Math.round(timeoutMs / 1000)} seconds` };
    return { ok: false, reason: error instanceof TypeError ? 'the request did not get through' : 'the request failed' };
  } finally {
    clearTimeout(timer);
  }
}
