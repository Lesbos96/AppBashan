// Leert den Bucket request-photos über die Storage-API (ein DELETE auf storage.objects ließe die Dateien liegen). Nur Dev-Projekt.
// Läuft nach der Migration 0017 (dann gibt es keine Zeilen mehr, die auf fehlende Dateien zeigen); wiederholbar.
// Start: npx dotenv -e .env.local -- node scripts/storage-reset.mjs
import './dev-guard.mjs'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'request-photos'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

// Ordner haben keine id; Dateien schon. Rekursiv sammeln, in Blöcken entfernen.
async function files(prefix) {
  const out = []
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 100, offset })
    if (error) throw error
    for (const e of data) {
      const path = prefix === '' ? e.name : `${prefix}/${e.name}`
      if (e.id === null) out.push(...(await files(path)))
      else out.push(path)
    }
    if (data.length < 100) return out
  }
}

const all = await files('')
for (let i = 0; i < all.length; i += 100) {
  const { error } = await db.storage.from(BUCKET).remove(all.slice(i, i + 100))
  if (error) throw error
}
console.log(`request-photos: ${all.length} Dateien entfernt`)
const left = await files('')
if (left.length > 0) {
  console.error(`FEHLER: ${left.length} Dateien übrig`)
  process.exit(1)
}
