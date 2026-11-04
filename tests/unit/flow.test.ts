import { LIMITS } from '@pricing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  initialClearance,
  initialFlow,
  initialMontage,
  readClearanceFlow,
  readFlow,
  readMontageFlow,
  toAssembly,
  type ClearanceFlow,
  type TransportFlow,
} from '../../src/lib/flow'

// Gespeicherter Flow-Zustand (sessionStorage) wird nur übernommen, wenn jedes Feld Typ, Aufzählung und Grenzen des Preismodells einhält.

const store = () => {
  const map = new Map<string, string>()
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k), map }
}
let session: ReturnType<typeof store>

beforeEach(() => {
  session = store()
  vi.stubGlobal('sessionStorage', session)
})

const route = { region: 'vienna' as const, outsideKm: 0, driveHours: 0.2, distanceKm: 4.8, totalKm: 9.6, geometry: [[16.37, 48.2]] }
const from = { label: 'Neubaugasse 12, 1070 Wien', point: { lat: 48.2, lon: 16.35 } }
const to = { label: 'Praterstraße 1, 1020 Wien', point: { lat: 48.21, lon: 16.38 } }
const full: TransportFlow = { ...initialFlow, from, to, routeConsent: true, route: { ...route, geometry: [[16.37, 48.2]] }, hours: 5, crew: 3, boxes: 20 }

const putTransport = (v: unknown) => session.setItem('movenow.flow.transport', JSON.stringify(v))
const putClearance = (v: unknown) => session.setItem('movenow.flow.clearance', JSON.stringify(v))
const putMontage = (v: unknown) => session.setItem('movenow.flow.montage', JSON.stringify(v))

describe('readFlow (Transport und Umzug)', () => {
  it('ohne Speicher: Anfangswert', () => {
    expect(readFlow('transport')).toEqual(initialFlow)
    expect(readFlow('move')).toEqual(initialFlow)
  })

  it('gültiger Zustand wird übernommen, je Service getrennt', () => {
    putTransport(full)
    expect(readFlow('transport')).toEqual(full)
    expect(readFlow('move')).toEqual(initialFlow)
  })

  it('kaputtes JSON oder gesperrter Speicher: Anfangswert statt Fehler', () => {
    session.setItem('movenow.flow.transport', '{kaputt')
    expect(readFlow('transport')).toEqual(initialFlow)
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
    })
    expect(readFlow('transport')).toEqual(initialFlow)
  })

  it.each([
    ['fehlendes Feld', Object.fromEntries(Object.entries(full).filter(([k]) => k !== 'boxes'))],
    ['falscher Typ (Zahl als Text)', { ...full, crew: '3' }],
    ['unbekanntes Gut', { ...full, goods: 'auto' }],
    ['unbekannte Fahrzeugart', { ...full, vehicleType: 'bus' }],
    ['Adresse ohne Text', { ...full, from: { point: from.point } }],
    ['Punkt mit Text statt Zahl', { ...full, to: { label: to.label, point: { lat: '48.2', lon: 16.38 } } }],
    ['Punkt unendlich', { ...full, to: { label: to.label, point: { lat: null, lon: 16.38 } } }],
    ['Route ohne Einwilligung', { ...full, routeConsent: false }],
    ['Route ohne Ziel', { ...full, to: null }],
    ['Route mit unbekannter Region', { ...full, route: { ...route, region: 'mars' } }],
    ['Route mit negativen Kilometern', { ...full, route: { ...route, outsideKm: -1 } }],
    ['kein Objekt', 42],
    ['null', null],
  ])('verwirft %s', (_, value) => {
    putTransport(value)
    expect(readFlow('transport')).toEqual(initialFlow)
  })

  // Grenzen aus LIMITS (dieselben wie parseTransportInput und quote): min und max gelten, ein Schritt darüber hinaus nicht.
  const bounds: [keyof TransportFlow, readonly [number, number]][] = [
    ['crew', LIMITS.crew],
    ['vehicles', LIMITS.vehicles],
    ['fromFloor', LIMITS.floor],
    ['toFloor', LIMITS.floor],
    ['boxes', LIMITS.boxes],
    ['parking', LIMITS.parking],
    ['assemblyLm', LIMITS.assemblyLm],
    ['hours', LIMITS.hours],
    ['volume', [1, 100]],
  ]
  it.each(bounds)('%s: Grenzwerte %j', (key, [min, max]) => {
    for (const ok of [min, max]) {
      putTransport({ ...full, [key]: ok })
      expect(readFlow('transport')[key], `${key}=${ok}`).toBe(ok)
    }
    // NaN fehlt bewusst: JSON speichert es als null (bei `hours` gültig: Mindestdauer)
    for (const bad of [min - 1, max + 1]) {
      putTransport({ ...full, [key]: bad })
      expect(readFlow('transport'), `${key}=${bad}`).toEqual(initialFlow)
    }
  })

  // Das Preismodul verlangt hier ganze Zahlen (`int()` in pricing/transport.ts:33-42); ein Bruch würde die Vorschau dauerhaft in den Fehlerzustand bringen.
  it.each(['crew', 'vehicles', 'fromFloor', 'toFloor', 'boxes', 'parking'] as const)('%s: Bruchzahl wird verworfen', (key) => {
    putTransport({ ...full, [key]: 1.5 })
    expect(readFlow('transport')).toEqual(initialFlow)
  })

  it('Stunden und lfm dürfen Bruchzahlen sein (Schritte 0,5 h bzw. 0,1 lfm)', () => {
    putTransport({ ...full, hours: 5.5, assemblyLm: 3.2 })
    expect(readFlow('transport')).toMatchObject({ hours: 5.5, assemblyLm: 3.2 })
  })

  it('Stunden null bedeutet Mindestdauer und ist gültig', () => {
    putTransport({ ...full, hours: null })
    expect(readFlow('transport').hours).toBeNull()
  })

  it('ohne Route ist eine unbestätigte Adresse (Punkt null) gültig', () => {
    putTransport({ ...full, route: null, from: { label: 'Irgendwo', point: null } })
    expect(readFlow('transport').from).toEqual({ label: 'Irgendwo', point: null })
  })
})

