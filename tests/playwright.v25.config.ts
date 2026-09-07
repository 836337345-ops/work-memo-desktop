import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'D:/qa-v25-playwright-report-final' }]],
  outputDir: 'D:/qa-v25-test-results-final',
  use: {
    baseURL: 'http://127.0.0.1:4285',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } }],
  webServer: {
    command: 'npm run dev -- --config vite.qa.config.ts --port 4285',
    url: 'http://127.0.0.1:4285',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
