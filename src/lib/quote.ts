import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import type { Tariffs } from '@pricing'
import { type Path, type Shown, attemptKey, readShownFull, readTermin, services } from './draft'
import { readClearanceFlow, readFlow, readMontageFlow, toAssembly } from './flow'
import { formatEuro, formatEuroRounded } from './money'
import { clearanceFields, offerReasonText, transportFields } from './preview'
import { supabase } from './supabase'

type Body = Record<string, unknown>
type Place = { label: string; point?: { lat: number; lon: number } }
export type Contact = { name: string; phone: string; email: string; stairsDoor: string }
/** Bedingungen aus `booking_terms()`; `termsHash` bestätigt der Kunde mit dem Absenden. */
export type Terms = { termsHash: string } & Record<string, unknown>
/** Was der Kunde bestätigt hat bzw. gerade bestätigt: Preisversion, Bedingungen, gezeigter Preis (sonst die Vorschau aus dem Konfigurator), Kontakt. */
export type Confirmed = { priceVersion: number; termsHash: string; shown?: Shown; contact: Contact }

const place = (p: { label: string; point: { lat: number; lon: number } | null } | null): Place | undefined => (p ? { label: p.label, ...(p.point && { point: p.point }) } : undefined)
const text = (s: string) => s.trim() || undefined

/**
 * Aufruf für `quote` aus Flow und Termin im sessionStorage. Er enthält nur die Kundenwahl: keine Preise, Kilometer, Region oder Status.
 * `null`, solange der Termin unvollständig ist oder kein gezeigter Preis gemerkt wurde: `shown` ist die Zustimmung des Kunden
 * und stammt nie aus einer Neuberechnung beim Senden. Die Strecke berechnet `quote` selbst aus den bestätigten Koordinaten.
 */
export function buildBody(path: Path, tariffs: Tariffs, confirmed: Confirmed): Body | null {
  const termin = readTermin(path)
  const shown = confirmed.shown ?? readShownFull(path)
  if (!termin.date || !shown) return null
  const { stairsDoor, ...contact } = confirmed.contact
  const base = { service: services[path].service, preferredDate: termin.date, priceVersion: confirmed.priceVersion, termsHash: confirmed.termsHash, shown, contact: { ...contact, ...(stairsDoor.trim() && { stairsDoor: stairsDoor.trim() }) } }
  switch (services[path].service) {
    case 'transport':
    case 'move': {
      const f = readFlow(services[path].service as 'transport' | 'move')
      if (!f.from || !f.to) return null
      return { ...base, inputs: transportFields(tariffs, services[path].service as 'transport' | 'move', f), from: place(f.from), to: place(f.to), returnTrip: f.returnTrip, description: text(f.description), volume: f.volume }
    }
    case 'clearance': {
      const f = readClearanceFlow()
      if (!f.object || !text(termin.place) || !termin.point) return null
      return { ...base, inputs: clearanceFields(f), from: { label: termin.place.trim(), point: termin.point }, description: text(f.description), timeWindow: termin.window }
    }
    case 'assembly': {
      if (!text(termin.place) || !termin.point) return null
      return { ...base, inputs: toAssembly(readMontageFlow().draft), from: { label: termin.place.trim(), point: termin.point }, timeWindow: termin.window }
    }
  }
}

/**
 * `clientRef` je Entwurf: gleicher Inhalt (Doppeltipp, erneuter Versuch) behält die Ref, geänderter Inhalt bekommt eine neue.
 * Sonst lieferte der Server bei geänderten Eingaben die alte gespeicherte Antwort.
 */
export function refFor(path: Path, body: Body): string {
  const json = JSON.stringify(body)
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(attemptKey(path)) ?? 'null')
    if (stored && typeof stored === 'object' && 'ref' in stored && 'body' in stored && stored.body === json && typeof stored.ref === 'string' && UUID.test(stored.ref)) return stored.ref
  } catch {
    // ohne Speicher gilt die Ref nur für diesen Versuch
  }
  const ref = crypto.randomUUID()
  try {
    sessionStorage.setItem(attemptKey(path), JSON.stringify({ ref, body: json }))
  } catch {
    // siehe oben
  }
  return ref
}

