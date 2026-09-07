import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  grep: /V2\.8 独立验收/,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  outputDir: 'D:/qa-v28-results',
  use: {
    baseURL: 'http://127.0.0.1:4288',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'edge-v28', use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 1280, height: 720 } } },
  ],
  webServer: {
    command: 'npm run dev -- --config vite.qa.config.ts --port 4288',
    url: 'http://127.0.0.1:4288',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
