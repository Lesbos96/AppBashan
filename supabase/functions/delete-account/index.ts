// Edge Function `delete-account`: Konto löschen mit Anonymisierung (S9h-4). Das Konto bleibt als anonyme Zeile, Personendaten verschwinden.
// verify_jwt ist aus (config.toml): das JWT prüft die Function über auth.getUser. Secrets: SECRET_KEY, ALLOWED_ORIGINS.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { accountDb } from '../_shared/account/db.ts'
import { handleDeleteAccount } from '../_shared/account/handlers.ts'
import type { Database } from '../_shared/database.types.ts'

const env = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} fehlt`)
  return v
}

const db = createClient<Database>(env('SUPABASE_URL'), env('SECRET_KEY'), { auth: { persistSession: false } })
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean)

Deno.serve((req) => handleDeleteAccount(req, { ...accountDb(db), allowedOrigins, log: (e) => console.log(JSON.stringify(e)) }))
