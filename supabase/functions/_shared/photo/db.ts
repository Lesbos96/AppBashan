// Datenbank- und Storage-Anbindung der Foto-Functions (S9d). Läuft mit dem Secret Key (service_role); die SQL-Funktionen prüfen Akteur,
// aal, Firma und Status selbst. Fehler der Funktionen kommen als DbError mit dem Code der Exception.
import { type Db, getUser, must } from '../jobs/db.ts'
import { DbError } from '../jobs/handlers.ts'
import type { AdminPhotoDeps, JobPhotoDeps, PublishDeps, ReceiptDeps } from './handlers.ts'

const SIGN_SECONDS = 600
const ORIGINALS = 'request-photos'
const COPIES = 'job-photos'

/** Schreibt die Kopie unter einem Zufallsnamen ohne Überschreiben; der Name enthält weder Anfrage noch Nutzer. */
async function upload(db: Db, bytes: Uint8Array): Promise<string> {
  const path = `${crypto.randomUUID()}.jpg`
  const { error } = await db.storage.from(COPIES).upload(path, bytes, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error('upload_failed')
  return path
}

/** URL je Pfad in derselben Reihenfolge; `null` für eine Datei, die es nicht (mehr) gibt (das Aufräumen kann sie zwischen Liste und Signatur entfernt haben). */
async function sign(db: Db, bucket: string, paths: string[]): Promise<(string | null)[]> {
  if (paths.length === 0) return []
  const { data, error } = await db.storage.from(bucket).createSignedUrls(paths, SIGN_SECONDS)
  if (error || !data) throw new Error('sign_failed')
  return paths.map((p) => data.find((d) => d.path === p)?.signedUrl ?? null)
}

export const publishDb = (db: Db): Pick<PublishDeps, 'begin' | 'download' | 'upload' | 'mark'> => ({
  async begin(jobPhotoId, attempt) {
    return must(await db.rpc('photo_publish_begin', { p_job_photo: jobPhotoId, p_attempt: attempt }))
  },
  async download(path) {
    const { data, error } = await db.storage.from(ORIGINALS).download(path)
    if (data) return new Uint8Array(await data.arrayBuffer())
    const e = error as { status?: number; statusCode?: string; message?: string } | null
    if (e && (e.status === 404 || e.statusCode === '404' || /not.?found/i.test(e.message ?? ''))) return null
    throw new Error('download_failed')
  },
  upload: (bytes) => upload(db, bytes),
  async mark(jobPhotoId, attempt, r) {
    const { error } = await db.rpc('photo_publish_mark', {
      p_job_photo: jobPhotoId,
      p_attempt: attempt,
      p_ok: r.ok,
      p_path: (r.ok ? r.path : null) as never,
      p_sha: (r.ok ? r.sha256 : null) as never,
      p_error: (r.ok ? null : r.error) as never,
    })
    if (error) throw new DbError(error.message)
  },
})

export const receiptDb = (db: Db): Pick<ReceiptDeps, 'getUser' | 'check' | 'upload' | 'add'> => ({
  getUser: (jwt) => getUser(db, jwt),
  async check(userId, aal, requestId) {
    const { error } = await db.rpc('photo_receipt_check', { p_actor: userId, p_aal: aal, p_request: requestId })
    if (error) throw new DbError(error.message)
  },
  upload: (bytes) => upload(db, bytes),
  async add(userId, aal, requestId, path, sha256) {
    return must(await db.rpc('photo_receipt_add', { p_actor: userId, p_aal: aal, p_request: requestId, p_path: path, p_sha: sha256 }))
  },
})

export const jobPhotoDb = (db: Db): Pick<JobPhotoDeps, 'getUser' | 'photos'> => ({
  getUser: (jwt) => getUser(db, jwt),
  async photos(userId, aal, target) {
    const args = 'listingId' in target ? { p_listing: target.listingId } : { p_request: target.requestId }
    const rows = must(await db.rpc('job_photo_list', { p_actor: userId, p_aal: aal, ...args }))
    const urls = await sign(db, COPIES, rows.map((r) => r.storage_path))
    return rows.flatMap((r, i) => (urls[i] ? [{ id: r.id, kind: r.kind, url: urls[i] }] : []))
  },
})

export const adminPhotoDb = (db: Db): Pick<AdminPhotoDeps, 'getUser' | 'photos'> => ({
  getUser: (jwt) => getUser(db, jwt),
  async photos(adminId, requestId, reason) {
    const rows = must(await db.rpc('admin_photo', { p_actor: adminId, p_request: requestId, p_reason: reason }))
    const out: { bucket: string; url: string }[] = []
    for (const bucket of [ORIGINALS, COPIES]) {
      const urls = await sign(db, bucket, rows.filter((r) => r.bucket_id === bucket).map((r) => r.storage_path))
      for (const url of urls) if (url) out.push({ bucket, url })
    }
    return out
  },
})
