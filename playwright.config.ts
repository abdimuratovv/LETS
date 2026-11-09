import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

// Test helperlari (resetData, makeTeacher) lokal Supabase kalitlarini .env.local dan oladi.
// `next dev` .env.local ni o'zi o'qiydi.
if (existsSync('.env.local')) process.loadEnvFile('.env.local')

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
