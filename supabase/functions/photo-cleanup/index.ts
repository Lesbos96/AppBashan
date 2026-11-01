// Edge Function `photo-cleanup`: entfernt Foto-Dateien ohne Zeile in `request_photos` (Fehl-Uploads, gelöschte Anfragen und Konten) über die Storage-API.
// Aufruf stündlich durch `public.photo_cleanup()` (pg_cron + pg_net) mit dem Header x-cleanup-secret. Function-Secrets: CLEANUP_SECRET, SECRET_KEY.
// SUPABASE_URL setzt die Plattform. Die Antwort und das Log enthalten nur Zähler, nie Pfade.
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Database } from '../_shared/database.types.ts'

const env = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} fehlt`)
  return v
}

const db = createClient<Database>(env('SUPABASE_URL'), env('SECRET_KEY'), { auth: { persistSession: false } })
const expected = env('CLEANUP_SECRET')
const MAX_ROUNDS = 10

const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))

/** Zeitkonstanter Vergleich über SHA-256-Digests gleicher Länge. */
async function sameSecret(given: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(given), digest(expected)])
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 })
  if (!(await sameSecret(req.headers.get('x-cleanup-secret') ?? ''))) return new Response(null, { status: 401 })

  let removed = 0
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const orphans = await db.rpc('photo_orphans')
    if (orphans.error) {
      console.log(JSON.stringify({ event: 'photo_cleanup_error', code: orphans.error.code }))
      return Response.json({ removed }, { status: 500 })
    }
    if (orphans.data.length === 0) break
    const gone = await db.storage.from('request-photos').remove(orphans.data.map((o) => o.name))
    if (gone.error) {
      console.log(JSON.stringify({ event: 'photo_cleanup_error', removed }))
      return Response.json({ removed }, { status: 500 })
    }
    removed += gone.data.length
  }
  console.log(JSON.stringify({ event: 'photo_cleanup', removed }))
  return Response.json({ removed })
})
