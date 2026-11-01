// Einmal-Einrichtung des Foto-Aufräumens im verlinkten Projekt (über dotenv-cli, gibt nie einen Wert aus):
// 1. CLEANUP_SECRET erzeugen und, falls in .env.local noch nicht vorhanden, dort anhängen (die Datei wird nicht gelesen).
// 2. Als Function-Secret setzen. 3. Secret und URL im Vault ablegen (liest der stündliche Job `photo_cleanup`). 4. Function deployen.
// Aufruf: npm run setup:photo-cleanup
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { appendFileSync } from 'node:fs'

// Bei einem Fehler nur eine feste Meldung: die Ausnahme von execFileSync enthielte die Kommandozeile samt Secret.
const supabase = (...args) => {
  try {
    execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', ...args], { stdio: ['ignore', 'ignore', 'ignore'] })
  } catch {
    console.error(`supabase ${args[0]} ${args[1]} ist fehlgeschlagen (Ausgabe aus Sicherheitsgründen unterdrückt).`)
    process.exit(1)
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL fehlt (über npm run setup:photo-cleanup starten).')
let secret = process.env.CLEANUP_SECRET
if (!secret) {
  secret = randomBytes(32).toString('hex')
  appendFileSync('.env.local', `\nCLEANUP_SECRET=${secret}\n`)
  console.log('CLEANUP_SECRET erzeugt und an .env.local angehängt.')
}
if (!/^[0-9a-f]{64}$/.test(secret)) throw new Error('CLEANUP_SECRET hat nicht das erwartete Format (64 Hexzeichen).')

supabase('secrets', 'set', `CLEANUP_SECRET=${secret}`)
const functionUrl = `${url.replace(/\/$/, '')}/functions/v1/photo-cleanup`
if (!/^https:\/\/[a-z0-9.-]+\/functions\/v1\/photo-cleanup$/.test(functionUrl)) throw new Error('Die Projekt-URL hat nicht das erwartete Format.')
supabase(
  'db',
  'query',
  '--linked',
  `delete from vault.secrets where name in ('cleanup_secret', 'cleanup_url'); select vault.create_secret('${secret}', 'cleanup_secret'); select vault.create_secret('${functionUrl}', 'cleanup_url');`,
)
supabase('functions', 'deploy', 'photo-cleanup', '--use-api')
console.log('Foto-Aufräumen eingerichtet: Secret gesetzt, Vault gefüllt, Function deployt.')
