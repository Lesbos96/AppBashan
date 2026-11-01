import { useSyncExternalStore } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../supabase/functions/_shared/database.types.ts'
import { MAX_BYTES, MAX_PHOTOS, type Photo } from './photos'

type Db = SupabaseClient<Database>

const BUCKET = 'request-photos'
/** Laufzeit signierter Links in Sekunden (ARCHITECTURE.md, Datenschutz). */
const SIGNED_SECONDS = 10 * 60

export type UploadFailure = 'offline' | 'limit' | 'too_big' | 'failed' | 'remove_failed'

export const failureText: Record<UploadFailure, string> = {
  offline: 'Keine Verbindung.',
  limit: `Mehr als ${MAX_PHOTOS} Fotos gehen nicht.`,
  too_big: 'Das Foto ist zu groß.',
  failed: 'Das hat nicht geklappt.',
  remove_failed: 'Entfernen hat nicht geklappt.',
}

const isOffline = (error: { message?: string; code?: string }) => navigator.onLine === false || (!error.code && /fetch|network|load failed/i.test(error.message ?? ''))

/**
 * Ein Foto, idempotent: erst die Zeile in `request_photos` (die Foto-ID ist der Primärschlüssel, der Server setzt den Pfad
 * `{user}/{request}/{id}.jpg` und prüft Limit und Besitz), dann die Datei. „Gibt es schon“ zählt bei beidem als Erfolg, ein Wiederholen
 * nach einem Abbruch ergibt also nie ein zweites Foto. Bei Fehlern bleibt die Zeile stehen; nur `removeUpload` löscht, den Rest räumt der Server auf.
 */
export async function uploadPhoto(db: Db, userId: string, requestId: string, photo: Photo): Promise<UploadFailure | null> {
  if (photo.blob.size > MAX_BYTES) return 'too_big'
  const entry = await db.from('request_photos').insert({ id: photo.id, request_id: requestId })
  if (entry.error && entry.error.code !== '23505') {
    if (entry.error.code === '23514') return 'limit'
    return isOffline(entry.error) ? 'offline' : 'failed'
  }
  const upload = await db.storage.from(BUCKET).upload(`${userId}/${requestId}/${photo.id}.jpg`, photo.blob, { contentType: 'image/jpeg', upsert: false })
  if (!upload.error) return null
  const status = (upload.error as { statusCode?: string }).statusCode
  if (status === '409' || /already exists/i.test(upload.error.message)) return null
  if (status === '413') return 'too_big'
  return isOffline(upload.error) ? 'offline' : 'failed'
}

/** Löscht zuerst die Zeile, dann die Datei (ohne Zeile kann niemand sie mehr sehen; ein Rest wird als Waise aufgeräumt). `false`, wenn die Zeile bleibt. */
export async function deletePhoto(db: Db, userId: string, requestId: string, id: string): Promise<boolean> {
  const row = await db.from('request_photos').delete().eq('id', id)
  if (row.error) return false
  await db.storage.from(BUCKET).remove([`${userId}/${requestId}/${id}.jpg`])
  return true
}

export type UploadEntry = { photo: Photo; status: 'queued' | 'uploading' | 'done' | 'error'; failure: UploadFailure | null }

// Die Warteschlange liegt auf Modulebene wie der Foto-Speicher: Das Verlassen der Bestätigungsseite bricht keinen Upload ab.
const queues = new Map<string, UploadEntry[]>()
const contexts = new Map<string, { db: Db; userId: string }>()
const listeners = new Set<() => void>()
const empty: UploadEntry[] = []

function setQueue(requestId: string, entries: UploadEntry[]) {
  queues.set(requestId, entries)
  listeners.forEach((l) => l())
}

function patch(requestId: string, id: string, change: Partial<UploadEntry>) {
  const entries = queues.get(requestId)
  if (entries) setQueue(requestId, entries.map((e) => (e.photo.id === id ? { ...e, ...change } : e)))
}

const running = new Set<string>()

/** Arbeitet die wartenden Fotos einer Anfrage nacheinander ab. */
async function drain(requestId: string) {
  const ctx = contexts.get(requestId)
  if (!ctx || running.has(requestId)) return
  running.add(requestId)
  try {
    for (let next = queues.get(requestId)?.find((e) => e.status === 'queued'); next; next = queues.get(requestId)?.find((e) => e.status === 'queued')) {
      patch(requestId, next.photo.id, { status: 'uploading', failure: null })
      const failure = await uploadPhoto(ctx.db, ctx.userId, requestId, next.photo)
      patch(requestId, next.photo.id, failure ? { status: 'error', failure } : { status: 'done', failure: null })
    }
  } finally {
    running.delete(requestId)
  }
}

/** Nimmt die Fotos einer gerade gesendeten Anfrage entgegen und lädt sie hoch. */
export function queueUploads(db: Db, userId: string, requestId: string, photos: readonly Photo[]): void {
  if (photos.length === 0) return
  contexts.set(requestId, { db, userId })
  setQueue(requestId, [...(queues.get(requestId) ?? empty), ...photos.map((photo) => ({ photo, status: 'queued' as const, failure: null }))])
  void drain(requestId)
}

export function retryUpload(requestId: string, id: string): void {
  patch(requestId, id, { status: 'queued', failure: null })
  void drain(requestId)
}

export async function removeUpload(requestId: string, id: string): Promise<void> {
  const entry = queues.get(requestId)?.find((e) => e.photo.id === id)
  const ctx = contexts.get(requestId)
  if (!entry || !ctx || entry.status === 'uploading') return
  // Das Foto bleibt in der Liste, bis der Server die Zeile gelöscht hat; sonst bliebe es unbemerkt bei der Anfrage.
  if (!(await deletePhoto(ctx.db, ctx.userId, requestId, id))) return patch(requestId, id, { status: 'error', failure: 'remove_failed' })
  URL.revokeObjectURL(entry.photo.url)
  setQueue(requestId, (queues.get(requestId) ?? empty).filter((e) => e.photo.id !== id))
}

export const getUploads = (requestId: string): readonly UploadEntry[] => queues.get(requestId) ?? empty

export function useUploads(requestId: string): readonly UploadEntry[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => getUploads(requestId),
  )
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
