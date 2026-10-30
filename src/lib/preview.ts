import {
  LIMITS,
  computeTransport,
  num,
  type OfferReason,
  type OfferResult,
  type Tariffs,
  parseTransportInput,
  type TransportPrice,
} from '@pricing'
import { formatEuro } from './money'
import type { Service, TransportFlow } from './flow'

/** Tarife der aktuellen Version; Zeilen mit Einheit `ref` sind nur Quellenverweise. */
export const toTariffs = (prices: { rows: { key: string; value: number; unit: string }[] }): Tariffs => Object.fromEntries(prices.rows.filter((r) => r.unit !== 'ref').map((r) => [r.key, r.value]))

export const minHours = (t: Tariffs, service: Service) => num(t, service === 'move' ? 'min_hours.move' : 'min_hours.transport')
export const stepHours = 0.5
export const maxHours = LIMITS.hours[1]

export type Preview = { state: 'offer'; offer: OfferResult } | { state: 'price'; price: TransportPrice }

/** Vorschau für die Preiskarte; gerechnet wird ausschließlich im Preismodul. Ohne berechnete Strecke liefert es ein Angebot (route_missing), nie einen Preis. */
export function previewTransport(t: Tariffs, service: Service, f: TransportFlow): Preview {
  // Dieselbe Prüfung wie später `quote`; ungültige Werte werfen `InputError` (die Seite zeigt dann den Fehlerzustand).
  const input = parseTransportInput({
    service,
    goods: f.goods,
    crew: f.crew,
    vehicles: f.vehicles,
    vehicleType: f.vehicleType,
    hours: f.hours ?? minHours(t, service),
    fromFloor: f.fromFloor,
    toFloor: f.toFloor,
    fromLift: f.fromLift,
    toLift: f.toLift,
    boxes: f.boxes,
    parking: f.parking,
    packing: f.packing,
    assembly: f.assembly ? { kind: 'standard', lm: f.assemblyLm } : null,
  })
  const r = f.route && { region: f.route.region, outsideKm: f.route.outsideKm, driveHours: f.route.driveHours }
  const result = computeTransport(t, input, r)
  return result.kind === 'price' ? { state: 'price', price: result } : { state: 'offer', offer: result }
}

export const offerReasonText: Record<OfferReason, string> = {
  route_missing: 'Die Strecke ist nicht berechnet. Ein Partner prüft Abholung und Ziel persönlich.',
  crew_lt_vehicles: 'Mehr Fahrzeuge als Personen: Fahrer und Ablauf müssen geplant werden.',
  special_goods: 'Spezialgut: Gewicht, Maße und Stiegenhaus prüft ein Partner persönlich.',
  large_truck: 'Großer LKW oder Hebebühne: Das passende Fahrzeug stimmt ein Partner ab.',
  packing: 'Einpackservice: Aufwand und Material stimmt ein Partner mit dir ab.',
  international: 'Umzug ins oder aus dem Ausland: Strecke, Rückfahrt, Maut und Formalitäten kalkuliert ein Partner persönlich.',
  commercial: 'Gewerbe: Das prüft ein Partner persönlich.',
  heavily_loaded: 'Stark belastete Räume: Das prüft ein Partner vor Ort.',
  special_case: 'Sonderfall: Das prüft ein Partner persönlich.',
}

export const hoursText = (h: number) => `${String(h).replace('.', ',')} h`

export type LineText = { label: string; detail?: string }

/** Beschriftung der Preiszeilen; die Beträge kommen unverändert aus `price.lines`. */
export function lineText(key: TransportPrice['lines'][number]['key'], p: TransportPrice, f: TransportFlow, t: Tariffs): LineText {
  const vehicle = f.vehicleType === 'van' ? 'Transporter' : 'Möbel-LKW'
  switch (key) {
    case 'team':
      return {
        label: 'Team & Fahrzeug',
        detail: `${hoursText(p.billedHours)} × ${formatEuro(p.hourlyRateCents)} · ${f.crew} ${f.crew === 1 ? 'Person' : 'Personen'}, ${f.vehicles} ${vehicle}`,
      }
    case 'travel':
      return { label: 'Fahrzeit außerhalb Wiens', detail: `${hoursText(f.route?.driveHours ?? 0)} × ${formatEuro(p.hourlyRateCents)}` }
    case 'mileage':
      return { label: 'Kilometer außerhalb Wiens', detail: `${String(f.route?.outsideKm ?? 0).replace('.', ',')} km × ${formatEuro(num(t, 'outside_km_rate'))}${f.vehicles > 1 ? ` × ${f.vehicles} Fahrzeuge` : ''}` }
    case 'assembly':
      return { label: 'Montage / Demontage', detail: `Standardmöbel · ${String(Math.max(f.assemblyLm, num(t, 'assembly.min_lfm'))).replace('.', ',')} lfm × ${formatEuro(num(t, 'assembly.rate_per_lfm'))}` }
    case 'boxes':
      return { label: 'Umzugskartons', detail: `${f.boxes} × ${formatEuro(num(t, 'box'))}` }
    case 'parking':
      return { label: 'Halteverbotszone', detail: `${f.parking} ${f.parking === 1 ? 'Adresse' : 'Adressen'} × ${formatEuro(num(t, 'parking_zone'))}` }
  }
}
