const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  naming: { entry: 'vue-oidc.[ext]' },
  format: 'esm',
  external: ['vue', 'axios'],
  target: 'browser',
})

if (!result.success) {
  console.error('Build failed:', result.logs)
  Bun.exit(1)
}

await Bun.spawn(['bunx', 'tsc'])

console.log('Build complete.')

export {}
