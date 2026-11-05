import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../supabase/functions/_shared/database.types.ts'
import { MAX_BYTES, type Photo } from './photos'

type Db = SupabaseClient<Database>

const BUCKET = 'request-photos'
/** Laufzeit signierter Links in Sekunden (ARCHITECTURE.md, Datenschutz). */
const SIGNED_SECONDS = 10 * 60

export type UploadFailure = 'offline' | 'too_big' | 'denied' | 'failed'

export const failureText: Record<UploadFailure, string> = {
  offline: 'Keine Verbindung. Die Fotos sind noch nicht hochgeladen.',
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

/**
 * Staging-Stand dieser Sitzung: Konto, Ref und die Pfade, die dort liegen. Dieselbe Ref lädt nichts doppelt hoch (z. B. nach einem 409).
 * Wechselt die Ref (geänderte Angaben oder Fotos), werden vorher die alten Dateien entfernt; sonst zählen sie bis zum Aufräumen gegen das Kontingent (0021).
 */
/** `paths`: sicher angekommen (kein zweiter Upload); `tried`: jeder begonnene Upload, auch mit verlorener Antwort – das räumt der Ref-Wechsel weg (OPEN_ISSUES A4c-N2). */
type Staged = { userId: string; clientRef: string; paths: Set<string>; tried: Set<string> }
let staged: Staged | null = null

/** Löschen erlaubt die Delete-Policy (0021) nur im eigenen Ordner ohne Anfrage zur Ref: übernommene Fotos bleiben. Fehler sind egal, den Rest räumt photo_cleanup auf. */
async function removePaths(db: Db, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  try {
    await db.storage.from(BUCKET).remove(paths)
  } catch {
    // siehe oben
  }
}

async function stagingFor(db: Db, userId: string, clientRef: string): Promise<Staged> {
  if (staged && staged.userId === userId && staged.clientRef === clientRef) return staged
  const old = staged
  staged = { userId, clientRef, paths: new Set(), tried: new Set() }
  // Anderes Konto: dessen Ordner ist für diese Sitzung gesperrt; „Anderes Konto“ räumt vorher mit `discardStaging` auf.
  if (old && old.userId === userId) await removePaths(db, [...old.tried])
  return staged
}

/** Ein Foto ins Staging, ohne Upsert (es gibt keine Update-Policy). „Gibt es schon“ zählt als Erfolg: dieselbe ID ist dieselbe Datei. */
async function uploadPhoto(db: Db, s: Staged, photo: Photo): Promise<UploadFailure | null> {
  if (photo.blob.size > MAX_BYTES) return 'too_big'
  const path = stagingPath(s.userId, s.clientRef, photo)
  if (s.paths.has(path)) return null
  // vor dem Upload merken: geht die Antwort verloren, liegt die Datei vielleicht trotzdem im Staging
  s.tried.add(path)
  const upload = await db.storage.from(BUCKET).upload(path, photo.blob, { contentType: 'image/jpeg', upsert: false })
  const status = upload.error ? (upload.error as { statusCode?: string }).statusCode : undefined
  if (!upload.error || status === '409' || /already exists/i.test(upload.error.message)) {
    s.paths.add(path)
    return null
  }
  if (status === '413') return 'too_big'
  if (status === '403' || /row-level security/i.test(upload.error.message)) return 'denied'
  return isOffline(upload.error) ? 'offline' : 'failed'
}

/** Alle Fotos nacheinander; der erste Fehler bricht ab, `onDone` meldet die Zahl der Fotos, die liegen. */
export async function uploadAll(db: Db, userId: string, clientRef: string, photos: readonly Photo[], onDone: (n: number) => void): Promise<UploadFailure | null> {
  const s = await stagingFor(db, userId, clientRef)
  let done = 0
  for (const photo of photos) {
    const failure = await uploadPhoto(db, s, photo)
    if (failure) return failure
    onDone(++done)
  }
  return null
}

/** Entfernt die Dateien des aktuellen Stands: nach `photo_missing`/`photo_expired` und vor „Anderes Konto“ (noch mit der alten Sitzung). */
export async function discardStaging(db: Db): Promise<void> {
  const old = staged
  staged = null
  if (old) await removePaths(db, [...old.tried])
}

/** Nach dem Absenden: die Dateien gehören zur Anfrage, der nächste Entwurf beginnt ohne Stand. */
export function forgetStaging(): void {
  staged = null
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
