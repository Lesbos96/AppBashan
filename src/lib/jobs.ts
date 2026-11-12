import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { parseSnapshot } from './quote'
import { supabase } from './supabase'

/** Fehlerarten der Kunden-Aktionen (Angebot, Nachtrag, Termin). Die App zeigt eigene Texte, nie Servercodes. */
export type JobErrorKind =
  | 'changed'
  | 'closed'
  | 'gone'
  | 'too_early'
  | 'window_closed'
  | 'retry'
  | 'unauthorized'
  | 'offline'
  | 'unavailable'
  // Partner (s9i-6a, src/lib/partnerJobs.ts)
  | 'taken'
  | 'payout'
  | 'job_limit'
  | 'have_offer'
  | 'offer_limit'
  | 'amount'
  | 'vat_rule'

export class JobError extends Error {
  constructor(readonly kind: JobErrorKind) {
    super(kind)
  }
}

export const jobErrorText: Record<JobErrorKind, string> = {
  changed: 'Der Preis hat sich geändert. Prüfe ihn und bestätige erneut.',
  closed: 'Das lässt sich nicht mehr ändern. Der Auftrag wurde neu geladen.',
  gone: 'Das ist nicht mehr verfügbar.',
  too_early: 'Der Termin hat noch nicht begonnen.',
  window_closed: 'Die Frist für diese Meldung ist abgelaufen.',
  retry: 'Das hat nicht geklappt. Versuche es gleich noch einmal.',
  unauthorized: 'Deine Anmeldung ist abgelaufen. Melde dich neu an.',
  offline: 'Keine Verbindung. Prüfe dein Netz und versuche es erneut.',
  unavailable: 'Das hat nicht geklappt. Versuche es gleich noch einmal.',
  taken: 'Diese Anfrage ist nicht mehr verfügbar. Die Liste wurde neu geladen.',
  payout: 'Deine Auszahlung hat sich geändert. Prüfe sie und bestätige erneut.',
  job_limit: 'Du hast die höchste Zahl offener Aufträge erreicht. Schließe zuerst einen ab.',
  have_offer: 'Du hast für diese Anfrage schon ein Angebot abgegeben.',
  offer_limit: 'Für diese Anfrage liegen schon so viele Angebote vor. Versuche es später noch einmal.',
  amount: 'Der Betrag liegt nicht im erlaubten Bereich. Prüfe deine Eingabe.',
  vat_rule: 'Für deine Firma fehlt eine Steuerangabe. Wende dich an den Support.',
}

const CODES: Record<string, JobErrorKind> = {
  amount_changed: 'changed',
  revision_changed: 'closed',
  invalid_transition: 'closed',
  not_found: 'closed',
  change_not_valid: 'closed',
  offer_not_valid: 'closed',
  expired: 'closed',
  partner_not_active: 'gone',
  offer_unavailable: 'gone',
  too_early: 'too_early',
  report_window_closed: 'window_closed',
  retry: 'retry',
  unauthorized: 'unauthorized',
}

/** Wie lange ein Fehler die Anzeige veraltet: danach lädt der Auftrag neu. */
export const stale = (k: JobErrorKind) => k === 'changed' || k === 'closed' || k === 'gone' || k === 'window_closed' || k === 'taken' || k === 'payout' || k === 'have_offer'
export const retryable = (k: JobErrorKind) => k === 'offline' || k === 'retry' || k === 'unavailable'

export const asKind = (code: unknown, codes: Record<string, JobErrorKind> = CODES): JobErrorKind => (typeof code === 'string' && Object.hasOwn(codes, code) ? codes[code] : undefined) ?? 'unavailable'

/** Edge Function aufrufen; Fehlercodes des Servers ordnet `codes` den Fehlerarten zu (Kunde: `CODES`, Partner: eigene Tabelle). */
export async function invoke(name: string, body: Record<string, unknown>, codes: Record<string, JobErrorKind> = CODES): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (!error) return data
  if (error instanceof FunctionsFetchError) throw new JobError('offline')
  if (error instanceof FunctionsHttpError) {
    const d: unknown = await error.context.json().catch(() => null)
    throw new JobError(asKind(d && typeof d === 'object' ? (d as Record<string, unknown>).error : undefined, codes))
  }
  throw new JobError('unavailable')
}

