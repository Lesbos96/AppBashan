// Edge Function `admin-contact`: Kontakt eines Auftrags für den Support (S9c). Nur admin mit aal2, Begründung Pflicht, Audit in der Datenbank.
// Phase 1 ohne Oberfläche: Aufruf per Skript mit dem JWT von admin. Secrets: SECRET_KEY, ALLOWED_ORIGINS.
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Database } from '../_shared/database.types.ts'
import { contactDb } from '../_shared/jobs/db.ts'
import { handleAdminContact } from '../_shared/jobs/handlers.ts'

const env = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} fehlt`)
  return v
}

const db = createClient<Database>(env('SUPABASE_URL'), env('SECRET_KEY'), { auth: { persistSession: false } })
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean)

Deno.serve((req) => handleAdminContact(req, { ...contactDb(db), allowedOrigins, log: (e) => console.log(JSON.stringify(e)) }))
