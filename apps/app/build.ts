import vuePlugin from '@eckidevs/bun-plugin-vue'

const result = await Bun.build({
  entrypoints: ['./index.html'],
  outdir: './dist',
  plugins: [vuePlugin({ optionsApi: true })],
  minify: true,
  sourcemap: 'linked',

})

if (!result.success) {
  for (const log of result.logs) {
    console.error(log)
  }
  process.exit(1)
}

console.log(`Built ${result.outputs.length} files`)
