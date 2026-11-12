import { asKind, invoke, JobError, type JobErrorKind } from './jobs'
import { preparePhoto } from './photos'
import { supabase } from './supabase'

/*
 * Partner-Portal 3a (s9i-7a): Nachtrag vorschlagen. Die Firma nennt nur geänderte Preisfelder und Belegfotos; den Betrag rechnet allein der Server
 * (`change-propose`, Preismodul mit der gebuchten Preisversion). Die App zeigt den Betrag der Vorschau und sendet genau ihn als `shownTotalCents`;
 * bei anderem Betrag antwortet der Server mit 409 und nichts wird angelegt. Die App rechnet keinen Preis.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const pos = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
const when = (v: unknown): Date | null => {
  const d = typeof v === 'string' ? new Date(v) : null
  return d && !Number.isNaN(d.getTime()) ? d : null
}
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

// Fehlercodes von `change-propose`, `photo-receipt` und `withdraw_change` → Fehlerart
const CODES: Record<string, JobErrorKind> = {
  amount_changed: 'changed',
  revision_changed: 'closed',
  invalid_transition: 'closed',
  not_found: 'closed',
  change_open: 'change_open',
  change_not_increasing: 'not_increasing',
  change_not_allowed: 'no_change',
  not_fixed_price: 'no_change',
  invalid_input: 'bad_input',
  route_locked: 'bad_input',
  receipt_required: 'bad_photo',
  receipt_limit: 'receipt_limit',
  request_closed: 'closed',
  not_jpeg: 'bad_photo',
  too_large: 'bad_photo',
  dimensions: 'bad_photo',
  unsupported: 'bad_photo',
  decode_failed: 'bad_photo',
  partner_not_active: 'gone',
  mfa_required: 'unauthorized',
  unauthorized: 'unauthorized',
  retry: 'retry',
}

// Lesen: Preisgrundlage und letzter eigener Nachtrag (my_job_changes, Migration 0058) -------------------------------------------
export type ChangeStatus = 'proposed' | 'accepted' | 'declined' | 'expired' | 'withdrawn'
const STATUSES: readonly string[] = ['proposed', 'accepted', 'declined', 'expired', 'withdrawn']
export type OpenChange = { id: string; status: ChangeStatus; totalCents: number; validUntil: Date | null; decidedAt: Date | null }
export type JobChange = {
  requestId: string
  service: 'transport' | 'move' | 'clearance' | 'assembly'
  /** Quelle der gültigen Revision; `partner_offer` (Festangebot) erlaubt keinen Nachtrag */
  source: string
  inputs: Record<string, unknown>
  totalCents: number | null
  change: OpenChange | null
  receiptIds: string[]
}

/** Preisgrundlagen der Aufträge der Firma, nach Auftrags-ID. Unlesbare Zeilen entfallen (dann gibt es dort keinen Nachtrag), nie ein halber Betrag. */
export async function loadChanges(): Promise<Map<string, JobChange>> {
  const { data, error } = await supabase.rpc('my_job_changes')
  if (error) throw error
  const out = new Map<string, JobChange>()
  for (const r of Array.isArray(data) ? data : []) {
    const total = r.total_cents === null ? null : r.total_cents
    if (!UUID.test(r.request_id) || !['transport', 'move', 'clearance', 'assembly'].includes(r.service) || typeof r.source !== 'string' || !isRecord(r.inputs) || (total !== null && !pos(total))) continue
    const change: OpenChange | null =
      r.change_id && UUID.test(r.change_id) && STATUSES.includes(r.change_status ?? '') && pos(r.change_total_cents)
        ? { id: r.change_id, status: r.change_status as ChangeStatus, totalCents: r.change_total_cents, validUntil: when(r.change_valid_until), decidedAt: when(r.change_decided_at) }
        : null
    out.set(r.request_id, {
      requestId: r.request_id,
      service: r.service as JobChange['service'],
      source: r.source,
      inputs: r.inputs,
      totalCents: total,
      change,
      receiptIds: (Array.isArray(r.receipt_ids) ? r.receipt_ids : []).filter((x: unknown): x is string => typeof x === 'string' && UUID.test(x)),
    })
  }
  return out
}

