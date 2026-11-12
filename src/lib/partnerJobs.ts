import { splitFee } from '@pricing'
import { type JobErrorKind, JobError, invoke } from './jobs'
import { supabase } from './supabase'

/*
 * Partner-Portal 2a (s9i-6a): offene Anfragen lesen, annehmen, Festangebot abgeben und zurückziehen. Der Server entscheidet über alles;
 * die App zeigt nur den Umfang (Whitelist), sendet genau den gezeigten Betrag und ordnet jede Antwort einem eigenen Text zu.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const int = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v)
const pos = (v: unknown): v is number => int(v) && v > 0
const posOrNull = (v: unknown): v is number | null => v === null || pos(v)
const when = (v: unknown): Date | null => {
  const d = typeof v === 'string' ? new Date(v) : null
  return d && !Number.isNaN(d.getTime()) ? d : null
}

// Fehlercodes des Servers (accept, send_offer, withdraw_offer) → Fehlerart. Alles, was „die Anfrage ist weg oder nicht mehr offen“ heißt, ist `taken`.
const CODES: Record<string, JobErrorKind> = {
  already_taken: 'taken',
  request_closed: 'taken',
  listing_declined: 'taken',
  expired: 'taken',
  invalid_transition: 'taken',
  offer_required: 'taken',
  price_not_fixed: 'taken',
  not_found: 'taken',
  not_responsible: 'taken',
  payout_changed: 'payout',
  fee_rate_changed: 'payout',
  revision_changed: 'changed',
  partner_job_limit: 'job_limit',
  partner_not_active: 'gone',
  mfa_required: 'unauthorized',
  unauthorized: 'unauthorized',
  offer_exists: 'have_offer',
  offer_limit: 'offer_limit',
  amount_out_of_range: 'amount',
  vat_rule_missing: 'vat_rule',
  retry: 'retry',
}
// Nachschlagen nur in eigenen Schlüsseln (kein `constructor`, `toString` aus der Prototypkette)
const own = <T>(map: Record<string, T>, key: unknown): T | undefined => (typeof key === 'string' && Object.hasOwn(map, key) ? map[key] : undefined)
const kindOf = (code: unknown): JobErrorKind => own(CODES, code) ?? 'unavailable'

async function rpc(fn: 'send_offer' | 'withdraw_offer', args: { p_listing: string; p_amount: number } | { p_offer: string }): Promise<void> {
  try {
    const { error } = await supabase.rpc(fn, args as never)
    if (!error) return
    throw new JobError(kindOf(error.message))
  } catch (e) {
    if (e instanceof JobError) throw e
    throw new JobError('offline')
  }
}

// Listings -----------------------------------------------------------------------------------------------------------------
export type Listing = {
  id: string
  revisionId: string
  status: 'open' | 'accepted'
  district: number
  toDistrict: number | null
  service: 'transport' | 'move' | 'clearance' | 'assembly'
  inputs: unknown
  preferredDate: string | null
  timeWindow: string | null
  /** nur bei Festpreis: Annahme; sonst Festangebot */
  totalCents: number | null
  lowCents: number | null
  highCents: number | null
  deadline: Date
}

// Genau die Spalten des Grants (Migration 0030, 0038); nie `request_id`, nie `*`.
const COLUMNS = 'id, revision_id, status, district, to_district, service, inputs, preferred_date, time_window, total_cents, low_cents, high_cents, accept_deadline'
const SERVICES = ['transport', 'move', 'clearance', 'assembly']

