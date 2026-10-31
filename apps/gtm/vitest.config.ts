import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['tests/setup-fetch.ts'],
    include: ['tests/**/*.test.ts', '__tests__/**/*.test.ts'],
    exclude: ['__tests__/evals/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