describe('readClearanceFlow (Entrümpelung)', () => {
  const c: ClearanceFlow = { ...initialClearance, step: 3, object: 'flat', area: 60, fill: 'full', floor: 3, lift: false, description: 'Altbau' }

  it('gültiger Zustand wird übernommen', () => {
    putClearance(c)
    expect(readClearanceFlow()).toEqual(c)
  })

  it.each([
    ['Schritt 0', { ...c, step: 0 }],
    ['Schritt 7', { ...c, step: 7 }],
    ['unbekanntes Objekt', { ...c, object: 'garage' }],
    ['unbekannter Füllgrad', { ...c, fill: 'leer' }],
    ['Fläche 0', { ...c, area: 0 }],
    ['Fläche über 2000', { ...c, area: LIMITS.clearanceArea[1] + 1 }],
    ['Stockwerk 21', { ...c, floor: 21 }],
    ['Stockwerk 2,5 (Preismodul verlangt ganze Zahl)', { ...c, floor: 2.5 }],
    ['Beschreibung 801 Zeichen', { ...c, description: 'x'.repeat(801) }],
    ['Montage-Entwurf mit unbekannter Art', { ...c, draft: { kind: 'bad', lm: 2, upper: 0, tall: 0 } }],
    ['Montage-Entwurf über 50 lfm', { ...c, draft: { kind: 'kitchen', lm: 2, upper: 51, tall: 0 } }],
  ])('verwirft %s', (_, value) => {
    putClearance(value)
    expect(readClearanceFlow()).toEqual(initialClearance)
  })

  it('Beschreibung mit genau 800 Zeichen ist gültig', () => {
    putClearance({ ...c, description: 'x'.repeat(800) })
    expect(readClearanceFlow().description).toHaveLength(800)
  })

  it('leeres Objekt (noch nicht gewählt) ist gültig', () => {
    putClearance({ ...c, object: '' })
    expect(readClearanceFlow().object).toBe('')
  })
})

describe('readMontageFlow und toAssembly', () => {
  it('gültige Küche wird übernommen, Unsinn verworfen', () => {
    putMontage({ draft: { kind: 'kitchen', lm: 3.2, upper: 2.4, tall: 0.6 } })
    expect(readMontageFlow()).toEqual({ draft: { kind: 'kitchen', lm: 3.2, upper: 2.4, tall: 0.6 } })
    putMontage({ draft: { kind: 'kitchen', lm: -0.1, upper: 0, tall: 0 } })
    expect(readMontageFlow()).toEqual(initialMontage)
    putMontage({ kind: 'standard', lm: 2 })
    expect(readMontageFlow()).toEqual(initialMontage)
  })

  it('Standardmöbel senden nur lm, die Küche alle drei Maße', () => {
    expect(toAssembly({ kind: 'standard', lm: 4, upper: 9, tall: 9 })).toEqual({ kind: 'standard', lm: 4 })
    expect(toAssembly({ kind: 'kitchen', lm: 3, upper: 2, tall: 1 })).toEqual({ kind: 'kitchen', lm: 3, upper: 2, tall: 1 })
  })
})
