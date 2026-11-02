// Gemeinsame Bausteine der `quote`-Tests (Unit mit Fakes, Integration gegen das Dev-Projekt): Tarife aus dem Seed,
// fester Routenanbieter (keine echten Kilometer, ORS ist nicht live getestet), Aufrufbeispiele.
import { readFileSync } from 'node:fs'
import type { RouteProvider } from '../../supabase/functions/_shared/route/provider.ts'
import type { Candidate, ProviderRoute } from '../../supabase/functions/_shared/route/facts.ts'
import { hmacHex } from '../../supabase/functions/_shared/route/hmac.ts'

const seed = readFileSync(new URL('../../supabase/seed.sql', import.meta.url), 'utf8')

/** Zeilen von `price_config` Version 1 wie in der DB (mit Einheit, inkl. der `ref`-Zeile). */
export const seedRows = [...seed.matchAll(/\(1, '([\w.]+)', ([\d.]+), '([^']+)'/g)].map((m) => ({ key: m[1]!, value: Number(m[2]), unit: m[3]! }))

export const hmac = hmacHex('test-secret')

export const VIENNA_A = { lat: 48.2086, lon: 16.3731 }
export const VIENNA_B = { lat: 48.1854, lon: 16.3126 }
export const GRAZ = { lat: 47.0707, lon: 15.4395 }

/** Feste Beispielantwort des Anbieters: Wien → Graz, 200 km, 2 h. */
export const grazRoute: ProviderRoute = { legMeters: [200_000], durationSeconds: 7200, line: [[VIENNA_A.lon, VIENNA_A.lat], [GRAZ.lon, GRAZ.lat]] }

export const TERMS = { cancel_free_hours: 48, cancel_late_percent: 50, cancel_full_percent: 100, cancel_full_days_before: 1, call_out_fee_cents: 0, termsHash: 'a'.repeat(64) }
export const CONTACT = { name: 'Test Kunde', phone: '+43 660 1234567', email: 'kunde@movenow.test', stairsDoor: null }

const cand = (lat: number, lon: number, street: string, housenumber: string, postcode: string, locality: string, over: Partial<Candidate> = {}): Candidate => ({
  label: `${street} ${housenumber}, ${postcode} ${locality}`, lat, lon, postcode, country: 'AUT', layer: 'address', street, housenumber, locality, ...over,
})
/** Feste Antworten des Geocoders je Suchtext. */
export const ADDRESSES: Record<string, Candidate> = {
  'Stephansplatz 1, Wien': cand(VIENNA_A.lat, VIENNA_A.lon, 'Stephansplatz', '1', '1010', 'Wien'),
  'Meidlinger Hauptstraße 1, Wien': cand(VIENNA_B.lat, VIENNA_B.lon, 'Meidlinger Hauptstraße', '1', '1120', 'Wien'),
  'Hauptplatz 1, Graz': cand(GRAZ.lat, GRAZ.lon, 'Hauptplatz', '1', '8010', 'Graz'),
  'Ring 1, Wien': cand(VIENNA_A.lat, VIENNA_A.lon, 'Ring', '1', '1010', 'Wien'),
  // Straße ohne Hausnummer und Ort in Deutschland: für die Ablehnungen
  'Kärntner Straße, Wien': cand(VIENNA_A.lat, VIENNA_A.lon, 'Kärntner Straße', '', '1010', 'Wien', { layer: 'street', housenumber: null, label: 'Kärntner Straße, 1010 Wien' }),
  'Marienplatz 1, München': cand(48.1374, 11.5755, 'Marienplatz', '1', '80331', 'München', { country: 'DEU' }),
}
export const geocodeFake = (q: string): Candidate[] => {
  const c = ADDRESSES[q.trim()]
  return c ? [c] : []
}

export function fixedProvider(route: ProviderRoute | Error = grazRoute): RouteProvider & { calls: number; geocodes: number } {
  const p = {
    id: 'test',
    calls: 0,
    geocodes: 0,
    geocode: (q: string) => {
      p.geocodes += 1
      return Promise.resolve(geocodeFake(q))
    },
    route: () => {
      p.calls += 1
      return route instanceof Error ? Promise.reject(route) : Promise.resolve(route)
    },
  }
  return p
}

/** Umzug-Beispiel aus docs/reference/design/README.md (689,61 € bei Strecke innerhalb Wiens). */
export const moveInputs = {
  goods: 'normal',
  crew: 3,
  vehicles: 1,
  vehicleType: 'van',
  hours: 5,
  fromFloor: 0,
  toFloor: 0,
  fromLift: true,
  toLift: true,
  boxes: 20,
  parking: 1,
  packing: false,
  assembly: { kind: 'standard', lm: 3 },
}

export const place = (label: string, point: { lat: number; lon: number } | null) => ({ label, point })

/** Eindeutige client_ref (UUID v4) je Absendeversuch, über alle Läufe hinweg. */
export const clientRef = () => crypto.randomUUID()

/** Wunschtermin in `days` Tagen (Wiener Datum, `YYYY-MM-DD`): weit genug vor jeder Fristgrenze und innerhalb der 365 Tage. */
export const termin = (days = 14) => new Date(Date.now() + days * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' })

export const moveCall = (over: Record<string, unknown> = {}) => ({
  service: 'move',
  clientRef: clientRef(),
  inputs: moveInputs,
  from: place('Stephansplatz 1, Wien', VIENNA_A),
  to: place('Meidlinger Hauptstraße 1, Wien', VIENNA_B),
  returnTrip: false,
  preferredDate: termin(),
  ...over,
})

export const clearanceInputs = { object: 'flat', area: 60, fill: 'normal', lift: false, floor: 3, special: false, assembly: null }
export const clearanceCall = (over: Record<string, unknown> = {}) => ({ service: 'clearance', clientRef: clientRef(), inputs: clearanceInputs, from: place('Ring 1, Wien', VIENNA_A), preferredDate: termin(), ...over })
export const assemblyCall = (over: Record<string, unknown> = {}) => ({ service: 'assembly', clientRef: clientRef(), inputs: { kind: 'kitchen', lm: 3.2, upper: 2.4, tall: 0.6 }, from: place('Ring 1, Wien', VIENNA_A), preferredDate: termin(), ...over })

export const rentalInput = { pickupAt: '2026-11-10T09:00', returnAt: '2026-11-12T09:00', km: 350, cover: true, driver: false, oneWay: false }
export const CARGO_VAN = '00000000-0000-4000-8000-000000000002'
export const rentalCall = (over: Record<string, unknown> = {}) => ({ service: 'rental', clientRef: clientRef(), offerId: CARGO_VAN, inputs: rentalInput, ...over })

export const post = (body: unknown, jwt: string | null = 'aaa.bbb.ccc', init: RequestInit = {}) =>
  new Request('https://example.test/quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(jwt ? { authorization: `Bearer ${jwt}` } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  })

type Reply = { status: number; body: Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any -- Antwort-JSON

/**
 * Sendet einen Aufruf wie die App: ergänzt Preisversion, Bedingungen-Hash und Kontakt, falls der Test sie nicht setzt.
 * Fehlt `shown`, fragt der erste Versuch den Preis ab (409 price_changed mit Snapshot), der zweite bestätigt ihn
 * (wie der Dialog „Der Preis wurde aktualisiert“). Setzt ein Test `shown` selbst, wird nichts ergänzt.
 */
export async function settle(send: (body: unknown) => Promise<Reply>, body: Record<string, unknown>, ctx: { priceVersion: number; termsHash: string }): Promise<Reply> {
  const rental = body['service'] === 'rental'
  const auto = body['shown'] === undefined && body['shownTotalCents'] === undefined
  const first = { priceVersion: ctx.priceVersion, termsHash: ctx.termsHash, contact: CONTACT, ...body, ...(auto ? (rental ? { shownTotalCents: 0 } : { shown: { kind: 'price', totalCents: 0, lowCents: 0, highCents: 0 } }) : {}) }
  const res = await send(first)
  const snap = res.body['snapshot'] as Record<string, any> | undefined // eslint-disable-line @typescript-eslint/no-explicit-any -- Snapshot-JSON
  if (!auto || res.status !== 409 || res.body['error'] !== 'price_changed' || !snap) return res
  if (rental) return send({ ...first, shownTotalCents: snap['totalCents'] })
  const shown = snap['kind'] === 'offer' ? { kind: 'offer', reasons: snap['reasons'] } : { kind: 'price', totalCents: snap['totalCents'] ?? null, lowCents: snap['lowCents'], highCents: snap['highCents'] }
  return send({ ...first, shown })
}
