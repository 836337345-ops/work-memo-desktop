import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  grep: /V2\.7 视觉验收/,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  outputDir: 'D:/qa-v27-visual-results',
  use: {
    baseURL: 'http://127.0.0.1:4287',
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'edge-1280x720', use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 1280, height: 720 } } },
    { name: 'edge-1600x900', use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 1600, height: 900 } } },
  ],
  webServer: {
    command: 'npm run dev -- --config vite.qa.config.ts --port 4287',
    url: 'http://127.0.0.1:4287',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
