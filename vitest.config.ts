import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  },
  resolve: {
    alias: {
      '@entente/types': path.resolve(__dirname, './packages/types/src'),
      '@entente/client': path.resolve(__dirname, './packages/client/src'),
      '@entente/provider': path.resolve(__dirname, './packages/provider/src'),
      '@entente/fixtures': path.resolve(__dirname, './packages/fixtures/src'),
      '@entente/cli': path.resolve(__dirname, './packages/cli/src'),
    },
  },
})
