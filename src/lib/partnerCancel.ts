import { invoke, JobError, type JobErrorKind } from './jobs'

/*
 * Partner-Portal 3b (s9i-7b2): Absage durch die Firma (`cancel-partner`, s9i-7b). Den Betrag rechnet allein der Server: die Vorschau liefert Pauschale und
 * Auszahlung, die App sendet genau die gezeigte Pauschale (`shownCallOutCents`). Bei anderem Betrag antwortet der Server mit 409 und bucht nichts.
 * VORLÄUFIG bis zur Rechtsprüfung (S9_KONZEPT.md:361, Frage Recht 5): Pauschale und alle Texte dazu (docs/GOLIVE.md).
 */

export type CancelReason = 'scope_impossible' | 'unavailable' | 'other'
export const CANCEL_REASONS: { value: CancelReason; label: string }[] = [
  { value: 'scope_impossible', label: 'Der Auftrag ist vor Ort anders als gebucht' },
  { value: 'unavailable', label: 'Ich kann den Auftrag nicht durchführen' },
  { value: 'other', label: 'Anderer Grund' },
]

const CODES: Record<string, JobErrorKind> = {
  amount_changed: 'changed',
  call_out_not_allowed: 'no_call_out',
  retry: 'retry',
  under_review: 'under_review',
  too_late_for_reason: 'late_reason',
  receipt_required: 'receipt_missing',
  invalid_input: 'bad_input',
  invalid_transition: 'closed',
  not_found: 'closed',
  partner_not_active: 'gone',
  mfa_required: 'unauthorized',
  unauthorized: 'unauthorized',
}

const cents = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

export type CancelPreview = { callOutCents: number; payoutCents: number }

/** Vorschau des Servers für genau diesen Grund; schreibt nichts. Ein unlesbarer Betrag ist ein Fehler, nie „keine Pauschale“. */
export async function previewPartnerCancel(requestId: string, reason: CancelReason): Promise<CancelPreview> {
  const d = await invoke('cancel-partner', { requestId, reason, preview: true }, CODES)
  const r = isRecord(d) ? d : {}
  if (!cents(r.callOutCents) || !cents(r.payoutCents) || r.payoutCents > r.callOutCents) throw new JobError('unavailable')
  return { callOutCents: r.callOutCents, payoutCents: r.payoutCents }
}

/** Absage mit genau der gezeigten Pauschale. Belege nur bei Pauschale (> 0); ohne Pauschale bleiben `photoIds` weg. */
export async function cancelAsPartner(requestId: string, reason: CancelReason, photoIds: string[], shownCallOutCents: number): Promise<void> {
  const body: Record<string, unknown> = { requestId, reason, shownCallOutCents }
  if (shownCallOutCents > 0) body.photoIds = photoIds
  const d = await invoke('cancel-partner', body, CODES)
  if (!isRecord(d) || d.status !== 'cancelled_by_partner') throw new JobError('unavailable')
}
