// Edge Function `accept`: Annahme eines Festpreis-Listings durch einen Partner (S9c, Konzept 4.5 Art A).
// verify_jwt ist aus (config.toml): das JWT prüft die Function über auth.getUser, aal2 verlangt sie selbst. Secrets: SECRET_KEY, ALLOWED_ORIGINS.
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Database } from '../_shared/database.types.ts'
import { acceptDb } from '../_shared/jobs/db.ts'
import { handleAccept } from '../_shared/jobs/handlers.ts'

const env = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} fehlt`)
  return v
}

const db = createClient<Database>(env('SUPABASE_URL'), env('SECRET_KEY'), { auth: { persistSession: false } })
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean)

Deno.serve((req) => handleAccept(req, { ...acceptDb(db), allowedOrigins, log: (e) => console.log(JSON.stringify(e)) }))
