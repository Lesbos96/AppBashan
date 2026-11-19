// Einmal-Einrichtung des Mailversands auf Dev (mail1; nur über `npm run loesch -- scripts/setup-outbox.mjs`, gibt nie einen Wert aus; nur Dev, wegen APP_URL auf localhost):
// 0. Prüfung: wartet eine fällige Outbox-Zeile an eine Adresse ohne reservierte Endung (.test …), bricht das Skript ab, bevor etwas geändert wird.
// 1. OUTBOX_SECRET erzeugen und, falls in .env.local noch nicht vorhanden, dort anhängen (die Datei wird nicht gelesen).
// 2. OUTBOX_SECRET, APP_URL und den Dev-Schalter DEV_MAIL_GUARD=1 als Function-Secrets setzen, outbox-send deployen. BREVO_API_KEY, MAIL_FROM, MAIL_BETREIBER setzt Beks,
//    sie werden hier nie angefasst.
// 3. Probe: frühere Probe-Zeilen verwerfen, eine neue Zeile für den Betreiber ohne Anfrage anlegen und outbox-send aufrufen, bis die Outbox leer ist. Altzeilen der
//    Testkonten (Endung .test) werden dank DEV_MAIL_GUARD übersprungen, nichts davon geht an Brevo; die Probe-Zeile geht als genau eine echte Mail an MAIL_BETREIBER.
// 4. Zuletzt, nur wenn genau eine Mail gesendet wurde, Secret und URL im Vault ablegen: erst damit läuft der Cron-Lauf `outbox-dispatch` (jede Minute) gegen die
//    Function mit Schutz. Bei einem Fehler der Probe steht die Anbieter-Diagnose (HTTP-Status und Brevo-Kürzel, nie ein Text) in der Ausgabe.
// Produktion richtet GOLIVE 35 ein (eigene APP_URL, Produktivprojekt, kein DEV_MAIL_GUARD), nicht dieses Skript.
import './dev-guard.mjs'
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { appendFileSync } from 'node:fs'

if (!process.env.MV_LOESCH_LAUF) {
  console.error('ABBRUCH: Dieses Skript läuft nur über das Lösch-Gate: npm run loesch -- scripts/setup-outbox.mjs. Keine DB-Aktion.')
  process.exit(2)
}

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
if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL fehlt (über npm run loesch starten).')
let secret = process.env.OUTBOX_SECRET
const neu = !secret
if (neu) secret = randomBytes(32).toString('hex')
if (!/^[0-9a-f]{64}$/.test(secret)) throw new Error('OUTBOX_SECRET hat nicht das erwartete Format (64 Hexzeichen).')

const functionUrl = `${url.replace(/\/$/, '')}/functions/v1/outbox-send`
if (!/^https:\/\/[a-z0-9.-]+\/functions\/v1\/outbox-send$/.test(functionUrl)) throw new Error('Die Projekt-URL hat nicht das erwartete Format.')

// 0. Der Schutz kennt nur reservierte Endungen: eine fällige Zeile an eine andere Adresse (Kunde und Firma: Anmeldeadresse des Kontos) ginge als echte Mail hinaus.
//    Das Inhaber-Konto der Firma wird wie in outbox_claim gewählt (ältester Inhaber, nie staff).
supabase(
  'db',
  'query',
  '--linked',
  `do $$ begin
     if exists (
       select 1 from public.outbox o
       left join lateral (
         select m.user_id from public.partner_members m
         where o.recipient_kind = 'partner' and m.partner_id = o.recipient_id and m.role = 'owner'
         order by m.created_at, m.user_id limit 1
       ) ow on true
       join auth.users u on u.id = case when o.recipient_kind = 'customer' then o.recipient_id else ow.user_id end
       where private.outbox_is_due(o)
         and o.recipient_kind in ('customer', 'partner')
         and u.email !~* '[.](test|invalid|example|localhost)$'
     ) then raise exception 'echte_adresse_wartet'; end if;
   end $$;`,
)

if (neu) {
  appendFileSync('.env.local', `\nOUTBOX_SECRET=${secret}\n`)
  console.log('OUTBOX_SECRET erzeugt und an .env.local angehängt.')
}

// DEV_MAIL_GUARD=1: nur auf Dev; Testadressen (.test …) und Betreiber-Meldungen zu Testkonten werden nicht versendet. Produktion setzt es nie (GOLIVE 35).
supabase('secrets', 'set', `OUTBOX_SECRET=${secret}`, `APP_URL=${APP_URL}`, 'DEV_MAIL_GUARD=1')
supabase('functions', 'deploy', 'outbox-send', '--use-api')

