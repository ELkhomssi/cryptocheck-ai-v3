import { mkdirSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import * as esbuild from 'esbuild'

mkdirSync('dist', { recursive: true })

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: '__CCAIPAY__',
  outfile: 'dist/ccai-pay.min.js',
  target: ['es2020'],
  platform: 'browser',
  footer: {
    js: 'var CCAIPay = __CCAIPAY__.CCAIPay; var CCAIPayDefault = __CCAIPAY__.default;',
  },
  logLevel: 'info',
})

const bytes = readFileSync('dist/ccai-pay.min.js')
const gz = gzipSync(bytes)
const kb = (gz.length / 1024).toFixed(2)

console.log(`ccai-pay.min.js: ${bytes.length} bytes raw, ${kb} KB gzip`)

if (gz.length > 50 * 1024) {
  console.warn(`WARN: bundle exceeds 50 KB gzip target (${kb} KB)`)
}
