// Einmal-Einrichtung des Mailversands auf Dev (mail1; über dotenv-cli, gibt nie einen Wert aus; nur Dev, wegen APP_URL auf localhost):
// 1. OUTBOX_SECRET erzeugen und, falls in .env.local noch nicht vorhanden, dort anhängen (die Datei wird nicht gelesen).
// 2. OUTBOX_SECRET und APP_URL als Function-Secrets setzen, outbox-send deployen. BREVO_API_KEY, MAIL_FROM, MAIL_BETREIBER setzt Beks, sie werden hier nie angefasst.
// 3. Probe: eine Zeile für den Betreiber ohne Anfrage anlegen und outbox-send aufrufen, bis die Outbox leer ist. Altzeilen der Testkonten (Endung .test)
//    werden dabei als erledigt markiert, nichts davon geht an Brevo; die Probe-Zeile geht als echte Mail an MAIL_BETREIBER.
// 4. Zuletzt Secret und URL im Vault ablegen: erst damit läuft der Cron-Lauf `outbox-dispatch` (jede Minute) gegen die Function mit Schutz.
// Produktion richtet GOLIVE 35 ein (eigene APP_URL, Produktivprojekt), nicht dieses Skript.
// Aufruf: npm run setup:outbox
import './dev-guard.mjs'
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { appendFileSync } from 'node:fs'

const APP_URL = 'http://localhost:5173'

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
if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL fehlt (über npm run setup:outbox starten).')
let secret = process.env.OUTBOX_SECRET
if (!secret) {
  secret = randomBytes(32).toString('hex')
  appendFileSync('.env.local', `\nOUTBOX_SECRET=${secret}\n`)
  console.log('OUTBOX_SECRET erzeugt und an .env.local angehängt.')
}
if (!/^[0-9a-f]{64}$/.test(secret)) throw new Error('OUTBOX_SECRET hat nicht das erwartete Format (64 Hexzeichen).')

const functionUrl = `${url.replace(/\/$/, '')}/functions/v1/outbox-send`
if (!/^https:\/\/[a-z0-9.-]+\/functions\/v1\/outbox-send$/.test(functionUrl)) throw new Error('Die Projekt-URL hat nicht das erwartete Format.')

supabase('secrets', 'set', `OUTBOX_SECRET=${secret}`, `APP_URL=${APP_URL}`)
supabase('functions', 'deploy', 'outbox-send', '--use-api')

// Probe-Zeile: Empfänger Betreiber, keine Anfrage (also kein Kunde, der geprüft würde); der Schlüssel ist je Lauf neu.
supabase('db', 'query', '--linked', `select private.outbox_put('report_new', 'operator', null, null, 'probe:' || now()::text);`)

// Aufrufe, bis ein Lauf weniger als 25 Zeilen anfasst (die Function holt je Aufruf höchstens 25). Antwort 401: Secret weicht ab, 503: Brevo-Secrets fehlen.
const total = { sent: 0, failed: 0, skipped: 0 }
let done = false
for (let i = 0; i < 80 && !done; i++) {
  if (i > 0) await new Promise((r) => setTimeout(r, 500))
  const res = await fetch(functionUrl, { method: 'POST', headers: { 'x-outbox-secret': secret, 'content-type': 'application/json' }, body: '{}' })
  if (res.status !== 200) {
    console.error(`Probeaufruf von outbox-send: Status ${res.status}, erwartet 200 (401: Secret weicht ab, 503: BREVO_API_KEY, MAIL_FROM, MAIL_BETREIBER oder APP_URL fehlt).`)
    process.exit(1)
  }
  const body = await res.json()
  for (const k of Object.keys(total)) total[k] += Number(body[k]) || 0
  done = Number(body.sent) + Number(body.failed) + Number(body.skipped) < 25
}
if (!done) {
  console.error('Die Outbox war nach 80 Aufrufen nicht leer. Vault bleibt unverändert, der Cron-Lauf ist nicht scharf.')
  process.exit(1)
}
console.log(`Probe: ${total.sent} gesendet, ${total.failed} mit Fehler (später erneut), ${total.skipped} übersprungen (Testadressen).`)
if (total.sent < 1) {
  console.error('Die Probe-Mail an den Betreiber ging nicht raus. Vault bleibt unverändert, der Cron-Lauf ist nicht scharf.')
  process.exit(1)
}

supabase(
  'db',
  'query',
  '--linked',
  `delete from vault.secrets where name in ('outbox_secret', 'outbox_url'); select vault.create_secret('${secret}', 'outbox_secret'); select vault.create_secret('${functionUrl}', 'outbox_url');`,
)
console.log('Mailversand eingerichtet: Secrets gesetzt, outbox-send deployt, Probe-Mail gesendet, Vault gefüllt (Cron ab der nächsten Minute).')
