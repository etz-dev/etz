const { build } = require('esbuild')

const electronMain = build({
  entryPoints: ['src/main/main.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist-electron/main.cjs',
  external: ['electron', '@etz/core'],
  sourcemap: true,
  format: 'cjs',
})

const preload = build({
  entryPoints: ['src/preload/preload.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist-electron/preload.js',
  external: ['electron'],
  sourcemap: true,
  format: 'cjs',
})

Promise.all([electronMain, preload])
  .then(() => console.log('✅ Electron built successfully'))
  .catch((err) => {
    console.error('❌ Build failed:', err)
    process.exit(1)
  })
