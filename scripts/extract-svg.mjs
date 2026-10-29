// Kopiert jedes <svg> aus der Design-Referenz byte-genau nach tmp/svg/, gleiche SVGs nur einmal.
// index.tsv: Datei, Fundstellen (Screen:Zeile), öffnendes Tag. Pfaddaten nie abtippen, nur von hier kopieren.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'

const src = 'docs/reference/design/html'
const out = 'tmp/svg'
const found = new Map() // Markup → { file, places }

for (const page of readdirSync(src).filter((name) => name.endsWith('.html'))) {
  const html = readFileSync(`${src}/${page}`, 'utf8')
  let depth = 0
  let start = 0
  for (const tag of html.matchAll(/<\/?svg\b/g)) {
    if (tag[0] === '<svg') {
      if (depth++ === 0) start = tag.index
      continue
    }
    if (--depth < 0) throw new Error(`${page}: </svg> ohne <svg>`)
    if (depth > 0) continue
    const svg = html.slice(start, html.indexOf('>', tag.index) + 1)
    const place = `${page.replace('.html', '')}:${html.slice(0, start).split('\n').length}`
    const entry = found.get(svg)
    if (entry) entry.places.push(place)
    else found.set(svg, { file: `${String(found.size + 1).padStart(3, '0')}.svg`, places: [place] })
  }
  if (depth !== 0) throw new Error(`${page}: <svg> nicht geschlossen`)
}

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
const index = ['datei\tfundstellen\ttag']
for (const [svg, { file, places }] of found) {
  writeFileSync(`${out}/${file}`, svg)
  index.push(`${file}\t${places.join(' ')}\t${svg.slice(0, svg.indexOf('>') + 1).replace(/\s+/g, ' ')}`)
}
writeFileSync(`${out}/index.tsv`, `${index.join('\n')}\n`)
console.log(`${found.size} verschiedene SVGs nach ${out}/`)
