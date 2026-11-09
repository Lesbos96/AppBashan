// Edge Function `change-propose`: Nachtrag vorschlagen durch den Partner (S9f, Konzept 4.5 Art A, N1).
// verify_jwt ist aus (config.toml): das JWT prüft die Function über auth.getUser, aal2 verlangt sie selbst. Secrets: SECRET_KEY, ALLOWED_ORIGINS.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { proposeDb } from '../_shared/change/db.ts'
import { handleProposeChange } from '../_shared/change/handlers.ts'
import type { Database } from '../_shared/database.types.ts'

const env = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} fehlt`)
  return v
}

const db = createClient<Database>(env('SUPABASE_URL'), env('SECRET_KEY'), { auth: { persistSession: false } })
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean)

Deno.serve((req) => handleProposeChange(req, { ...proposeDb(db), allowedOrigins, log: (e) => console.log(JSON.stringify(e)) }))