/** Offene und angenommene Anfragen der Firma (die Zeilen filtert die Datenbank per RLS); unlesbare Zeilen entfallen, nie ein halber Betrag. */
export async function loadListings(): Promise<Listing[]> {
  const { data, error } = await supabase.from('job_listings').select(COLUMNS).order('accept_deadline', { ascending: true })
  if (error) throw error
  return (Array.isArray(data) ? data : []).flatMap((r): Listing[] => {
    const deadline = when(r.accept_deadline)
    const ok =
      UUID.test(r.id) && UUID.test(r.revision_id) && (r.status === 'open' || r.status === 'accepted') && int(r.district) && r.district >= 1 && r.district <= 23 && SERVICES.includes(r.service) &&
      posOrNull(r.total_cents) && posOrNull(r.low_cents) && posOrNull(r.high_cents) && deadline
    if (!ok) return []
    return [
      {
        id: r.id,
        revisionId: r.revision_id,
        status: r.status === 'accepted' ? 'accepted' : 'open',
        district: r.district,
        toDistrict: int(r.to_district) && r.to_district >= 1 && r.to_district <= 23 ? r.to_district : null,
        service: r.service as Listing['service'],
        inputs: r.inputs,
        preferredDate: typeof r.preferred_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.preferred_date) ? r.preferred_date : null,
        timeWindow: typeof r.time_window === 'string' ? r.time_window : null,
        totalCents: r.total_cents,
        lowCents: r.low_cents,
        highCents: r.high_cents,
        deadline,
      },
    ]
  })
}

// Sätze und Auszahlung -----------------------------------------------------------------------------------------------------
export type Rates = { feeRate: number; vatRate: number }

/** Geltender Satz laut Datenbank (Ansicht `current_fee_rates`, Wiener Datum, höchste Version); fehlt er, gibt es keine Auszahlung. */
export async function loadRates(): Promise<Rates> {
  const { data, error } = await supabase.from('current_fee_rates').select('fee_rate, fee_vat_rate').single()
  if (error) throw error
  const f = Number(data?.fee_rate)
  const v = Number(data?.fee_vat_rate)
  if (data?.fee_rate == null || data?.fee_vat_rate == null || !Number.isFinite(f) || !Number.isFinite(v)) throw new Error('Gebührensatz fehlt')
  return { feeRate: f, vatRate: v }
}

/** Auszahlung in Cent: dieselbe Rechnung wie der Server (`splitFee`); der Server vergleicht sie bei der Annahme. Ungültiger Satz: `null` (keine Auszahlung zeigen). */
export function payoutCents(totalCents: number, r: Rates): number | null {
  try {
    return splitFee(totalCents, { feeRate: r.feeRate, vatRate: r.vatRate }).payoutCents
  } catch {
    return null
  }
}

// Anzeige: Umfang (Whitelist), Tag, Zeitfenster ------------------------------------------------------------------------------
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const floor = (n: number) => (n < 0 ? 'Keller' : n === 0 ? 'Erdgeschoss' : `${n}. Stock`)
const lift = (b: unknown) => (b === true ? 'mit Lift' : 'ohne Lift')
const GOODS: Record<string, string> = { piano: 'Klavier', grand: 'Flügel', safe: 'Tresor' }
const VEHICLE: Record<string, string> = { van: 'Transporter', truck: 'Lkw', large: 'Großer Lkw' }
const OBJECT: Record<string, string> = { flat: 'Wohnung', house: 'Haus', attic: 'Dachboden', cellar: 'Keller', office: 'Büro', heavy: 'Schweres Gut' }
const FILL: Record<string, string> = { light: 'wenig Inhalt', normal: 'normal gefüllt', full: 'voll' }

function assemblyLine(a: unknown): string[] {
  const r = a && typeof a === 'object' ? (a as Record<string, unknown>) : null
  if (!r || !num(r.lm)) return []
  return r.kind === 'kitchen' && num(r.upper) && num(r.tall) ? [`Küchenmontage: ${r.lm} lfm unten, ${r.upper} lfm oben, ${r.tall} lfm hoch`] : [`Montage: ${r.lm} lfm`]
}

