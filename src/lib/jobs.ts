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
  | 'offer_open'
  | 'offer_limit'
  | 'amount'
  | 'vat_rule'
  // Partner, Nachtrag (s9i-7a, src/lib/partnerChange.ts)
  | 'change_open'
  | 'not_increasing'
  | 'no_change'
  | 'bad_input'
  | 'receipt_limit'
  | 'bad_photo'
  // Partner, Absage (s9i-7b2, src/lib/partnerCancel.ts)
  | 'under_review'
  | 'late_reason'
  | 'no_call_out'
  | 'receipt_missing'
  // Partner, Unterwegs (mail1, src/lib/partnerJobs.ts)
  | 'wrong_day'
  // Partner, Journal (s9i-7c1, src/lib/partnerJournal.ts)
  | 'period'

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
  offer_open: 'Du hast für diese Anfrage ein Angebot offen. Zieh es zuerst zurück.',
  offer_limit: 'Für diese Anfrage liegen schon so viele Angebote vor. Versuche es später noch einmal.',
  amount: 'Der Betrag liegt nicht im erlaubten Bereich. Prüfe deine Eingabe.',
  vat_rule: 'Für deine Firma fehlt eine Steuerangabe. Wende dich an den Support.',
  change_open: 'Für diesen Auftrag liegt schon ein Nachtrag vor. Die Ansicht wurde neu geladen.',
  not_increasing: 'Der neue Preis ist nicht höher als der bisherige. Ein Nachtrag kann den Preis nur erhöhen.',
  no_change: 'Für diesen Auftrag ist kein Nachtrag möglich.',
  bad_input: 'Prüfe deine Angaben. Mit diesen Werten geht es nicht.',
  receipt_limit: 'Zu diesem Auftrag gibt es schon die höchste Zahl an Belegfotos (8).',
  bad_photo: 'Dieses Foto lässt sich nicht verwenden. Nimm ein anderes JPEG, PNG oder WebP.',
  under_review: 'Für diesen Auftrag läuft eine Prüfung. Das geht gerade nicht.',
  late_reason: 'Der Termin hat schon begonnen. Jetzt ist nur noch der Grund „Vor Ort anders als gebucht“ möglich.',
  no_call_out: 'Für diese Absage gibt es keine Pauschale mehr.',
  receipt_missing: 'Für die Pauschale brauchst du mindestens ein gültiges Belegfoto zu diesem Auftrag.',
  wrong_day: 'Unterwegs kannst du nur am Tag des Termins melden.',
  period: 'Wähle einen Monat im Format JJJJ-MM.',
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
  under_review: 'under_review',
  retry: 'retry',
  unauthorized: 'unauthorized',
}

/** Wie lange ein Fehler die Anzeige veraltet: danach lädt der Auftrag neu. */
export const stale = (k: JobErrorKind) => k === 'changed' || k === 'closed' || k === 'gone' || k === 'window_closed' || k === 'under_review' || k === 'taken' || k === 'payout' || k === 'have_offer' || k === 'offer_open'
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

async function rpc(fn: 'complete_job' | 'report_not_done' | 'withdraw' | 'reject_offers', requestId: string): Promise<void> {
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

/** Datum und Uhrzeit in Wiener Zeit, „um“ und die Uhrzeit bleiben in einer Zeile (geschütztes Leerzeichen, rj1-3). */
export const viennaTime = (d: Date) => d.toLocaleString('de-AT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' }).replace(' um ', ` um${String.fromCharCode(160)}`)

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

/** Nur die Anzeige der Storno-Stufe; die Datenbank entscheidet mit der eigenen Uhr. */
export const terminStarted = (terminAt: string | null, now = Date.now()) => {
  const t = terminAt ? Date.parse(terminAt) : NaN
  return !Number.isNaN(t) && now >= t
}

export type ReportInfo = { canReport: boolean; reportUntil: Date | null }

/** Serversignal zur Frage nach dem Termin (`my_report_info`): Meldung möglich und bis wann. Unlesbar: Fehler, nie ein Rückfall auf die Geräteuhr. */
export async function loadReportInfo(requestId: string): Promise<ReportInfo> {
  const { data, error } = await supabase.rpc('my_report_info', { p_request: requestId })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : undefined
  if (!row || typeof row.can_report !== 'boolean') throw new Error('Meldefrist unlesbar')
  const until = row.report_until ? new Date(row.report_until) : null
  return { canReport: row.can_report, reportUntil: until && !Number.isNaN(until.getTime()) ? until : null }
}

/** Anfrage zurückziehen (nur bis zur Zusage); der Server prüft Eigentümer und Status. */
export const withdrawRequest = (requestId: string) => rpc('withdraw', requestId)
/** Alle Angebote ablehnen: die Anfrage endet (Status declined); der Server prüft Eigentümer und Status, eine Wiederholung nach Erfolg ist wirkungslos (0072). */
export const rejectOffers = (requestId: string) => rpc('reject_offers', requestId)
