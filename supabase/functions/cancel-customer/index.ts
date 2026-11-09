// Edge Function `cancel-customer`: Storno des Kunden nach Vertragsschluss (S9h-1, Konzept 4.5 Art A, T12).
// verify_jwt ist aus (config.toml): das JWT prüft die Function über auth.getUser (Kunden haben kein aal2). Secrets: SECRET_KEY, ALLOWED_ORIGINS.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { cancelDb } from '../_shared/cancel/db.ts'
import { handleCancelCustomer } from '../_shared/cancel/handlers.ts'
import type { Database } from '../_shared/database.types.ts'

const env = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} fehlt`)
  return v
}

const db = createClient<Database>(env('SUPABASE_URL'), env('SECRET_KEY'), { auth: { persistSession: false } })
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean)

Deno.serve((req) => handleCancelCustomer(req, { ...cancelDb(db), allowedOrigins, log: (e) => console.log(JSON.stringify(e)) }))