export type QuoteErrorKind = 'invalid_input' | 'unauthorized' | 'rate_limited' | 'offline' | 'unavailable' | 'provider' | 'rejected' | 'price_changed' | 'terms_changed'

/** Antwort eines 409: nichts wurde gespeichert, der Kunde bestätigt den neuen Preis bzw. die neuen Bedingungen. */
export type Conflict = { priceVersion?: number; snapshot?: Snapshot | null; terms?: Terms }

/** `field`: Präfix der Servermeldung (`preferredDate`, `from.label`, …); `code`: Fehlercode eines 422; die App zeigt eigene Texte, nie die Servermeldung. */
export class QuoteError extends Error {
  constructor(
    readonly kind: QuoteErrorKind,
    readonly field: string | null = null,
    readonly code: string | null = null,
    readonly conflict: Conflict = {},
  ) {
    super(kind)
  }
}

export type Snapshot =
  /** `totalCents` fehlt bei einer Spanne (Entrümpelung): dann gibt es nur low und high. */
  | { kind: 'price'; totalCents: number | null; lowCents: number; highCents: number; lines: { key: string; cents: number }[] }
  | { kind: 'offer'; reasons: string[] }

const cents = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0

/** Strenge Prüfung: Preis nur mit ganzen Cent. Festpreis: total = low = high und Zeilensumme = Gesamt. Spanne ohne total: low < high, Zeilensumme dazwischen. Sonst `null` (nie ein halber Preis). */
export function parseSnapshot(raw: unknown): Snapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.kind === 'offer') {
    const known = Object.keys(offerReasonText)
    return Array.isArray(r.reasons) && r.reasons.length > 0 && r.reasons.every((x) => typeof x === 'string' && known.includes(x)) ? { kind: 'offer', reasons: r.reasons as string[] } : null
  }
  if (r.kind !== 'price' || !cents(r.lowCents) || !cents(r.highCents) || !Array.isArray(r.lines)) return null
  const total = r.totalCents === undefined ? null : cents(r.totalCents) ? r.totalCents : NaN
  if (total !== null ? Number.isNaN(total) || r.lowCents > total || total > r.highCents : r.lowCents >= r.highCents) return null
  const lines = r.lines.map((l: unknown) => (l && typeof l === 'object' && 'key' in l && 'cents' in l && typeof l.key === 'string' && cents(l.cents) ? { key: l.key, cents: l.cents } : null))
  if (lines.some((l) => l === null)) return null
  const ok = lines as { key: string; cents: number }[]
  const sum = ok.reduce((acc, l) => acc + l.cents, 0)
  const fits = total !== null ? sum === total : sum >= r.lowCents && sum <= r.highCents
  return fits ? { kind: 'price', totalCents: total, lowCents: r.lowCents, highCents: r.highCents, lines: ok } : null
}

/** Anzeige des Preises: Festpreise mit Cent, eine Spanne (Entrümpelung) als „X bis Y“ bzw. „ca. X“ in ganzen Euro. Gerundet wird nur hier. */
export function priceLabel(s: Snapshot & { kind: 'price' }): { main: string; range: string | null } {
  // Festpreis (auch Mindestpreis mit low = high) centgenau; nur eine Spanne wird als Schätzung gerundet
  if (s.totalCents === null) {
    const low = formatEuroRounded(s.lowCents)
    const high = formatEuroRounded(s.highCents)
    return { main: low === high ? `ca. ${low}` : `${low} bis ${high}`, range: null }
  }
  return { main: formatEuro(s.totalCents), range: null }
}

