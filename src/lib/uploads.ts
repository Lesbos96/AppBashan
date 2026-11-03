import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../supabase/functions/_shared/database.types.ts'
import { MAX_BYTES, type Photo } from './photos'

type Db = SupabaseClient<Database>

const BUCKET = 'request-photos'
/** Laufzeit signierter Links in Sekunden (ARCHITECTURE.md, Datenschutz). */
const SIGNED_SECONDS = 10 * 60

export type UploadFailure = 'offline' | 'too_big' | 'denied' | 'failed'

export const failureText: Record<UploadFailure, string> = {
  offline: 'Keine Verbindung. Die Fotos sind noch nicht hochgeladen, die Anfrage ist nicht gesendet.',
  too_big: 'Ein Foto ist zu groß. Geh zurück, wähle ein kleineres Foto und sende die Anfrage erneut.',
  denied: 'Die Fotos lassen sich gerade nicht hochladen. Versuche es später noch einmal.',
  failed: 'Die Fotos konnten nicht hochgeladen werden. Versuche es gleich noch einmal.',
}

/** Text zu den 422 von `quote`, die die Fotos betreffen. `photo_missing` und `photo_expired` lädt die App beim erneuten Senden neu hoch. */
export const photoRejectedText: Record<string, string> = {
  photo_missing: 'Ein Foto ist nicht angekommen. Wir laden die Fotos beim erneuten Senden neu hoch.',
  photo_expired: 'Die Fotos lagen zu lange bereit. Wir laden sie beim erneuten Senden neu hoch.',
  too_many_photos: 'Mehr als 8 Fotos gehen nicht. Entferne Fotos und sende die Anfrage erneut.',
}

const isOffline = (error: { message?: string; code?: string }) => navigator.onLine === false || (!error.code && /fetch|network|load failed/i.test(error.message ?? ''))

/** Staging-Pfad `{user}/{clientRef}/{id}.jpg`: die Datenbank prüft ihn in den Storage-Policies und beim Übernehmen durch `quote`. */
const stagingPath = (userId: string, clientRef: string, photo: Photo) => `${userId}/${clientRef}/${photo.id}.jpg`

// Pfade, die in dieser Sitzung schon liegen: ein erneutes Senden (z. B. nach einem 409) lädt nichts doppelt hoch.
const uploaded = new Set<string>()

/** Ein Foto ins Staging, ohne Upsert (es gibt keine Update-Policy). „Gibt es schon“ zählt als Erfolg: dieselbe ID ist dieselbe Datei. */
export async function uploadPhoto(db: Db, userId: string, clientRef: string, photo: Photo): Promise<UploadFailure | null> {
  if (photo.blob.size > MAX_BYTES) return 'too_big'
  const path = stagingPath(userId, clientRef, photo)
  if (uploaded.has(path)) return null
  const upload = await db.storage.from(BUCKET).upload(path, photo.blob, { contentType: 'image/jpeg', upsert: false })
  if (!upload.error) {
    uploaded.add(path)
    return null
  }
  const status = (upload.error as { statusCode?: string }).statusCode
  if (status === '409' || /already exists/i.test(upload.error.message)) {
    uploaded.add(path)
    return null
  }
  if (status === '413') return 'too_big'
  if (status === '403' || /row-level security/i.test(upload.error.message)) return 'denied'
  return isOffline(upload.error) ? 'offline' : 'failed'
}

/** Alle Fotos nacheinander; der erste Fehler bricht ab, `onDone` meldet die Zahl der Fotos, die liegen. */
export async function uploadAll(db: Db, userId: string, clientRef: string, photos: readonly Photo[], onDone: (n: number) => void): Promise<UploadFailure | null> {
  let done = 0
  for (const photo of photos) {
    const failure = await uploadPhoto(db, userId, clientRef, photo)
    if (failure) return failure
    onDone(++done)
  }
  return null
}

/** Räumt die Staging-Dateien weg, die der Server nicht mehr annimmt (Löschen ist vor dem Absenden erlaubt). Ein Fehler hier ist egal: den Rest räumt der Server auf. */
export async function discardStaging(db: Db, userId: string, clientRef: string, photos: readonly Photo[]): Promise<void> {
  const paths = photos.map((p) => stagingPath(userId, clientRef, p))
  paths.forEach((p) => uploaded.delete(p))
  if (paths.length > 0) await db.storage.from(BUCKET).remove(paths)
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
