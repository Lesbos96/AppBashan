// Scan von dist/ auf Geheimnisse: Secret-Key (sb_secret_ + mind. 20 Zeichen) und JWT-förmige Tokens.
// Außerdem dürfen die Gebühren-Tabellen nirgends im App-Code vorkommen (Kunden lesen sie nie). Die Ansicht `current_fee_rates` ist ausgenommen
// (s9i-6a, Abnahme M2): das Partner-Portal liest den geltenden Satz dort; der Name verrät nichts, den Wert schützt RLS (Kunden erhalten NULL).
// Das nackte Präfix `sb_secret_` steckt in der Client-Bibliothek und zählt nicht. Ausgabe nie mit dem Fundtext.
import fs from 'node:fs'
import path from 'node:path'

const PATTERNS = { 'sb_secret_-Schlüssel': /sb_secret_[A-Za-z0-9_-]{20,}/g, 'JWT-Token': /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, 'Gebührentabelle': /commission_entries|platform_settings/g }

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))

let hits = 0
for (const file of walk('dist')) {
  const text = fs.readFileSync(file, 'utf8')
  for (const [name, re] of Object.entries(PATTERNS)) {
    const n = (text.match(re) ?? []).length
    if (n) console.log(`TREFFER ${name}: ${n} in ${file}`)
    hits += n
  }
}
console.log(`dist-Scan: ${hits} Treffer`)
process.exit(hits ? 1 : 0)