export type Quote = { id: string; status: 'requested' | 'awaiting_offer'; needsQuote: boolean; snapshot: Snapshot | null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Antwort von `quote`. Gültige id mit unlesbarem Preis: die Anfrage ist gespeichert, der Preis wird nicht gezeigt. */
function parseQuote(raw: unknown): Quote {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  if (typeof r.id !== 'string' || !UUID.test(r.id) || (r.status !== 'requested' && r.status !== 'awaiting_offer')) throw new QuoteError('unavailable')
  const snapshot = typeof r.needsQuote === 'boolean' ? parseSnapshot(r.snapshot) : null
  // Angebot und Spanne warten auf ein Festangebot (needsQuote), ein Festpreis nicht.
  const consistent = snapshot !== null && (snapshot.kind === 'offer' || snapshot.totalCents === null) === r.needsQuote
  return { id: r.id, status: r.status, needsQuote: r.needsQuote === true, snapshot: consistent ? snapshot : null }
}

/** Ein Aufruf, keine automatische Wiederholung (Limit 6/min). Der Token stammt aus genau der Sitzung, deren E-Mail der Kunde bestätigt hat. */
export async function sendQuote(body: Body, clientRef: string, accessToken: string): Promise<Quote> {
  const { data, error } = await supabase.functions.invoke('quote', { body: { ...body, clientRef }, headers: { Authorization: `Bearer ${accessToken}` } })
  if (error) {
    if (error instanceof FunctionsFetchError) throw new QuoteError('offline')
    if (error instanceof FunctionsHttpError) {
      const status = error.context.status
      if (status === 401) throw new QuoteError('unauthorized')
      if (status === 429) throw new QuoteError('rate_limited')
      if (status === 503) throw new QuoteError('provider')
      const detail: unknown = status === 400 || status === 409 || status === 422 ? await error.context.json().catch(() => null) : null
      const d = detail && typeof detail === 'object' ? (detail as Record<string, unknown>) : {}
      if (status === 409 && d.error === 'price_changed') throw new QuoteError('price_changed', null, null, { priceVersion: typeof d.priceVersion === 'number' ? d.priceVersion : undefined, snapshot: parseSnapshot(d.snapshot) })
      if (status === 409 && d.error === 'terms_changed') throw new QuoteError('terms_changed', null, null, { terms: parseTerms(d.terms) ?? undefined })
      if (status === 422) {
        if (d.error === 'too_late') throw new QuoteError('invalid_input', 'preferredDate')
        throw new QuoteError('rejected', null, typeof d.error === 'string' ? d.error : null)
      }
      if (status === 400) {
        const message = typeof d.message === 'string' ? d.message : ''
        throw new QuoteError('invalid_input', /^([A-Za-z][\w.]*):/.exec(message)?.[1] ?? null)
      }
    }
    throw new QuoteError('unavailable')
  }
  return parseQuote(data)
}

const FIELD_TEXT: [RegExp, string][] = [
  [/^preferredDate$/, 'Das Wunschdatum geht nicht. Wähle einen Tag, der noch ein paar Stunden entfernt ist, höchstens ein Jahr im Voraus.'],
  [/^(from|to)(\.|$)/, 'Mit einer Adresse stimmt etwas nicht. Prüfe Abholung, Ziel und Ort.'],
  [/^timeWindow$/, 'Das Zeitfenster geht nicht. Wähle ein anderes.'],
]

const TERM_KEYS = ['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents']

/** Bedingungen nur mit allen Werten und gültigem Hash. */
export function parseTerms(raw: unknown): Terms | null {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!r || typeof r.termsHash !== 'string' || !/^[0-9a-f]{64}$/.test(r.termsHash) || TERM_KEYS.some((k) => typeof r[k] !== 'number')) return null
  return r as Terms
}

export async function loadTerms(): Promise<Terms> {
  const { data, error } = await supabase.rpc('booking_terms')
  const terms = parseTerms(data)
  if (error || !terms) throw error ?? new Error('Bedingungen unlesbar')
  return terms
}