// Probe-Zeile: Empfänger Betreiber, keine Anfrage (also kein Kunde, der geprüft würde); der Schlüssel ist je Lauf neu. Eine frühere, nicht gesendete Probe-Zeile
// wird vorher verworfen (sie ginge sonst nach dem Wiederholungs-Abstand ein zweites Mal als Mail hinaus und die Zählung „genau eine“ stimmte nicht).
supabase(
  'db',
  'query',
  '--linked',
  `update public.outbox set status = 'failed', last_error = 'expired', claimed_at = null where dedupe_key like 'probe:%' and status in ('pending', 'sending');
   select private.outbox_put('report_new', 'operator', null, null, 'probe:' || now()::text);`,
)

// Aufrufe, bis ein Lauf weniger als 25 Zeilen anfasst (die Function holt je Aufruf höchstens 25). Antwort 401: Secret weicht ab, 503: Brevo-Secrets fehlen.
const total = { sent: 0, failed: 0, skipped: 0, expired: 0 }
const provider = {}
let done = false
for (let i = 0; i < 80 && !done; i++) {
  if (i > 0) await new Promise((r) => setTimeout(r, 500))
  const res = await fetch(functionUrl, { method: 'POST', headers: { 'x-outbox-secret': secret, 'content-type': 'application/json' }, body: '{}' })
  if (res.status !== 200) {
    console.error(`Probeaufruf von outbox-send: Status ${res.status}, erwartet 200 (401: Secret weicht ab, 503: BREVO_API_KEY, MAIL_FROM, MAIL_BETREIBER oder APP_URL fehlt).`)
    process.exit(1)
  }
  const body = await res.json()
  // Kontofehler bei Brevo (401, 402, 403, 429): die Function hat den Lauf abgebrochen und die Zeilen ohne Versuch zurückgegeben; die Probe kann so nicht gelingen
  if (Number(body.paused) > 0) {
    console.error(`Brevo meldet einen Kontofehler (${Object.keys(body.provider ?? {}).filter((k) => /^\d{3}:[a-z_-]{1,40}$/.test(k)).join(', ') || 'ohne Kürzel'}): ${body.paused} Zeilen warten, Schlüssel, Freigabe und Kontingent in Brevo prüfen. Vault bleibt unverändert.`)
    process.exit(1)
  }
  for (const k of Object.keys(total)) total[k] += Number(body[k]) || 0
  // nur Zähler je „Status:Kürzel“ (die Function liefert nie Adresse oder Text)
  for (const [k, v] of Object.entries(body.provider ?? {})) if (/^(\d{3}|netz):[a-z_-]{1,40}$/.test(k)) provider[k] = (provider[k] ?? 0) + (Number(v) || 0)
  done = Number(body.sent) + Number(body.failed) + Number(body.skipped) + Number(body.expired) < 25
}
const zahlen = { gesendet: total.sent, fehler: total.failed, uebersprungen: total.skipped, verfallen: total.expired }
for (const [k, v] of Object.entries(zahlen)) console.log(`LOESCH-ZAHL ${k}=${v}`)
console.log(`Probe: ${total.sent} gesendet, ${total.failed} mit Fehler (später erneut), ${total.skipped} übersprungen (Testadressen), ${total.expired} verfallen.`)
if (Object.keys(provider).length > 0) console.log(`Anbieter-Diagnose (Status:Kürzel=Anzahl): ${Object.entries(provider).map(([k, v]) => `${k}=${v}`).join(', ')}`)
if (!done) {
  console.error('Die Outbox war nach 80 Aufrufen nicht leer. Vault bleibt unverändert, der Cron-Lauf ist nicht scharf.')
  process.exit(1)
}
if (total.sent !== 1) {
  console.error(`Erwartet ist genau eine gesendete Mail (die Probe), gesendet wurden ${total.sent}. Vault bleibt unverändert, der Cron-Lauf ist nicht scharf.`)
  process.exit(1)
}

supabase(
  'db',
  'query',
  '--linked',
  `delete from vault.secrets where name in ('outbox_secret', 'outbox_url'); select vault.create_secret('${secret}', 'outbox_secret'); select vault.create_secret('${functionUrl}', 'outbox_url');`,
)
console.log('Mailversand eingerichtet: Secrets gesetzt, outbox-send deployt, Probe-Mail gesendet, Vault gefüllt (Cron ab der nächsten Minute).')
