// Edge Function `outbox-send`: versendet wartende Mails der Outbox über die Brevo-API (S9c, mail1). Aufruf nur mit dem Header x-outbox-secret
// (pg_net aus public.outbox_dispatch). Secrets: SECRET_KEY, OUTBOX_SECRET, BREVO_API_KEY, MAIL_FROM, MAIL_BETREIBER, APP_URL.
// Ohne OUTBOX_SECRET oder ohne gültigen Header antwortet jeder Aufruf mit 401. Fehlt BREVO_API_KEY, MAIL_FROM, MAIL_BETREIBER oder APP_URL,
// antwortet ein berechtigter Aufruf mit 503 und die Zeilen bleiben pending.
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Database } from '../_shared/database.types.ts'
import { brevoSender } from '../_shared/jobs/brevo.ts'
import { outboxDb } from '../_shared/jobs/db.ts'
import { handleOutbox } from '../_shared/jobs/handlers.ts'

const env = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} fehlt`)
  return v
}

const db = createClient<Database>(env('SUPABASE_URL'), env('SECRET_KEY'), { auth: { persistSession: false } })
const apiKey = Deno.env.get('BREVO_API_KEY') ?? ''
const from = Deno.env.get('MAIL_FROM') ?? ''
const operatorEmail = Deno.env.get('MAIL_BETREIBER') ?? ''
const appUrl = Deno.env.get('APP_URL') ?? ''

// Der Handler prüft den Aufrufer zuerst (ohne OUTBOX_SECRET: jeder Aufruf 401), dann ob der Versand eingerichtet ist (`send` null: 503).
Deno.serve((req) =>
  handleOutbox(req, {
    ...outboxDb(db),
    secret: Deno.env.get('OUTBOX_SECRET') ?? '',
    appUrl,
    operatorEmail,
    send: apiKey && from && operatorEmail && appUrl ? brevoSender({ apiKey, from }) : null,
    log: (e) => console.log(JSON.stringify(e)),
  }),
)
