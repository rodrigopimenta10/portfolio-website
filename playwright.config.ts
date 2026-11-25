// Smoke tests against the built site, served the way firebase.json describes, with the status
// service behind it answering from recorded responses. Nothing here touches the network.
//
// Locally: PW_CHANNEL=chrome npm run test:e2e   (uses the installed Google Chrome, no download)
// In CI:   npx playwright install --with-deps chromium firefox webkit && npm run test:e2e
import { defineConfig } from '@playwright/test';

const sitePort = Number(process.env['SITE_PORT'] ?? 4321);
const statusPort = Number(process.env['STATUS_PORT'] ?? 8080);
// An installed Google Chrome in place of the downloaded Chromium, for the two Chromium projects only.
const channel = process.env['PW_CHANNEL'];
const chrome = channel ? { channel } : {};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${sitePort}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 }, ...chrome } },
    // The narrowest screen the site promises to read well on.
    { name: 'phone', use: { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, ...chrome } },
    // The same tests in the other two engines, one size each: Firefox on a laptop, Safari's engine on a phone.
    { name: 'firefox', use: { browserName: 'firefox', viewport: { width: 1280, height: 800 } } },
    { name: 'safari', use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
  webServer: [
    {
      command: `uv run --directory status uvicorn portfolio_status.app:app --port ${statusPort} --log-level warning`,
      env: { STATUS_RECORDED_DIR: 'tests/fixtures/scenarios/all-up' },
      url: `http://127.0.0.1:${statusPort}/api/healthz`,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: `node scripts/serve.mjs --port ${sitePort} --api http://127.0.0.1:${statusPort}`,
      url: `http://127.0.0.1:${sitePort}/`,
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