async function rpc(fn: 'complete_job' | 'report_not_done', requestId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc(fn, { p_request: requestId })
    if (!error) return
    throw new JobError(asKind(error.message))
  } catch (e) {
    if (e instanceof JobError) throw e
    throw new JobError('offline')
  }
}

const pos = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Angebote -----------------------------------------------------------------------------------------------------------------
export type Offer = { id: string; amountCents: number; validUntil: Date; company: string }

/** Offene Festangebote (Firmenname, Betrag, Frist); unlesbare Zeilen entfallen, nie ein halber Betrag. */
export async function loadOffers(requestId: string): Promise<Offer[]> {
  const { data, error } = await supabase.rpc('my_request_offers', { p_request: requestId })
  if (error) throw error
  return (Array.isArray(data) ? data : []).flatMap((r) => {
    const until = new Date(r.valid_until)
    return r.status === 'sent' && UUID.test(r.offer_id) && pos(r.amount_cents) && !Number.isNaN(until.getTime()) && typeof r.company_name === 'string' ? [{ id: r.offer_id, amountCents: r.amount_cents, validUntil: until, company: r.company_name }] : []
  })
}

/** Annahme mit genau dem gezeigten Betrag; bei anderem Betrag antwortet der Server mit 409. */
export async function confirmOffer(offerId: string, shownAmountCents: number): Promise<void> {
  await invoke('offer-confirm', { offerId, shownAmountCents })
}

// Nachtrag -----------------------------------------------------------------------------------------------------------------
export type Change = { id: string; totalCents: number; validUntil: Date | null; extraCents: number | null; photoIds: string[] }

/** Der offene Nachtrag des Auftrags (feste Spaltenliste). `extraCents` nur, wenn der Snapshot die Zeile „change_order“ trägt und zum Gesamtpreis passt. */
export async function loadChange(requestId: string): Promise<Change | null> {
  const { data, error } = await supabase.from('price_revisions').select('id, total_cents, valid_until, snapshot, photos').eq('request_id', requestId).eq('source', 'change_order').eq('status', 'proposed').maybeSingle()
  if (error) throw error
  if (!data) return null
  if (!UUID.test(data.id) || !pos(data.total_cents)) throw new Error('Nachtrag unlesbar')
  const snap = parseSnapshot(data.snapshot)
  const extra = snap?.kind === 'price' && snap.totalCents === data.total_cents ? snap.lines.find((l) => l.key === 'change_order') : undefined
  const until = data.valid_until ? new Date(data.valid_until) : null
  return {
    id: data.id,
    totalCents: data.total_cents,
    validUntil: until && !Number.isNaN(until.getTime()) ? until : null,
    extraCents: extra && extra.cents > 0 ? extra.cents : null,
    photoIds: (data.photos ?? []).filter((p) => UUID.test(p)),
  }
}

/** Signierte Belegfotos (600 s, nicht speichern): nur die Fotos dieses Nachtrags. */
export async function loadReceipts(requestId: string, photoIds: string[]): Promise<string[]> {
  const data = await invoke('job-photo', { requestId })
  return (Array.isArray(data) ? data : []).flatMap((p: unknown) => {
    const r = p && typeof p === 'object' ? (p as Record<string, unknown>) : {}
    return typeof r.id === 'string' && r.kind === 'receipt' && photoIds.includes(r.id) && typeof r.url === 'string' && r.url.startsWith('https://') ? [r.url] : []
  })
}

export async function decideChange(revisionId: string, accept: true, shownTotalCents: number): Promise<void>
export async function decideChange(revisionId: string, accept: false): Promise<void>
export async function decideChange(revisionId: string, accept: boolean, shownTotalCents?: number): Promise<void> {
  await invoke('change-decide', accept ? { revisionId, decision: 'accept', shownTotalCents } : { revisionId, decision: 'decline' })
}

// Termin -------------------------------------------------------------------------------------------------------------------
export const completeJob = (requestId: string) => rpc('complete_job', requestId)
export const reportNotDone = (requestId: string) => rpc('report_not_done', requestId)

/** Nur die Anzeige; die Datenbank entscheidet mit der eigenen Uhr. */
export const terminStarted = (terminAt: string | null, now = Date.now()) => {
  const t = terminAt ? Date.parse(terminAt) : NaN
  return !Number.isNaN(t) && now >= t
}