/** Der Preis, den der Kunde vor dem Senden sieht (und mit `shown` bestätigt): Festpreis mit Cent, Spanne in ganzen Euro, beim Angebot „Preis nach Prüfung“. */
export function shownLabel(s: Shown): string {
  return s.kind === 'offer' ? 'Preis nach Prüfung' : priceLabel({ kind: 'price', totalCents: s.totalCents, lowCents: s.lowCents, highCents: s.highCents, lines: [] }).main
}

/** Stornobedingungen in Worten, aus genau den Werten, deren `termsHash` der Kunde mit dem Absenden bestätigt. `callOutCents` 0: keine Anfahrtspauschale. */
export function termsText(terms: Terms): { storno: string[]; callOutCents: number } {
  const n = (k: string) => Number(terms[k])
  const days = n('cancel_full_days_before')
  const from = days === 0 ? 'dem Tag des Termins' : days === 1 ? 'einem Tag vor dem Termin' : `${days} Tagen vor dem Termin`
  return {
    storno: [`Kostenlos stornieren kannst du bis ${n('cancel_free_hours')} Stunden vor dem Termin.`, `Danach werden ${n('cancel_late_percent')} % des Preises berechnet, ab ${from} ${n('cancel_full_percent')} %.`],
    callOutCents: n('call_out_fee_cents'),
  }
}

/** Anzeige eines Serverpreises im Format von `shown`: Festpreis bei gesetztem Gesamtbetrag, sonst Spanne bzw. Angebot. */
export function shownFromSnapshot(s: Snapshot): Shown {
  return s.kind === 'offer' ? { kind: 'offer', reasons: s.reasons } : { kind: 'price', totalCents: s.totalCents, lowCents: s.lowCents, highCents: s.highCents }
}

/** Meldungen zu den 422-Codes von `quote`. */
export const rejectedText: Record<string, string> = {
  pickup_outside_vienna: 'Abholung außerhalb Wiens ist noch nicht buchbar.',
  district_required: 'Zur Abholadresse finden wir keinen Wiener Bezirk. Prüfe die Adresse.',
  address_mismatch: 'Die Adresse passt nicht zur Auswahl. Suche sie bitte neu und tippe sie an.',
  address_imprecise: 'Die Adresse braucht eine Hausnummer. Suche sie bitte neu.',
  address_point_required: 'Bestätige die Adresse über die Suche.',
  offer_not_bookable: 'Ziele im Ausland sind noch nicht buchbar.',
}

export const errorText: Record<Exclude<QuoteErrorKind, 'invalid_input' | 'rejected' | 'price_changed' | 'terms_changed'>, string> = {
  provider: 'Die Adressprüfung ist gerade nicht erreichbar. Dein Entwurf bleibt erhalten, versuche es in einer Minute erneut.',
  unauthorized: 'Deine Anmeldung ist abgelaufen. Melde dich neu an, dein Entwurf bleibt erhalten.',
  rate_limited: 'Gerade sind zu viele Anfragen unterwegs. Warte etwa eine Minute und versuche es dann erneut.',
  offline: 'Keine Verbindung. Prüfe dein Netz und versuche es erneut. Dein Entwurf bleibt erhalten.',
  unavailable: 'Das hat nicht geklappt. Dein Entwurf bleibt erhalten, versuche es gleich noch einmal.',
}

/** Text zu einem 400: eigener Hinweis je Feld, sonst ein allgemeiner. */
export const invalidText = (field: string | null) => FIELD_TEXT.find(([re]) => field !== null && re.test(field))?.[1] ?? 'Eine Angabe passt nicht. Gehe zurück und prüfe deine Eingaben.'

/** Ziel, an dem ein 400 behoben wird: Termin bei Datum, Fenster und Adressen von Entrümpelung und Montage, sonst der Konfigurator. */
export const invalidTarget = (path: Path, field: string | null) => {
  // Bei Transport und Umzug stehen die Adressen im Konfigurator, nicht im Termin
  const fixable = services[path].hasAddresses ? /^(preferredDate)$/ : /^(preferredDate|timeWindow|from)(\.|$)/
  return field !== null && fixable.test(field) ? `/${path}/termin` : services[path].back
}
