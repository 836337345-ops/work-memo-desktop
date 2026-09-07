import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'D:/qa-v26-playwright-report' }]],
  outputDir: 'D:/qa-v26-test-results',
  use: {
    baseURL: 'http://127.0.0.1:4286',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } }],
  webServer: {
    command: 'npm run dev -- --config vite.qa.config.ts --port 4286',
    url: 'http://127.0.0.1:4286',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
