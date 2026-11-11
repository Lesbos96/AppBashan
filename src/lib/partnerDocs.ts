import { PhotoError, preparePhoto } from './photos'
import { supabase } from './supabase'

/*
 * Nachweise der Partner-Firma (Tabelle `partner_documents`, Bucket `partner-documents`; Migrationen 0024 bis 0026).
 * Ablauf: erst die Zeile (nur `id`, `kind`; Firma und Pfad setzt der Server), dann die Datei auf `{partner_id}/{id}`.
 * Der Server erzwingt aal2, die eigene Firma, höchstens 5 Zeilen, PDF und JPEG, 10 MB. Die App prüft vorher dasselbe, damit keine Zeile ohne Datei entsteht.
 * Partner können Zeilen nicht löschen: scheitert der Upload, bleibt die Zeile und die Datei wird auf dieselbe `id` nachgeladen.
 */

export const BUCKET = 'partner-documents'
export const MAX_DOCS = 5
export const MAX_DOC_BYTES = 10 * 1024 * 1024

export const DOC_KINDS = [
  { value: 'trade_license', label: 'Gewerbeberechtigung' },
  { value: 'company_register', label: 'Firmenbuchauszug' },
  { value: 'other', label: 'Sonstiges' },
] as const
export type DocKind = (typeof DOC_KINDS)[number]['value']
export const kindLabel = (kind: string) => DOC_KINDS.find((k) => k.value === kind)?.label ?? 'Sonstiges'

export type DocErrorKind = 'bad_type' | 'too_big' | 'limit_reached' | 'not_active' | 'denied' | 'exists' | 'offline' | 'unavailable'

export class DocError extends Error {
  constructor(
    readonly kind: DocErrorKind,
    /** eigener Text statt des Standards (z. B. der Hinweis zu HEIC aus der Bildprüfung) */
    readonly text?: string,
  ) {
    super(kind)
  }
}

export const docErrorText: Record<DocErrorKind, string> = {
  bad_type: 'Dieses Format geht nicht. Nimm ein PDF oder ein Foto (JPEG, PNG oder WebP). HEIC-Fotos gehen hier nicht.',
  too_big: 'Die Datei ist größer als 10 MB.',
  limit_reached: 'Du kannst höchstens 5 Dokumente hochladen.',
  not_active: 'Deine Firma ist nicht mehr freigeschaltet. Du kannst keine Dokumente mehr hochladen.',
  denied: 'Das hat nicht geklappt. Versuche es gleich noch einmal.',
  exists: 'Für dieses Dokument liegt schon eine Datei vor.',
  offline: 'Keine Verbindung. Prüfe dein Netz und versuche es erneut.',
  unavailable: 'Das hat nicht geklappt. Versuche es gleich noch einmal.',
}

export const docErrorMessage = (e: unknown) => (e instanceof DocError ? (e.text ?? docErrorText[e.kind]) : docErrorText.unavailable)

const PDF_HEAD = '%PDF-'

/** Ein PDF läuft unverändert durch (Kopfzeile als Eingabehilfe, keine Sicherheitsgrenze); Bilder werden als JPEG neu kodiert (EXIF, Standort fallen weg). */
export async function prepareDocument(file: File): Promise<{ blob: Blob; contentType: 'application/pdf' | 'image/jpeg' }> {
  const isPdf = file.type === 'application/pdf' || (file.type === '' && /\.pdf$/i.test(file.name))
  if (isPdf) {
    if (file.size > MAX_DOC_BYTES) throw new DocError('too_big')
    if ((await file.slice(0, PDF_HEAD.length).text()) !== PDF_HEAD) throw new DocError('bad_type')
    return { blob: new Blob([file], { type: 'application/pdf' }), contentType: 'application/pdf' }
  }
  if (!file.type.startsWith('image/') && !/\.hei[cf]$/i.test(file.name)) throw new DocError('bad_type')
  try {
    return { blob: await preparePhoto(file), contentType: 'image/jpeg' }
  } catch (e) {
    if (e instanceof PhotoError) throw new DocError(/größer als 10 MB/.test(e.message) ? 'too_big' : 'bad_type', /größer als 10 MB/.test(e.message) ? undefined : e.message)
    throw new DocError('unavailable')
  }
}

type Failure = { code?: string; message?: string; statusCode?: string | number; status?: number; name?: string; originalError?: unknown }

const isOffline = (e: unknown) => e instanceof TypeError || (typeof e === 'object' && e !== null && (e as Failure).originalError instanceof TypeError)

function rowFailure(e: Failure): DocError {
  if (e.message === 'limit_reached') return new DocError('limit_reached')
  if (e.message === 'partner_not_active') return new DocError('not_active')
  if (e.code === '42501') return new DocError('denied')
  return new DocError('unavailable')
}

/** Legt die Zeile an und gibt die `id` zurück. Gelesen wird nur `id`: `storage_path` hat kein Spaltenrecht. */
export async function createDocument(kind: DocKind): Promise<string> {
  const id = crypto.randomUUID()
  let error: Failure | null
  try {
    ;({ error } = await supabase.from('partner_documents').insert({ id, kind } as never).select('id'))
  } catch (e) {
    throw isOffline(e) ? new DocError('offline') : new DocError('unavailable')
  }
  if (error) throw rowFailure(error)
  return id
}

function storageFailure(e: Failure): DocError {
  if (isOffline(e)) return new DocError('offline')
  const status = String(e.statusCode ?? e.status ?? '')
  if (status === '413') return new DocError('too_big')
  if (status === '415') return new DocError('bad_type')
  if (status === '401' || status === '403') return new DocError('denied')
  if (status === '409') return new DocError('exists')
  return new DocError('unavailable')
}

/** Lädt die Datei auf `{partner_id}/{id}`, nie mit upsert (der Server erlaubt weder Überschreiben noch Löschen). */
export async function uploadDocument(partnerId: string, id: string, blob: Blob, contentType: string): Promise<void> {
  let error: Failure | null
  try {
    ;({ error } = await supabase.storage.from(BUCKET).upload(`${partnerId}/${id}`, blob, { contentType, upsert: false }))
  } catch (e) {
    throw isOffline(e) ? new DocError('offline') : new DocError('unavailable')
  }
  if (error) throw storageFailure(error)
}

export type Doc = { id: string; partner_id: string; kind: string; uploaded_at: string; hasFile: boolean }

/** Zeilen der eigenen Firma, je mit der Angabe, ob die Datei im Bucket liegt (sonst fehlt der Upload). */
export async function loadDocuments(partnerId: string): Promise<Doc[]> {
  const [rows, files] = await Promise.all([
    supabase.from('partner_documents').select('id, partner_id, kind, uploaded_at').eq('partner_id', partnerId).order('uploaded_at'),
    supabase.storage.from(BUCKET).list(partnerId, { limit: MAX_DOCS + 5 }),
  ])
  if (rows.error) throw rows.error
  if (files.error) throw files.error
  const present = new Set(files.data.map((f) => f.name))
  return rows.data.map((r) => ({ ...r, hasFile: present.has(r.id) }))
}