/** Umfang in Worten. Nur bekannte Schlüssel (Preis-Eingaben der Anfrage); alles andere in `inputs` erscheint nie, auch nicht versteckt. */
export function scopeLines(service: Listing['service'], inputs: unknown): string[] {
  const r = inputs && typeof inputs === 'object' && !Array.isArray(inputs) ? (inputs as Record<string, unknown>) : null
  if (!r) return []
  const out: string[] = []
  if (service === 'transport' || service === 'move') {
    const goods = own(GOODS, r.goods)
    if (goods) out.push(goods)
    const vehicle = own(VEHICLE, r.vehicleType)
    if (num(r.crew) && num(r.vehicles) && vehicle) out.push(`${r.vehicles} × ${vehicle}, ${r.crew} Personen`)
    if (num(r.hours)) out.push(`${r.hours} Std.`)
    if (num(r.fromFloor)) out.push(`Abholung: ${floor(r.fromFloor)}, ${lift(r.fromLift)}`)
    if (num(r.toFloor)) out.push(`Ziel: ${floor(r.toFloor)}, ${lift(r.toLift)}`)
    if (num(r.boxes) && r.boxes > 0) out.push(`${r.boxes} Kartons`)
    if (r.packing === true) out.push('Einpacken')
    out.push(...assemblyLine(r.assembly))
  } else if (service === 'clearance') {
    const obj = own(OBJECT, r.object)
    if (obj) out.push(obj)
    if (num(r.area)) out.push(`${r.area} m²`)
    const fill = own(FILL, r.fill)
    if (fill) out.push(fill)
    if (num(r.floor)) out.push(`${floor(r.floor)}, ${lift(r.lift)}`)
    if (r.special === true) out.push('Sonderfall, Besichtigung nötig')
    out.push(...assemblyLine(r.assembly))
  } else {
    out.push(...assemblyLine(r))
  }
  return out
}

export const serviceLabel: Record<Listing['service'], string> = { transport: 'Transport', move: 'Umzug', clearance: 'Entrümpelung', assembly: 'Montage' }
const WINDOW: Record<string, string> = { morning: 'Vormittag, 8 bis 11 Uhr', midday: 'Mittag, 11 bis 14 Uhr', afternoon: 'Nachmittag, 14 bis 18 Uhr', flexible: 'ganzer Tag ab 8 Uhr' }
export const windowLabel = (w: string | null) => own(WINDOW, w) ?? null

/** Kalendertag wie gespeichert (ohne Zeitzonen-Umrechnung): „Mi., 2. Dezember 2026“. */
export function dayLabel(iso: string | null): string | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Zeitpunkte immer in Wiener Zeit, unabhängig von der Zeitzone des Geräts. */
export const viennaTime = (d: Date) => d.toLocaleString('de-AT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' })

// Eingabe des Angebots -----------------------------------------------------------------------------------------------------
/** Euro-Eingabe (Komma oder Punkt, höchstens zwei Nachkommastellen, kein Tausenderpunkt) → ganze Cent; sonst `null`. Kein Float. */
export function parseEuro(input: string): number | null {
  const m = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(input.trim())
  if (!m) return null
  const cents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
  return cents > 0 ? cents : null
}

// Aufrufe ------------------------------------------------------------------------------------------------------------------
/**
 * Annahme eines Festpreis-Listings mit genau der gezeigten Auszahlung; bei anderem Wert antwortet der Server mit 409.
 * Ging die Antwort einer geglückten Annahme verloren, liefert der zweite Versuch `already_taken`: steht das Listing dann als angenommen
 * in der eigenen Liste (nur die Firma mit Zuordnung sieht das), war es der eigene Erfolg.
 */
export async function acceptListing(l: Pick<Listing, 'id' | 'revisionId'>, shownPayoutCents: number): Promise<void> {
  try {
    await invoke('accept', { listingId: l.id, revisionId: l.revisionId, shownPayoutCents }, CODES)
  } catch (e) {
    if (!(e instanceof JobError) || e.kind !== 'taken') throw e
    const mine = await loadListings().catch(() => [])
    if (mine.some((x) => x.id === l.id && x.status === 'accepted')) return
    throw e
  }
}

