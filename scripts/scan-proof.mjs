// Scan von docs/proof/ auf Geheimnisse, wie scan-dist.mjs (Muster für Secret-Key und JWT) und zusätzlich auf die Werte der
// Geheimnis-Variablen aus der Umgebung (kommen nur über dotenv-cli, .env.local wird hier nie gelesen). Ausgabe nie mit Fundtext oder Wert.
// Start: npm run scan:proof
import fs from 'node:fs'
import path from 'node:path'

const PATTERNS = {
  'sb_secret_-Schlüssel': /sb_secret_[A-Za-z0-9_-]{20,}/g,
  'JWT-Token': /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  'Access Token (sbp_)': /sbp_[A-Za-z0-9_]{20,}/g,
  'Verbindungs-URL mit Passwort': /postgres(?:ql)?:\/\/[^\s:/@]+:[^\s@]+@/g,
}
// Optionales Argument: anderes Verzeichnis (Rot-Beweis mit Dateien unter tmp/); Standard docs/proof.
const ROOT = process.argv[2] ?? 'docs/proof'
if (!fs.existsSync(ROOT)) {
  console.error(`ABBRUCH: ${ROOT} existiert nicht, nichts zu prüfen.`)
  process.exit(2)
}
const secretNames = Object.keys(process.env).filter((k) => /(TOKEN|PASSWORD|SECRET|API_KEY)/.test(k) && !k.startsWith('NEXT_PUBLIC_') && (process.env[k] ?? '').length >= 8)
if (secretNames.length === 0) {
  console.error('ABBRUCH: keine Geheimnis-Variablen in der Umgebung, der Wertvergleich wäre leer. Mit npm run scan:proof starten.')
  process.exit(2)
}

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))

let hits = 0
const files = walk(ROOT)
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8')
  for (const [name, re] of Object.entries(PATTERNS)) {
    const n = (text.match(re) ?? []).length
    if (n) console.log(`TREFFER ${name}: ${n} in ${file}`)
    hits += n
  }
  for (const k of secretNames) {
    if (text.includes(process.env[k])) {
      console.log(`TREFFER Wert von ${k} in ${file}`)
      hits++
    }
  }
}
console.log(`proof-Scan: ${files.length} Dateien, ${secretNames.length} Geheimnis-Werte geprüft, ${hits} Treffer`)
process.exit(hits ? 1 : 0)
