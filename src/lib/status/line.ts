// The one line on the home page that leads to the status panel. It says how many systems are up
// only after the service has said so. Until then, and whenever the answer cannot be trusted as a
// live reading, it is the plain link and claims nothing.
import type { FetchResult } from './client';
import { SYSTEMS } from './types';
import { listedSystems } from './view';

export const LINE_LINK = 'See the live status panel →';

/** The longest thing the line can say. The page sets the line's size from it, so nothing moves when the words arrive. */
export const LINE_WIDEST = `0 of ${SYSTEMS.length} up right now. ${LINE_LINK}`;

export interface LineView {
  state: 'unread' | 'all-up' | 'some-up';
  text: string;
}

const UNREAD: LineView = { state: 'unread', text: LINE_LINK };

/** What the line says for the result of one request, or for none yet (`null`). */
export function lineView(result: FetchResult | null): LineView {
  // Recorded responses (the service in test mode) are not a reading of anything right now.
  if (!result?.ok || result.data.recorded) return UNREAD;
  const systems = listedSystems(result.data);
  const up = systems.filter((system) => system.state === 'up').length;
  if (up === systems.length) return { state: 'all-up', text: `All ${up} up right now. ${LINE_LINK}` };
  return { state: 'some-up', text: `${up} of ${systems.length} up right now. ${LINE_LINK}` };
}
