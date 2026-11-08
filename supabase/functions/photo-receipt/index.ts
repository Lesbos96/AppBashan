// Edge Function `photo-receipt`: Beleg-Foto des Partners zu einem angenommenen Auftrag (S9d, Konzept 7.1). JPEG als Body, `?request=<id>`.
// verify_jwt ist aus (config.toml): das JWT prüft die Function über auth.getUser, aal2 verlangt sie selbst. Secrets: SECRET_KEY, ALLOWED_ORIGINS.
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Database } from '../_shared/database.types.ts'
import { receiptDb } from '../_shared/photo/db.ts'
import { handleReceipt } from '../_shared/photo/handlers.ts'
import { processPhoto } from '../_shared/photo/process.ts'

const env = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} fehlt`)
  return v
}

const db = createClient<Database>(env('SUPABASE_URL'), env('SECRET_KEY'), { auth: { persistSession: false } })
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean)

Deno.serve((req) => handleReceipt(req, { ...receiptDb(db), allowedOrigins, process: processPhoto, log: (e) => console.log(JSON.stringify(e)) }))
