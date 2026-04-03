import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm start',
    port: 5173,
    timeout: 120000,
    reuseExistingServer: true
  }
})
