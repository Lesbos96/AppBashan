// OPEN_ISSUES S6 „Kleinigkeiten aus der Abnahme“: Länge von description/label und Größe von geometry beim Laden aus dem sessionStorage begrenzt.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initialFlow, readFlow, type TransportFlow } from '../../src/lib/flow'

const store = () => {
  const map = new Map<string, string>()
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) }
}
let session: ReturnType<typeof store>
beforeEach(() => {
  session = store()
  vi.stubGlobal('sessionStorage', session)
})

const point = { lat: 48.2, lon: 16.37 }
const line = (n: number) => Array.from({ length: n }, (_, i): [number, number] => [16 + i * 1e-6, 48])
const full = (over: Partial<TransportFlow> = {}): TransportFlow => ({
  ...initialFlow,
  from: { label: 'A 1, 1010 Wien', point },
  to: { label: 'B 2, 1020 Wien', point },
  routeConsent: true,
  route: { region: 'vienna', outsideKm: 0, driveHours: 0.2, distanceKm: 4.8, totalKm: 9.6, geometry: line(3) },
  ...over,
})
const load = (flow: unknown) => {
  session.setItem('movenow.flow.move', JSON.stringify(flow))
  return readFlow('move')
}

describe('Grenzen beim Laden des Konfigurators', () => {
  it('Beschreibung: 500 Zeichen gültig, 501 verworfen (wie quote)', () => {
    expect(load(full({ description: 'x'.repeat(500) })).description).toHaveLength(500)
    expect(load(full({ description: 'x'.repeat(501) }))).toEqual(initialFlow)
  })

  it('Adresslabel: 200 Zeichen gültig, 201 verworfen (wie quote)', () => {
    expect(load(full({ from: { label: 'x'.repeat(200), point } })).from?.label).toHaveLength(200)
    expect(load(full({ to: { label: 'x'.repeat(201), point } }))).toEqual(initialFlow)
  })

  it('Routenlinie: 50.000 Punkte gültig, mehr verworfen', () => {
    const ok = full({ route: { ...full().route!, geometry: line(50_000) } })
    expect(load(ok).route?.geometry).toHaveLength(50_000)
    expect(load(full({ route: { ...full().route!, geometry: line(50_001) } }))).toEqual(initialFlow)
  })
})
