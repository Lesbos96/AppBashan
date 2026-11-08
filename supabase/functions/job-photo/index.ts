// Edge Function `job-photo`: signierte URLs (600 s) der Foto-Kopien eines Listings (Partner) bzw. der Belege einer eigenen Anfrage (Kunde), S9d.
// Der einzige Weg zum Bucket `job-photos`. verify_jwt ist aus (config.toml): das JWT prüft die Function über auth.getUser; aal2 für Partner
// verlangt die Datenbank-Funktion. Secrets: SECRET_KEY, ALLOWED_ORIGINS.
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Database } from '../_shared/database.types.ts'
import { jobPhotoDb } from '../_shared/photo/db.ts'
import { handleJobPhoto } from '../_shared/photo/handlers.ts'

const env = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} fehlt`)
  return v
}

const db = createClient<Database>(env('SUPABASE_URL'), env('SECRET_KEY'), { auth: { persistSession: false } })
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean)

Deno.serve((req) => handleJobPhoto(req, { ...jobPhotoDb(db), allowedOrigins, log: (e) => console.log(JSON.stringify(e)) }))
