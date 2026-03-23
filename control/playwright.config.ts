import { defineConfig, devices } from '@playwright/test'
import { AUTH_STATE_FILE } from './e2e/global-setup.js'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // sequential — backend has shared state
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3000',
    storageState: AUTH_STATE_FILE,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Don't auto-start the server — Vite dev server is already running
  webServer: undefined,
})
