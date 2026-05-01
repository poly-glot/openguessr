#!/usr/bin/env node
// Builds public/assets/flags-sprite.svg from flag-icons (MIT) for every
// country in src/data/countries.js. Re-run after editing the country list.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { continents } from '../src/data/countries.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const flagsDir = join(repoRoot, 'node_modules/flag-icons/flags/4x3')
const outFile = join(repoRoot, 'public/assets/flags-sprite.svg')

const codes = Object.values(continents).flat().map(c => c.code.toLowerCase())
const seen = new Set()
const symbols = []

for (const code of codes) {
  if (seen.has(code)) continue
  seen.add(code)
  const path = join(flagsDir, `${code}.svg`)
  if (!existsSync(path)) {
    console.warn(`flag-icons missing: ${code}`)
    continue
  }
  const raw = readFileSync(path, 'utf8')
  const inner = raw
    .replace(/^[\s\S]*?<svg[^>]*viewBox="([^"]+)"[^>]*>/, (_, vb) => `<symbol id="flag-${code}" viewBox="${vb}">`)
    .replace(/<\/svg>\s*$/, '</symbol>')
  symbols.push(inner)
}

const sprite = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated from flag-icons (MIT, https://github.com/lipis/flag-icons) -->
<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">
${symbols.join('\n')}
</svg>
`

writeFileSync(outFile, sprite)
const sizeKb = Math.round(Buffer.byteLength(sprite) / 1024)
console.log(`wrote ${outFile} — ${seen.size} flags, ${sizeKb} KB`)
