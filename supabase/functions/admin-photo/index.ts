// Edge Function `admin-photo`: Originale und Kopien einer Anfrage für den Support, nur admin mit aal2, Begründung Pflicht (S9d).
// Die Datenbank-Funktion admin_photo schreibt den Eintrag im audit_log; signierte URLs 600 s. Secrets: SECRET_KEY, ALLOWED_ORIGINS.
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Database } from '../_shared/database.types.ts'
import { adminPhotoDb } from '../_shared/photo/db.ts'
import { handleAdminPhoto } from '../_shared/photo/handlers.ts'

const env = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} fehlt`)
  return v
}

const db = createClient<Database>(env('SUPABASE_URL'), env('SECRET_KEY'), { auth: { persistSession: false } })
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean)

Deno.serve((req) => handleAdminPhoto(req, { ...adminPhotoDb(db), allowedOrigins, log: (e) => console.log(JSON.stringify(e)) }))
