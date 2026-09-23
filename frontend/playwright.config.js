import { defineConfig } from '@playwright/test';

const built = process.env.E2E_BUILT === '1';
const port = built ? 4173 : 5173;
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 60000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: `http://127.0.0.1:${port}`, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'laptop', use: { viewport: { width: 1366, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: built ? 'npm run preview' : 'npm run dev', url: `http://127.0.0.1:${port}`, reuseExistingServer: !process.env.CI, timeout: 30000 },
});
