import { describe, expect, it } from 'vitest'
import { initialFlow, type TransportFlow } from '../../src/lib/flow'
import { formatEuro } from '../../src/lib/money'
import { lineText, offerReasonText, previewTransport } from '../../src/lib/preview'
import { tariffs } from './golden.ts'

// Umzug-Beispiel aus dem README: 3 Personen, 1 Fahrzeug, 5 h, Wien, Montage 3 lfm, 20 Kartons, 1 Halteverbot
const route = { region: 'vienna', outsideKm: 0, driveHours: 0.2, distanceKm: 4.8, totalKm: 9.6, geometry: [] } as const
const beispiel: TransportFlow = { ...initialFlow, crew: 3, hours: 5, assembly: true, assemblyLm: 3, boxes: 20, parking: 1, route: { ...route, geometry: [] } }

describe('Preisvorschau des Konfigurators', () => {
  it('Umzug-Beispiel: 689,61 € mit den vier Positionen der Referenz', () => {
    const p = previewTransport(tariffs, 'move', beispiel)
    expect(p.state).toBe('price')
    if (p.state !== 'price') return
    expect(p.price.totalCents).toBe(68961)
    expect(p.price.lines.map((l) => [l.key, l.cents])).toEqual([
      ['team', 35400],
      ['assembly', 14361],
      ['boxes', 7200],
      ['parking', 12000],
    ])
    expect(lineText('team', p.price, beispiel, tariffs).detail).toBe(`5 h × ${formatEuro(7080)} · 3 Personen, 1 Transporter`)
    expect(lineText('assembly', p.price, beispiel, tariffs).detail).toBe(`Standardmöbel · 3 lfm × ${formatEuro(4787)}`)
  })

  it('ohne berechnete Strecke gibt es nie einen Preis, sondern ein Angebot mit Grund', () => {
    const p = previewTransport(tariffs, 'move', { ...beispiel, route: null })
    expect(p).toEqual({ state: 'offer', offer: { kind: 'offer', reasons: ['route_missing'] } })
    expect(offerReasonText.route_missing).toMatch(/Strecke/)
  })

  it('Klavier bleibt Angebot, auch mit Strecke', () => {
    const p = previewTransport(tariffs, 'move', { ...beispiel, goods: 'piano' })
    expect(p.state).toBe('offer')
  })

  it('ungültige Eingaben werfen statt zu rechnen', () => {
    expect(() => previewTransport(tariffs, 'move', { ...beispiel, crew: 9 })).toThrow()
  })
})
