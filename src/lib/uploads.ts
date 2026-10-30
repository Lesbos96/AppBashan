import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../supabase/functions/_shared/database.types.ts'
import { MAX_BYTES, type Photo } from './photos'

type Db = SupabaseClient<Database>

const BUCKET = 'request-photos'
/** Laufzeit signierter Links in Sekunden (ARCHITECTURE.md, Datenschutz). */
const SIGNED_SECONDS = 10 * 60

export type UploadResult = { uploaded: string[]; failed: Photo[] }

/**
 * Lädt Fotos einer bestehenden Anfrage in den privaten Bucket, Pfad `{user}/{request}/{id}.jpg` (`preparePhoto` liefert immer JPEG).
 * Reihenfolge wie die Policies verlangen: erst der Eintrag in `request_photos` (dort greift das Limit von 8), dann die Datei.
 * Zu große Fotos gehen gar nicht erst los. Schlägt der Upload fehl, verschwindet der Eintrag wieder. Fehlgeschlagene Fotos kommen zurück, die übrigen bleiben hochgeladen.
 */
export async function uploadPhotos(db: Db, userId: string, requestId: string, photos: readonly Photo[]): Promise<UploadResult> {
  const result: UploadResult = { uploaded: [], failed: [] }
  for (const photo of photos) {
    if (photo.blob.size > MAX_BYTES) {
      result.failed.push(photo)
      continue
    }
    const path = `${userId}/${requestId}/${photo.id}.jpg`
    const entry = await db.from('request_photos').insert({ request_id: requestId, storage_path: path })
    if (entry.error) {
      result.failed.push(photo)
      continue
    }
    const upload = await db.storage.from(BUCKET).upload(path, photo.blob, { contentType: 'image/jpeg', upsert: false })
    if (upload.error) {
      await db.from('request_photos').delete().eq('storage_path', path)
      result.failed.push(photo)
      continue
    }
    result.uploaded.push(path)
  }
  return result
}

/** Signierte Links (10 Minuten) zu den Fotos einer eigenen Anfrage; nie öffentliche Links. */
export async function photoUrls(db: Db, requestId: string): Promise<string[]> {
  const rows = await db.from('request_photos').select('storage_path').eq('request_id', requestId).order('created_at')
  if (rows.error) throw rows.error
  if (rows.data.length === 0) return []
  const signed = await db.storage.from(BUCKET).createSignedUrls(
    rows.data.map((r) => r.storage_path),
    SIGNED_SECONDS,
  )
  if (signed.error) throw signed.error
  return signed.data.flatMap((s) => (s.signedUrl ? [s.signedUrl] : []))
}
