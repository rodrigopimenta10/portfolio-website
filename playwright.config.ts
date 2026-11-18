// Smoke tests against the built site, served the way firebase.json describes, with the status
// service behind it answering from recorded responses. Nothing here touches the network.
//
// Locally: PW_CHANNEL=chrome npm run test:e2e   (uses the installed Google Chrome, no download)
// In CI:   npx playwright install --with-deps chromium && npm run test:e2e
import { defineConfig } from '@playwright/test';

const sitePort = Number(process.env['SITE_PORT'] ?? 4321);
const statusPort = Number(process.env['STATUS_PORT'] ?? 8080);
const channel = process.env['PW_CHANNEL'];

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${sitePort}`,
    ...(channel ? { channel } : {}),
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    // The narrowest screen the site promises to read well on.
    { name: 'phone', use: { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true } },
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