/** Festangebot in ganzen Cent. Die Prüfung hier spart nur den Umweg; Spanne, Grenzen und Status prüft der Server. */
export async function sendOffer(listingId: string, amountCents: number): Promise<void> {
  if (!pos(amountCents) || amountCents > 2147483647) throw new JobError('amount')
  await rpc('send_offer', { p_listing: listingId, p_amount: amountCents })
}

export const withdrawOffer = (offerId: string) => rpc('withdraw_offer', { p_offer: offerId })

/** Signierte Fotos (600 s, nicht speichern) eines Listings: nur Kopien, nie Originale. */
export async function loadPhotos(listingId: string): Promise<string[]> {
  const data = await invoke('job-photo', { listingId }, CODES)
  return (Array.isArray(data) ? data : []).flatMap((p: unknown) => {
    const r = p && typeof p === 'object' ? (p as Record<string, unknown>) : {}
    return typeof r.url === 'string' && r.url.startsWith('https://') ? [r.url] : []
  })
}

// Angenommene Aufträge (s9i-6b) --------------------------------------------------------------------------------------------
export type JobStatus = 'accepted' | 'in_progress' | 'completed' | 'cancelled_by_customer' | 'cancelled_by_partner'
const JOB_STATUS: string[] = ['accepted', 'in_progress', 'completed', 'cancelled_by_customer', 'cancelled_by_partner']
export type Job = {
  /** Zuordnung; die Auftrags-ID gehört nur in Aufrufe, nie in die Anzeige */
  id: string
  requestId: string
  status: JobStatus
  terminAt: Date
  ended: boolean
  district: number | null
  toDistrict: number | null
  service: Listing['service']
  preferredDate: string | null
  timeWindow: string | null
  /** Summen der eigenen Journalzeilen laut Server: nach einem Storno nur die Stornobasis; `null` = nicht lesbar, dann kein Betrag zeigen */
  totalCents: number | null
  payoutCents: number | null
  /** Entscheidung der Datenbankuhr (Status accepted, Termin erreicht); die Geräteuhr entscheidet nichts */
  canStart: boolean
}
const district = (v: unknown): number | null => (int(v) && v >= 1 && v <= 23 ? v : null)
const cents = (v: unknown): number | null => (int(v) && v >= 0 ? v : null)

/** Aufträge der Firma (`my_jobs()`: nur Zuordnungen im Zugriffsfenster, ohne Name, Adresse und Kontakt); unlesbare Zeilen entfallen, nie ein halber Betrag. */
export async function loadJobs(): Promise<Job[]> {
  const { data, error } = await supabase.rpc('my_jobs')
  if (error) throw error
  return (Array.isArray(data) ? data : []).flatMap((r): Job[] => {
    const termin = when(r.termin_at)
    const ended = r.ended_at === null ? false : when(r.ended_at) !== null
    if (!UUID.test(r.assignment_id) || !UUID.test(r.request_id) || !JOB_STATUS.includes(r.status) || !SERVICES.includes(r.service) || !termin || typeof r.can_start !== 'boolean' || (r.ended_at !== null && !ended)) return []
    return [
      {
        id: r.assignment_id,
        requestId: r.request_id,
        status: r.status as JobStatus,
        terminAt: termin,
        ended,
        district: district(r.district),
        toDistrict: district(r.to_district),
        service: r.service as Listing['service'],
        preferredDate: typeof r.preferred_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.preferred_date) ? r.preferred_date : null,
        timeWindow: typeof r.time_window === 'string' ? r.time_window : null,
        totalCents: cents(r.total_cents),
        payoutCents: cents(r.payout_cents),
        canStart: r.can_start,
      },
    ]
  })
}

// Fehlercodes von start_job, complete_job, job_contact (direkte RPCs: die Meldung der Datenbank ist der Code)
const JOB_CODES: Record<string, JobErrorKind> = {
  too_early: 'too_early',
  invalid_transition: 'closed',
  not_found: 'closed',
  not_assigned: 'gone',
  partner_not_active: 'gone',
  mfa_required: 'unauthorized',
}

