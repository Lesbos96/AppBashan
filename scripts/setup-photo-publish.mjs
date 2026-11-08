// Einmal-Einrichtung der Foto-Pipeline im verlinkten Projekt (über dotenv-cli, gibt nie einen Wert aus):
// 1. PUBLISH_SECRET erzeugen und, falls in .env.local noch nicht vorhanden, dort anhängen (die Datei wird nicht gelesen).
// 2. Als Function-Secret setzen. 3. Secret und URL im Vault ablegen (liest der Cron-Lauf `photo_publish_dispatch`).
// 4. Die Functions photo-publish, photo-receipt, job-photo, admin-photo und photo-cleanup deployen.
// Ohne diese Einrichtung scheitert photo_publish_dispatch bei Anfragen mit Fotos sichtbar in cron.job_run_details und die Anfragen bleiben `requested`.
// Aufruf: npm run setup:photo-publish
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
if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL fehlt (über npm run setup:photo-publish starten).')
let secret = process.env.PUBLISH_SECRET
if (!secret) {
  secret = randomBytes(32).toString('hex')
  appendFileSync('.env.local', `\nPUBLISH_SECRET=${secret}\n`)
  console.log('PUBLISH_SECRET erzeugt und an .env.local angehängt.')
}
if (!/^[0-9a-f]{64}$/.test(secret)) throw new Error('PUBLISH_SECRET hat nicht das erwartete Format (64 Hexzeichen).')

const functionUrl = `${url.replace(/\/$/, '')}/functions/v1/photo-publish`
if (!/^https:\/\/[a-z0-9.-]+\/functions\/v1\/photo-publish$/.test(functionUrl)) throw new Error('Die Projekt-URL hat nicht das erwartete Format.')
supabase('secrets', 'set', `PUBLISH_SECRET=${secret}`)
supabase(
  'db',
  'query',
  '--linked',
  `delete from vault.secrets where name in ('publish_secret', 'publish_url'); select vault.create_secret('${secret}', 'publish_secret'); select vault.create_secret('${functionUrl}', 'publish_url');`,
)
for (const fn of ['photo-publish', 'photo-receipt', 'job-photo', 'admin-photo', 'photo-cleanup']) supabase('functions', 'deploy', fn, '--use-api')

// Probeaufruf (Abnahme S9d, M2): Function-Secret und Vault-Wert müssen übereinstimmen, sonst endet später jedes Foto still in attempts_exhausted.
// Eine unbekannte Foto-ID liefert 409 (stale_claim); 401 heißt: die Secrets weichen ab, 503: PUBLISH_SECRET fehlt in der Function.
let status = 0
for (let i = 0; i < 5 && status !== 409; i++) {
  if (i > 0) await new Promise((r) => setTimeout(r, 3000))
  const res = await fetch(functionUrl, {
    method: 'POST',
    headers: { 'x-publish-secret': secret, 'content-type': 'application/json' },
    body: JSON.stringify({ job_photo_id: crypto.randomUUID(), attempt: 1 }),
  })
  status = res.status
}
if (status !== 409) {
  console.error(`Probeaufruf von photo-publish: Status ${status}, erwartet 409. Secrets prüfen (401: Vault und Function-Secret weichen ab, 503: PUBLISH_SECRET fehlt).`)
  process.exit(1)
}
console.log('Foto-Pipeline eingerichtet: Secret gesetzt, Vault gefüllt, fünf Functions deployt, Probeaufruf bestanden.')
