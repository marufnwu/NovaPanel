import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 60000,
  use: {
    baseURL: 'http://192.168.0.212:8732',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixels: 100 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.CI ? {
    command: 'cd apps/api && node dist/index.js',
    port: 8443,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  } : undefined,
});