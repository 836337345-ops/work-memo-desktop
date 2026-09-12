import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  outputDir: 'D:/qa-v212-results',
  use: { baseURL: 'http://127.0.0.1:4292', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'edge-v212', use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 1280, height: 720 } } }],
  webServer: { command: 'npm run dev -- --config vite.qa.config.ts --port 4292', url: 'http://127.0.0.1:4292', reuseExistingServer: false, timeout: 30_000 },
});
