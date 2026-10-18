import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'city-performance.spec.ts',
  workers: 1,
  use: {
    actionTimeout: 10000,
    channel: process.env.PDD_BROWSER_CHANNEL,
    baseURL: 'http://127.0.0.1:5186',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5186 --strictPort',
    url: 'http://127.0.0.1:5186',
    reuseExistingServer: false,
  },
});
