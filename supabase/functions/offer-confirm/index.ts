// Edge Function `offer-confirm`: Bestätigung eines Festangebots durch den Kunden (S9e, Konzept 4.5 Art A, T5).
// verify_jwt ist aus (config.toml): das JWT prüft die Function über auth.getUser. Secrets: SECRET_KEY, ALLOWED_ORIGINS.
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Database } from '../_shared/database.types.ts'
import { offerDb } from '../_shared/jobs/db.ts'
import { handleConfirmOffer } from '../_shared/jobs/handlers.ts'

const env = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} fehlt`)
  return v
}

const db = createClient<Database>(env('SUPABASE_URL'), env('SECRET_KEY'), { auth: { persistSession: false } })
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean)

Deno.serve((req) => handleConfirmOffer(req, { ...offerDb(db), allowedOrigins, log: (e) => console.log(JSON.stringify(e)) }))
