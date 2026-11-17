import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { formatEuro } from './money'
import { termsText } from './quote'
import { supabase } from './supabase'

export type CancelErrorKind = 'fee_changed' | 'too_late' | 'under_review' | 'closed' | 'retry' | 'unauthorized' | 'offline' | 'unavailable'

/** `cancelFeeCents` nur bei `fee_changed`: der Betrag, den der Server jetzt verlangt. */
export class CancelError extends Error {
  constructor(
    readonly kind: CancelErrorKind,
    readonly cancelFeeCents?: number,
  ) {
    super(kind)
  }
}

export const cancelErrorText: Record<CancelErrorKind, string> = {
  fee_changed: 'Die Stornokosten haben sich geändert. Prüfe den Betrag und bestätige erneut.',
  too_late: 'Der Termin hat schon begonnen. Stornieren geht nicht mehr. Hat der Auftrag nicht stattgefunden, melde das im Auftrag unter „Nein, er hat nicht stattgefunden“.',
  under_review: 'Für diesen Auftrag läuft eine Prüfung. Stornieren geht gerade nicht.',
  closed: 'Dieser Auftrag lässt sich nicht mehr stornieren.',
  retry: 'Das hat nicht geklappt. Versuche es gleich noch einmal.',
  unauthorized: 'Deine Anmeldung ist abgelaufen. Melde dich neu an.',
  offline: 'Keine Verbindung. Prüfe dein Netz und versuche es erneut.',
  unavailable: 'Das hat nicht geklappt. Versuche es gleich noch einmal.',
}

const CODES: Record<string, CancelErrorKind> = {
  too_late_use_report_not_done: 'too_late',
  under_review: 'under_review',
  invalid_transition: 'closed',
  not_found: 'closed',
  retry: 'retry',
  unauthorized: 'unauthorized',
}

const cents = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0

async function call(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('cancel-customer', { body })
  if (!error) return data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  if (error instanceof FunctionsFetchError) throw new CancelError('offline')
  if (error instanceof FunctionsHttpError) {
    const d: unknown = await error.context.json().catch(() => null)
    const r = d && typeof d === 'object' ? (d as Record<string, unknown>) : {}
    if (error.context.status === 409 && r.error === 'cancel_fee_changed' && cents(r.cancelFeeCents)) throw new CancelError('fee_changed', r.cancelFeeCents)
    const kind = typeof r.error === 'string' ? CODES[r.error] : undefined
    if (kind) throw new CancelError(kind)
  }
  throw new CancelError('unavailable')
}

/** Stornokosten, die der Server jetzt verlangen würde. Ein unlesbarer Betrag ist ein Fehler, nie „kostenlos“. */
export async function previewCancel(requestId: string): Promise<number> {
  const { cancelFeeCents } = await call({ requestId, preview: true })
  if (!cents(cancelFeeCents)) throw new CancelError('unavailable')
  return cancelFeeCents
}

/** Storno mit genau dem Betrag, den der Kunde gesehen hat; bei anderer Stufe antwortet der Server mit 409. */
export async function cancelRequest(requestId: string, shownFeeCents: number): Promise<void> {
  await call({ requestId, shownFeeCents })
}

const int = (v: unknown, max = Infinity): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max

/** Stufen in Worten aus den Bedingungen im Snapshot der gültigen Revision (nie aus den aktuellen Werten). Fehlt etwas oder ist es ungültig, gibt es keinen Text. (Bei `cancel_fee_waived` der Anfrage zeigt der Aufrufer keinen Stufentext.) */
export function snapshotStorno(snapshot: unknown): string[] {
  const t = snapshot && typeof snapshot === 'object' ? (snapshot as Record<string, unknown>).terms : undefined
  const r = t && typeof t === 'object' ? (t as Record<string, unknown>) : null
  if (!r) return []
  if (!int(r.cancel_free_hours) || !int(r.cancel_late_percent, 100) || !int(r.cancel_full_percent, 100) || !int(r.cancel_full_days_before)) return []
  return termsText({ termsHash: '', cancel_free_hours: r.cancel_free_hours, cancel_late_percent: r.cancel_late_percent, cancel_full_percent: r.cancel_full_percent, cancel_full_days_before: r.cancel_full_days_before, call_out_fee_cents: 0 }).storno
}

/**
 * Absage der Firma aus Sicht des Kunden (s9i-7b2): Pauschale in Cent laut `my_cancel_info` (nie die Gebühr) und die Folgeanfrage über `reissued_from`.
 * Ein unlesbarer Betrag ist ein Fehler, nie „keine Pauschale“. VORLÄUFIG bis zur Rechtsprüfung (S9_KONZEPT.md:361, docs/GOLIVE.md): Pauschale und Texte dazu.
 */
export type PartnerCancel = { feeCents: number; next: { id: string; status: string } | null }
export async function loadPartnerCancel(requestId: string, userId: string): Promise<PartnerCancel> {
  const { data, error } = await supabase.rpc('my_cancel_info', { p_request: requestId })
  if (error) throw error
  if (!cents(data)) throw new CancelError('unavailable')
  const next = await supabase.from('service_requests').select('id, status').eq('reissued_from', requestId).eq('customer_id', userId).maybeSingle()
  if (next.error) throw next.error
  return { feeCents: data, next: next.data }
}

export const feeText =(feeCents: number) => (feeCents === 0 ? 'Kostenlos' : formatEuro(feeCents))

const STEPS = ['Angefragt', 'Bestätigt', 'Läuft', 'Erledigt']
const CURRENT: Record<string, number> = { requested: 0, awaiting_offer: 0, offered: 0, accepted: 1, in_progress: 2, completed: 3 }
const END: Record<string, string> = {
  cancelled_by_customer: 'Du hast den Auftrag storniert.',
  cancelled_by_partner: 'Die Firma hat den Auftrag abgesagt.',
  withdrawn: 'Du hast die Anfrage zurückgezogen.',
  expired: 'Die Anfrage ist abgelaufen.',
  declined: 'Du hast alle Angebote abgelehnt.',
  unmatched: 'Wir haben keinen passenden Partner gefunden.',
}

/** Verlauf aus dem Status: vier Schritte mit dem aktuellen, Endzustände nur als Text. */
export function timeline(status: string): { steps: string[]; current: number } | { end: string } {
  const current = CURRENT[status]
  return current !== undefined ? { steps: STEPS, current } : { end: END[status] ?? 'Der Auftrag wird geprüft.' }
}
