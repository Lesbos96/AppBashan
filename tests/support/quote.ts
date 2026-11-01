// Gemeinsame Bausteine der `quote`-Tests (Unit mit Fakes, Integration gegen das Dev-Projekt): Tarife aus dem Seed,
// fester Routenanbieter (keine echten Kilometer, ORS ist nicht live getestet), Aufrufbeispiele.
import { readFileSync } from 'node:fs'
import type { RouteProvider } from '../../supabase/functions/_shared/route/provider.ts'
import type { ProviderRoute } from '../../supabase/functions/_shared/route/facts.ts'
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

export function fixedProvider(route: ProviderRoute | Error = grazRoute): RouteProvider & { calls: number } {
  const p = {
    id: 'test',
    calls: 0,
    geocode: () => Promise.reject(new Error('nicht benutzt')),
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

export const place = (label: string, point: { lat: number; lon: number } | null, postcode: string | null = '1010') => ({ label, postcode, point })

/** Eindeutige client_ref (UUID v4) je Absendeversuch, über alle Läufe hinweg. */
export const clientRef = () => crypto.randomUUID()

/** Wunschtermin in `days` Tagen (Wiener Datum, `YYYY-MM-DD`): weit genug vor jeder Fristgrenze und innerhalb der 365 Tage. */
export const termin = (days = 14) => new Date(Date.now() + days * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' })

export const moveCall = (over: Record<string, unknown> = {}) => ({
  service: 'move',
  clientRef: clientRef(),
  inputs: moveInputs,
  from: place('Stephansplatz 1, Wien', VIENNA_A),
  to: place('Meidlinger Hauptstraße 1, Wien', VIENNA_B, '1120'),
  returnTrip: false,
  preferredDate: termin(),
  ...over,
})

export const clearanceInputs = { object: 'flat', area: 60, fill: 'normal', lift: false, floor: 3, special: false, assembly: null }
export const clearanceCall = (over: Record<string, unknown> = {}) => ({ service: 'clearance', clientRef: clientRef(), inputs: clearanceInputs, from: place('Ring 1, Wien', null), preferredDate: termin(), ...over })
export const assemblyCall = (over: Record<string, unknown> = {}) => ({ service: 'assembly', clientRef: clientRef(), inputs: { kind: 'kitchen', lm: 3.2, upper: 2.4, tall: 0.6 }, from: place('Ring 1, Wien', null), preferredDate: termin(), ...over })

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
