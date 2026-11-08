// Edge Function `outbox-send`: versendet wartende Mails der Outbox (S9c). Aufruf nur mit dem Header x-outbox-secret (pg_net aus
// public.outbox_dispatch). Secrets: SECRET_KEY, OUTBOX_SECRET, SMTP_URL (smtps://nutzer:passwort@host:465), MAIL_FROM, APP_URL.
// Ohne SMTP_URL antwortet jeder Aufruf mit 503 und die Zeilen bleiben pending (der Anbieter ist noch nicht gewählt).
import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'
import type { Database } from '../_shared/database.types.ts'
import { outboxDb } from '../_shared/jobs/db.ts'
import { handleOutbox } from '../_shared/jobs/handlers.ts'

const env = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} fehlt`)
  return v
}

const db = createClient<Database>(env('SUPABASE_URL'), env('SECRET_KEY'), { auth: { persistSession: false } })
const smtpUrl = Deno.env.get('SMTP_URL')
const transport = smtpUrl ? nodemailer.createTransport(smtpUrl) : null
const from = Deno.env.get('MAIL_FROM') ?? ''

Deno.serve((req) => {
  if (!transport || !from) return new Response(JSON.stringify({ error: 'mail_not_configured' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
  return handleOutbox(req, {
    ...outboxDb(db),
    secret: env('OUTBOX_SECRET'),
    appUrl: env('APP_URL'),
    send: async (m) => {
      await transport.sendMail({ from, to: m.to, subject: m.subject, text: m.text })
    },
    log: (e) => console.log(JSON.stringify(e)),
  })
})
