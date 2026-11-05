import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Supabase-Client gemockt: from(...).select(...).single()/eq().order() und functions.invoke.
const invoke = vi.fn()
let tables: Record<string, unknown> = {}
const chain = (result: unknown) => {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order']) c[m] = () => c
  c.single = () => Promise.resolve(result)
  c.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(result).then(ok, bad)
  return c
}
vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: (t: string) => chain(tables[t]), functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}))

const { loadPrices } = await import('../../src/lib/prices')
const { RouteError, geocode, route, routeErrorText } = await import('../../src/lib/route')
const { finishOnboarding, hasOnboarded } = await import('../../src/lib/onboarding')

beforeEach(() => {
  invoke.mockReset()
  tables = {}
})
afterEach(() => vi.unstubAllGlobals())

describe('loadPrices (Info-Sheet „Wie rechnet MoveNow?“)', () => {
  const row = { key: 'hourly.crew2_van', value: '89.5', unit: 'eur_per_hour', label: '2 Personen + Transporter', sources: [{ label: 'Quelle A', url: 'https://example.at/a' }], researched_at: '2026-10-29' }

  it('liest die aktuelle Version und wandelt Werte in Zahlen', async () => {
    tables = { current_price_version: { data: { version: 3, effective_on: '2026-11-01' }, error: null }, price_config: { data: [row], error: null } }
    await expect(loadPrices()).resolves.toEqual({
      version: 3,
      effectiveOn: '2026-11-01',
      rows: [{ key: 'hourly.crew2_van', value: 89.5, unit: 'eur_per_hour', label: '2 Personen + Transporter', sources: [{ label: 'Quelle A', url: 'https://example.at/a' }], researchedAt: '2026-10-29' }],
    })
  })

  it('Quellen: nur https-Links, Einträge ohne Text fallen weg (kein javascript:- oder http-Link im Sheet)', async () => {
    const sources = [
      { label: 'sicher', url: 'https://ok.at' },
      { label: 'unsicher', url: 'http://plain.at' },
      { label: 'Skript', url: 'javascript:alert(1)' },
      { label: 'ohne Link' },
      { url: 'https://ohne-text.at' },
      'Text statt Objekt',
      null,
    ]
    tables = { current_price_version: { data: { version: 1, effective_on: '2026-10-29' }, error: null }, price_config: { data: [{ ...row, sources }], error: null } }
    const { rows } = await loadPrices()
    expect(rows[0]!.sources).toEqual([
      { label: 'sicher', url: 'https://ok.at' },
      { label: 'unsicher', url: undefined },
      { label: 'Skript', url: undefined },
      { label: 'ohne Link', url: undefined },
    ])
    tables.price_config = { data: [{ ...row, sources: { label: 'kein Array' } }], error: null }
    expect((await loadPrices()).rows[0]!.sources).toEqual([])
  })

  it('Fehler und fehlende Version werden geworfen, nie Ersatzwerte', async () => {
    const e = { message: 'offline' }
    tables = { current_price_version: { data: null, error: e } }
    await expect(loadPrices()).rejects.toBe(e)
    tables = { current_price_version: { data: { version: null, effective_on: '2026-10-29' }, error: null } }
    await expect(loadPrices()).rejects.toThrow('Keine gültige Tarifversion')
    tables = { current_price_version: { data: { version: 1, effective_on: '2026-10-29' }, error: null }, price_config: { data: null, error: e } }
    await expect(loadPrices()).rejects.toBe(e)
  })
})

describe('Routendienst aus der App (route.ts)', () => {
  const ok = { region: 'austria', outsideKm: 186.5, driveHours: 2.4, distanceKm: 196.1, totalKm: 392.2, geometry: [[16.37, 48.2], [15.44, 47.07]] }
  const http = (status: number) => new FunctionsHttpError(new Response('{}', { status }))

  it('geocode sendet nur Modus und Text und filtert unvollständige Kandidaten', async () => {
    invoke.mockResolvedValue({
      data: { candidates: [{ label: 'Stephansplatz 1, 1010 Wien', lat: 48.2, lon: 16.37 }, { label: 'ohne Punkt' }, { lat: 1, lon: 2 }, { label: 'NaN', lat: Number.NaN, lon: 1 }, null] },
      error: null,
    })
    await expect(geocode('Stephansplatz 1')).resolves.toEqual([{ label: 'Stephansplatz 1, 1010 Wien', lat: 48.2, lon: 16.37 }])
    expect(invoke).toHaveBeenCalledWith('route', { body: { mode: 'geocode', q: 'Stephansplatz 1' } })
  })

  it('geocode ohne Kandidatenliste ist ein Fehler', async () => {
    invoke.mockResolvedValue({ data: { candidates: 'x' }, error: null })
    await expect(geocode('x')).rejects.toMatchObject({ kind: 'unavailable' })
    invoke.mockResolvedValue({ data: null, error: null })
    await expect(geocode('x')).rejects.toBeInstanceOf(RouteError)
  })

  it('route liefert nur eine geprüfte Antwort', async () => {
    invoke.mockResolvedValue({ data: ok, error: null })
    await expect(route({ lat: 48.2, lon: 16.37 }, { lat: 47.07, lon: 15.44 }, true)).resolves.toEqual(ok)
    expect(invoke).toHaveBeenCalledWith('route', { body: { mode: 'route', from: { lat: 48.2, lon: 16.37 }, to: { lat: 47.07, lon: 15.44 }, returnTrip: true } })
    invoke.mockResolvedValue({ data: { ...ok, outsideKm: -1 }, error: null })
    await expect(route({ lat: 1, lon: 1 }, { lat: 1, lon: 1 }, false)).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it.each([
    ['429', http(429), 'rate_limited'],
    ['500', http(500), 'unavailable'],
    ['422 (keine Route)', http(422), 'unavailable'],
    ['kein Netz', new FunctionsFetchError(new TypeError('Failed to fetch')), 'network'],
    ['sonstiger Fehler', new Error('relay'), 'unavailable'],
  ])('Fehler %s wird zu %s', async (_, error, kind) => {
    invoke.mockResolvedValue({ data: null, error })
    await expect(route({ lat: 1, lon: 1 }, { lat: 1, lon: 1 }, false)).rejects.toMatchObject({ kind })
  })

  it('Fehlertext je Art, fremde Fehler als „nicht erreichbar“', () => {
    expect(routeErrorText(new RouteError('network'))).toMatch(/^Keine Verbindung/)
    expect(routeErrorText(new RouteError('rate_limited'))).toMatch(/zu viele Anfragen/)
    expect(routeErrorText(new Error('x'))).toBe(routeErrorText(new RouteError('unavailable')))
    expect(routeErrorText(undefined)).toMatch(/nicht erreichbar/)
  })
})

describe('Onboarding-Merker', () => {
  it('merkt sich das Ende des Onboardings', () => {
    const map = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) })
    expect(hasOnboarded()).toBe(false)
    finishOnboarding()
    expect(hasOnboarded()).toBe(true)
    map.set('movenow.onboarded', 'true')
    expect(hasOnboarded()).toBe(false) // nur der exakte Wert zählt
  })

  it('gesperrter Speicher (privates Fenster): kein Absturz, Onboarding läuft erneut', () => {
    const boom = () => {
      throw new Error('SecurityError')
    }
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom })
    expect(() => finishOnboarding()).not.toThrow()
    expect(hasOnboarded()).toBe(false)
  })
})
