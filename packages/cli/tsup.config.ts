import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'pipeline/runner': 'src/pipeline/runner.ts',
  },
  format: ['cjs'],
  target: 'node22',
  clean: true,
  dts: true,
  sourcemap: true,
})
