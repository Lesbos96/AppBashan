// Edge Function `cancel-partner`: Storno des Partners nach Annahme (S9h-2, Konzept 4.5 Art A, T13). aal2 Pflicht (die Function prüft aal aus dem JWT).
// verify_jwt ist aus (config.toml): das JWT prüft die Function über auth.getUser. Secrets: SECRET_KEY, ALLOWED_ORIGINS.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { cancelPartnerDb } from '../_shared/cancel/db.ts'
import { handleCancelPartner } from '../_shared/cancel/partner.ts'
import type { Database } from '../_shared/database.types.ts'

const env = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} fehlt`)
  return v
}

const db = createClient<Database>(env('SUPABASE_URL'), env('SECRET_KEY'), { auth: { persistSession: false } })
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean)

Deno.serve((req) => handleCancelPartner(req, { ...cancelPartnerDb(db), allowedOrigins, log: (e) => console.log(JSON.stringify(e)) }))
