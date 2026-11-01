// Prüfung des `quote`-Aufrufs (S8a). Alles, was gespeichert wird, läuft durch eine Prüfung: `inputs` nur über parse*Input,
// die Nicht-Preisfelder über die Parser hier. Unbekannte Schlüssel (auch auf oberster Ebene) werden verworfen. Preise,
// Kilometer, Region und Status kennt der Aufruf nicht; sie entstehen nur auf dem Server.
import {
  type AssemblyInput,
  type ClearanceInput,
  InputError,
  type RentalInput,
  type TransportInput,
  parseAssembly,
  parseClearanceInput,
  parseRentalInput,
  parseTransportInput,
  rec,
} from '../pricing/index.ts'
import { type Point, point } from '../route/facts.ts'
import { instantOf } from './time.ts'

export type Place = { label: string; postcode: string | null; point: Point | null }

/** Zeitfenster für Entrümpelung und Montage (fester Satz, kein Freitext). */
export const TIME_WINDOWS = ['morning', 'midday', 'afternoon', 'flexible'] as const

/** `clientRef` (je Absendeversuch von der App erzeugt) ist Pflicht und macht das Anlegen idempotent; Bearbeiten nach dem Absenden gibt es nicht. */
type Common = { service: 'transport' | 'move' | 'clearance' | 'assembly'; clientRef: string; from: Place | null; to: Place | null; returnTrip: boolean }
export type Extras = { description: string | null; volumeM3: number | null; preferredDate: string; timeWindow: (typeof TIME_WINDOWS)[number] | null }

export type RequestCall =
  | (Common & Extras & { kind: 'request'; service: 'transport' | 'move'; inputs: TransportInput })
  | (Common & Extras & { kind: 'request'; service: 'clearance'; inputs: ClearanceInput })
  | (Common & Extras & { kind: 'request'; service: 'assembly'; inputs: AssemblyInput })
  /** `pickupAt`/`returnAt` in `input` sind Wiener Wanduhrzeit (Preis), `pickupInstant`/`returnInstant` die Zeitpunkte (ISO, UTC) für die Spalten. */
  | { kind: 'rental'; clientRef: string; offerId: string; input: RentalInput; pickupInstant: string; returnInstant: string }

export type QuoteCall = RequestCall

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0009\u000b-\u001f\u007f]/ // Zeilenumbruch bleibt erlaubt (Beschreibung)
const POSTCODE = /^[0-9A-Za-z -]{3,12}$/
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

const KEYS = {
  request: ['service', 'inputs', 'from', 'to', 'returnTrip', 'description', 'volume', 'preferredDate', 'timeWindow', 'clientRef'],
  rental: ['service', 'offerId', 'inputs', 'clientRef'],
} as const

const only = (raw: Record<string, unknown>, keys: readonly string[]) => Object.fromEntries(keys.filter((k) => raw[k] !== undefined).map((k) => [k, raw[k]]))

function text(v: unknown, key: string, min: number, max: number, multiline = false): string {
  if (typeof v !== 'string') throw new InputError(`${key}: Text erwartet`)
  const t = v.trim()
  if (t.length < min || t.length > max || (multiline ? CONTROL : /[\u0000-\u001f\u007f]/).test(t)) throw new InputError(`${key}: ${min}–${max} Zeichen ohne Steuerzeichen erwartet`)
  return t
}

const optional = <T>(v: unknown, parse: (v: unknown) => T): T | null => (v === undefined || v === null ? null : parse(v))

function place(v: unknown, key: string): Place | null {
  if (v === undefined || v === null) return null
  const r = rec(v, key)
  const p = r['point']
  return {
    label: text(r['label'], `${key}.label`, 1, 200),
    postcode: optional(r['postcode'], (x) => {
      if (typeof x !== 'string' || !POSTCODE.test(x)) throw new InputError(`${key}.postcode: ungültig`)
      return x
    }),
    point: p === undefined || p === null ? null : coordinates(p, key),
  }
}

function coordinates(v: unknown, key: string): Point {
  try {
    return point(v)
  } catch {
    throw new InputError(`${key}.point: ungültige Koordinaten`)
  }
}

