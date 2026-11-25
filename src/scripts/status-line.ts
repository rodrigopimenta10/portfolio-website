// Fills the home page's line about the status panel from /api/status, after the page has painted.
// One request, no refresh: the panel itself is one press away. What the line may say is decided
// in src/lib/status/line.ts.
import { fetchStatus } from '../lib/status/client';
import { lineView } from '../lib/status/line';

const lines = document.querySelectorAll<HTMLElement>('[data-status-line]');

if (lines.length > 0) {
  void fetchStatus().then((result) => {
    const view = lineView(result);
    for (const line of lines) {
      line.dataset['state'] = view.state;
      const text = line.querySelector('[data-status-line-text]');
      if (text) text.textContent = view.text;
    }
  });
}
