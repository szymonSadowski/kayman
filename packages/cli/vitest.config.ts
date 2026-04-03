import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@kayman/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
})
