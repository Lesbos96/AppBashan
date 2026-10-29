// Meldet nur Variablennamen, nie Werte. Läuft über dotenv-cli mit .env.local.
import { readFileSync } from 'node:fs'

const expected = readFileSync('.env.example', 'utf8')
  .split(/\r?\n/)
  .filter((line) => /^[A-Z0-9_]+=/.test(line))
  .map((line) => line.split('=')[0])
const missing = expected.filter((name) => !process.env[name])
const unknown = Object.keys(process.env).filter(
  (name) => /^(VITE_|NEXT_PUBLIC_|SUPABASE_)/.test(name) && !expected.includes(name),
)

for (const name of expected) console.log(`${process.env[name] ? 'gesetzt' : 'FEHLT  '}  ${name}`)
if (unknown.length) console.log(`Weitere Namen: ${unknown.join(', ')}`)
process.exit(missing.length ? 1 : 0)
