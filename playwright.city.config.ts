import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['city.spec.ts', 'city-layout.spec.ts'],
  workers: 1,
  use: {
    channel: process.env.PDD_BROWSER_CHANNEL,
    baseURL: 'http://127.0.0.1:5175',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: !process.env.CI,
  },
});