async function jobCall<T>(fn: 'start_job' | 'complete_job' | 'job_contact', requestId: string): Promise<T> {
  try {
    const { data, error } = await supabase.rpc(fn, { p_request: requestId })
    if (!error) return data as T
    throw new JobError(own(JOB_CODES, error.message) ?? 'unavailable')
  } catch (e) {
    if (e instanceof JobError) throw e
    throw new JobError('offline')
  }
}

/** Die Datenbank prüft Termin (`too_early`), Status und Zuordnung; die App sendet nur die Auftrags-ID. */
export const startJob = (requestId: string): Promise<void> => jobCall('start_job', requestId)
export const finishJob = (requestId: string): Promise<void> => jobCall('complete_job', requestId)

export type Contact = { name: string; phone: string; email: string; stairsDoor: string | null; fromAddress: string | null; toAddress: string | null }
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const textOrNull = (v: unknown): string | null => (text(v) ? v : null)

/** Kontakt und Adressen des Kunden: nur auf Antippen, jeder Aufruf schreibt serverseitig eine Audit-Zeile; die Antwort wird nie gespeichert. */
export async function loadContact(requestId: string): Promise<Contact> {
  const rows = await jobCall<unknown>('job_contact', requestId)
  const r = Array.isArray(rows) && rows.length === 1 && rows[0] && typeof rows[0] === 'object' ? (rows[0] as Record<string, unknown>) : null
  if (!r || !text(r.name) || !text(r.phone) || !text(r.email)) throw new JobError('unavailable')
  return { name: r.name, phone: r.phone, email: r.email, stairsDoor: textOrNull(r.stairs_door), fromAddress: textOrNull(r.from_address), toAddress: textOrNull(r.to_address) }
}

/** `tel:`-Adresse aus einer Telefonnummer (nur Ziffern und führendes Plus; „(0)“ nach der Ländervorwahl entfällt); sonst `null`. */
export function telHref(phone: string): string | null {
  const digits = phone.replace(/^(\s*\+\d+\s*)\(0\)/, '$1').replace(/[^\d+]/g, '')
  return /^\+?\d{5,16}$/.test(digits) ? `tel:${digits}` : null
}
// Positive Zeichenmenge: der Server erlaubt in E-Mails auch `?`, `&`, `%`, `#` (request_contacts_format); sie dürften sonst Betreff, Text oder Empfänger des Mailprogramms setzen
const MAIL = /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/
/** `mailto:`-Adresse nur bei einfach gebauter E-Mail; sonst `null` (dann steht der Text ohne Link da). */
export const mailHref = (email: string): string | null => (MAIL.test(email) ? `mailto:${email}` : null)

// Eigene Angebote ----------------------------------------------------------------------------------------------------------
export type OfferStatus = 'sent' | 'confirmed' | 'withdrawn' | 'expired' | 'superseded' | 'rejected'
export type MyOffer = { id: string; revisionId: string; amountCents: number; status: OfferStatus; validUntil: Date }
const OFFER_STATUS: string[] = ['sent', 'confirmed', 'withdrawn', 'expired', 'superseded', 'rejected']

/** Eigene Angebote der Firma (feste Spaltenliste, ohne `request_id`); sie hängen über die Revision am Listing. */
export async function loadMyOffers(): Promise<MyOffer[]> {
  const { data, error } = await supabase.from('partner_offers').select('id, base_revision_id, amount_cents, status, valid_until').order('created_at', { ascending: false }).limit(20)
  if (error) throw error
  return (Array.isArray(data) ? data : []).flatMap((r): MyOffer[] => {
    const until = when(r.valid_until)
    return UUID.test(r.id) && UUID.test(r.base_revision_id) && pos(r.amount_cents) && OFFER_STATUS.includes(r.status) && until
      ? [{ id: r.id, revisionId: r.base_revision_id, amountCents: r.amount_cents, status: r.status as OfferStatus, validUntil: until }]
      : []
  })
}
