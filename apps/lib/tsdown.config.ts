import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: 'esm',
  deps: { neverBundle: ['vue', 'axios'] },
  dts: true,
  clean: true
})
