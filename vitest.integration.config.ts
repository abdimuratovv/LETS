import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    fileParallelism: false,
    env: loadEnv(mode, process.cwd(), ''),
  },
}))