/** Kalendertag `YYYY-MM-DD`: gültig, nicht vor heute (Wiener Datum), höchstens ein Jahr voraus. */
function day(v: unknown, key: string, today: string): string {
  const m = typeof v === 'string' ? DATE.exec(v) : null
  if (!m) throw new InputError(`${key}: Format YYYY-MM-DD erwartet`)
  const [y, mo, d] = m.slice(1).map(Number) as [number, number, number]
  const ms = Date.UTC(y, mo - 1, d)
  const back = new Date(ms)
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) throw new InputError(`${key}: kein gültiges Datum`)
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number]
  const days = (ms - Date.UTC(ty, tm - 1, td)) / 86_400_000
  if (days < 0 || days > 365) throw new InputError(`${key}: heute bis höchstens 365 Tage voraus`)
  return v as string
}

function oneOfWindow(v: unknown) {
  if (typeof v !== 'string' || !(TIME_WINDOWS as readonly string[]).includes(v)) throw new InputError(`timeWindow: einer von ${TIME_WINDOWS.join(', ')} erwartet`)
  return v as (typeof TIME_WINDOWS)[number]
}

const flag = (v: unknown): boolean => {
  if (typeof v !== 'boolean') throw new InputError('returnTrip: true oder false erwartet')
  return v
}

const uuid = (v: unknown, key: string): string => {
  if (typeof v !== 'string' || !UUID.test(v)) throw new InputError(`${key}: UUID erwartet`)
  return v.toLowerCase()
}

/** `today`: heutiges Datum in Wien (`YYYY-MM-DD`), Grundlage für „nicht in der Vergangenheit“. */
export function parseQuoteCall(body: unknown, today: string): QuoteCall {
  const raw = rec(body, 'Anfrage')
  if (raw['requestId'] !== undefined) throw new InputError('requestId: Bearbeiten nach dem Absenden gibt es nicht')
  const service = raw['service']
  if (service === 'rental') {
    const r = only(raw, KEYS.rental)
    const input = rec(r['inputs'], 'inputs')
    // Eingabe ist Wiener Ortszeit ohne Zone; ISO mit Z oder Offset lehnt parseRentalInput ab.
    const parsed = parseRentalInput(input)
    if (!Number.isInteger(parsed.km)) throw new InputError('km: ganze Zahl erwartet')
    day(parsed.pickupAt.slice(0, 10), 'pickupAt', today)
    return {
      kind: 'rental',
      clientRef: uuid(r['clientRef'], 'clientRef'),
      offerId: uuid(r['offerId'], 'offerId'),
      input: parsed,
      pickupInstant: instantOf(parsed.pickupAt, 'pickupAt'),
      returnInstant: instantOf(parsed.returnAt, 'returnAt'),
    }
  }
  if (service !== 'transport' && service !== 'move' && service !== 'clearance' && service !== 'assembly') throw new InputError('service: unbekannt')
  const r = only(raw, KEYS.request)
  const inputs = rec(r['inputs'], 'inputs')
  const wantsWindow = service === 'clearance' || service === 'assembly'
  const common = {
    kind: 'request' as const,
    clientRef: uuid(r['clientRef'], 'clientRef'),
    from: place(r['from'], 'from'),
    to: service === 'transport' || service === 'move' ? place(r['to'], 'to') : null,
    returnTrip: optional(r['returnTrip'], flag) ?? false,
    preferredDate: day(r['preferredDate'], 'preferredDate', today),
    timeWindow: wantsWindow ? optional(r['timeWindow'], (v) => oneOfWindow(v)) : null,
  }
  const volume = optional(r['volume'], (v) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 1 || v > 100) throw new InputError('volume: Zahl zwischen 1 und 100 erwartet')
    return Math.round(v * 10) / 10
  })
  const description = (max: number) => optional(r['description'], (v) => text(v, 'description', 1, max, true))
  switch (service) {
    case 'transport':
    case 'move':
      return { ...common, service, inputs: parseTransportInput({ ...inputs, service }), description: description(500), volumeM3: volume }
    case 'clearance':
      return { ...common, service, inputs: parseClearanceInput(inputs), description: description(800), volumeM3: null }
    case 'assembly':
      return { ...common, service, inputs: parseAssembly(inputs), description: null, volumeM3: null }
  }
}
