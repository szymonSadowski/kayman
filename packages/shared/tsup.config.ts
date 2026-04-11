import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  target: 'node22',
  clean: true,
  dts: true,
  sourcemap: true,
})