// Felder ---------------------------------------------------------------------------------------------------------------------------
export type FieldDef =
  | { key: string; label: string; kind: 'int' | 'dec'; min: number; max: number }
  | { key: string; label: string; kind: 'bool' }
  | { key: string; label: string; kind: 'select'; options: { value: string; label: string }[] }

// Grenzen wie `LIMITS` im Preismodul (der Server prüft sie noch einmal über `parse*Input`); Adresse und Route sind nie änderbar.
const TRANSPORT: FieldDef[] = [
  { key: 'crew', label: 'Personen', kind: 'int', min: 1, max: 8 },
  { key: 'vehicles', label: 'Fahrzeuge', kind: 'int', min: 1, max: 3 },
  { key: 'vehicleType', label: 'Fahrzeugart', kind: 'select', options: [{ value: 'van', label: 'Transporter' }, { value: 'truck', label: 'Lkw' }] },
  { key: 'hours', label: 'Stunden', kind: 'dec', min: 0.5, max: 100 },
  { key: 'fromFloor', label: 'Stockwerk Abholung', kind: 'int', min: 0, max: 20 },
  { key: 'fromLift', label: 'Lift bei Abholung', kind: 'bool' },
  { key: 'toFloor', label: 'Stockwerk Ziel', kind: 'int', min: 0, max: 20 },
  { key: 'toLift', label: 'Lift am Ziel', kind: 'bool' },
  { key: 'boxes', label: 'Kartons', kind: 'int', min: 0, max: 200 },
]
const ASSEMBLY: FieldDef[] = [
  { key: 'lm', label: 'Laufmeter unten', kind: 'dec', min: 0, max: 50 },
  { key: 'upper', label: 'Laufmeter oben', kind: 'dec', min: 0, max: 50 },
  { key: 'tall', label: 'Laufmeter hoch', kind: 'dec', min: 0, max: 50 },
]

/**
 * Änderbare Felder: nur Schlüssel, die in den Eingaben der gültigen Revision stehen, und nur mit passendem Typ und Wert (Auswahl: aktueller Wert muss eine Option sein).
 * Entrümpelung hat fast immer eine Spanne und läuft über das Festangebot (kein Nachtrag); verschachtelte Montage bleibt außen vor.
 */
export function changeFields(service: JobChange['service'], inputs: Record<string, unknown>): FieldDef[] {
  const all = service === 'transport' || service === 'move' ? TRANSPORT : service === 'assembly' ? ASSEMBLY : []
  return all.filter((f) => {
    const v = inputs[f.key]
    if (f.kind === 'bool') return typeof v === 'boolean'
    if (f.kind === 'select') return typeof v === 'string' && f.options.some((o) => o.value === v)
    return typeof v === 'number' && Number.isFinite(v) && v >= f.min && v <= f.max
  })
}

/** Nur die Anzeige: ob der Knopf „Nachtrag vorschlagen“ erscheint. Der Server entscheidet (Gate, Festpreis, offener Nachtrag). */
export const canPropose = (c: JobChange | undefined): c is JobChange =>
  !!c && c.source !== 'partner_offer' && c.totalCents !== null && c.change?.status !== 'proposed' && changeFields(c.service, c.inputs).length > 0

/** Entwurf: Text je Feld (Zahlen) bzw. boolean/Auswahl; Startwert ist der gebuchte Wert. */
export type Draft = Record<string, string | boolean>
export function startDraft(fields: FieldDef[], inputs: Record<string, unknown>): Draft {
  const d: Draft = {}
  for (const f of fields) {
    const v = inputs[f.key]
    d[f.key] = f.kind === 'bool' ? v === true : String(v).replace('.', ',')
  }
  return d
}

