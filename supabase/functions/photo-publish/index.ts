// Edge Function `photo-publish`: erzeugt die Kopie eines Anfrage-Fotos ohne Metadaten im Bucket `job-photos` (S9d). Ein Aufruf je Foto, gesendet
// von public.photo_publish_dispatch (pg_cron + pg_net) mit dem Header x-publish-secret. Secrets: SECRET_KEY, PUBLISH_SECRET (Einrichtung:
// npm run setup:photo-publish). Ohne PUBLISH_SECRET antwortet jeder Aufruf mit 503; die Fotos bleiben `pending`, die Verteilung wartet.
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Database } from '../_shared/database.types.ts'
import { publishDb } from '../_shared/photo/db.ts'
import { handlePublish } from '../_shared/photo/handlers.ts'
import { processPhoto } from '../_shared/photo/process.ts'

const env = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} fehlt`)
  return v
}

const db = createClient<Database>(env('SUPABASE_URL'), env('SECRET_KEY'), { auth: { persistSession: false } })

Deno.serve((req) => handlePublish(req, { ...publishDb(db), secret: Deno.env.get('PUBLISH_SECRET') ?? '', process: processPhoto, log: (e) => console.log(JSON.stringify(e)) }))