/** Geänderte Felder als `changes` für den Server (nur Abweichungen vom gebuchten Wert). Fehler: Text für die Anzeige. */
export function buildChanges(fields: FieldDef[], inputs: Record<string, unknown>, draft: Draft): { changes: Record<string, unknown> } | { error: string } {
  const changes: Record<string, unknown> = {}
  for (const f of fields) {
    const raw = draft[f.key]
    if (f.kind === 'bool') {
      if (raw !== inputs[f.key]) changes[f.key] = raw
    } else if (f.kind === 'select') {
      if (raw !== inputs[f.key]) changes[f.key] = raw
    } else {
      const text = String(raw).trim().replace(',', '.')
      const n = Number(text)
      if (text === '' || !Number.isFinite(n)) return { error: `${f.label}: Gib eine Zahl ein.` }
      if (f.kind === 'int' && !Number.isInteger(n)) return { error: `${f.label}: Gib eine ganze Zahl ein.` }
      if (n < f.min || n > f.max) return { error: `${f.label}: Erlaubt sind ${String(f.min).replace('.', ',')} bis ${f.max}.` }
      if (n !== inputs[f.key]) changes[f.key] = n
    }
  }
  return Object.keys(changes).length > 0 ? { changes } : { error: 'Ändere mindestens einen Wert.' }
}

// Server-Aufrufe -------------------------------------------------------------------------------------------------------------
export type Preview = { totalCents: number; baseCents: number }

/** Vorschau: der Server rechnet und prüft das Tor, legt aber nichts an. */
export async function previewChange(requestId: string, changes: Record<string, unknown>): Promise<Preview> {
  const d = await invoke('change-propose', { requestId, changes, preview: true }, CODES)
  const r = isRecord(d) ? d : {}
  if (!pos(r.totalCents) || !pos(r.baseCents)) throw new JobError('unavailable')
  return { totalCents: r.totalCents, baseCents: r.baseCents }
}

/** Anlegen mit genau dem gezeigten Betrag; bei anderem Betrag antwortet der Server mit 409 (`changed`) und legt nichts an. */
export async function proposeChange(requestId: string, changes: Record<string, unknown>, photoIds: string[], shownTotalCents: number): Promise<void> {
  const d = await invoke('change-propose', { requestId, changes, photoIds, shownTotalCents }, CODES)
  const r = isRecord(d) ? d : {}
  if (typeof r.revisionId !== 'string' || !UUID.test(r.revisionId)) throw new JobError('unavailable')
}

/** Belegfoto hochladen (JPEG neu kodiert, EXIF fällt weg); liefert die ID. Der Server prüft Firma, Zuordnung, Format und die Grenze von 8 je Auftrag. */
export async function uploadReceipt(requestId: string, file: File): Promise<string> {
  const blob = await preparePhoto(file)
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new JobError('unauthorized')
  let res: Response
  try {
    res = await fetch(`${import.meta.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/photo-receipt?request=${encodeURIComponent(requestId)}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, apikey: import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'content-type': 'image/jpeg' },
      body: blob,
    })
  } catch {
    throw new JobError('offline')
  }
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) throw new JobError(asKind(isRecord(body) ? body.error : undefined, CODES))
  const id = isRecord(body) ? body.id : undefined
  if (typeof id !== 'string' || !UUID.test(id)) throw new JobError('unavailable')
  return id
}

/** Eigenen offenen Nachtrag zurückziehen (nur die vorschlagende Firma, aal2; der Kunde bekommt eine Mail). */
export async function withdrawChange(revisionId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('withdraw_change', { p_revision: revisionId })
    if (!error) return
    throw new JobError(asKind(error.message, CODES))
  } catch (e) {
    if (e instanceof JobError) throw e
    throw new JobError('offline')
  }
}
