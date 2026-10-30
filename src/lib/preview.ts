import {
  type ClearancePrice,
  LIMITS,
  computeAssembly,
  computeClearance,
  computeTransport,
  num,
  type OfferReason,
  type OfferResult,
  parseAssembly,
  parseClearanceInput,
  type PriceResult,
  type Tariffs,
  parseTransportInput,
  type TransportPrice,
} from '@pricing'
import { formatEuro } from './money'
import { type AssemblyDraft, type ClearanceFlow, type Service, type TransportFlow, toAssembly } from './flow'

/** Tarife der aktuellen Version; Zeilen mit Einheit `ref` sind nur Quellenverweise. */
export const toTariffs = (prices: { rows: { key: string; value: number; unit: string }[] }): Tariffs => Object.fromEntries(prices.rows.filter((r) => r.unit !== 'ref').map((r) => [r.key, r.value]))

export const minHours = (t: Tariffs, service: Service) => num(t, service === 'move' ? 'min_hours.move' : 'min_hours.transport')
export const stepHours = 0.5
export const maxHours = LIMITS.hours[1]

export type PreviewOf<P extends PriceResult> = { state: 'offer'; offer: OfferResult } | { state: 'price'; price: P }
export type Preview = PreviewOf<TransportPrice>

const wrap = <P extends PriceResult>(result: P | OfferResult): PreviewOf<P> => (result.kind === 'price' ? { state: 'price', price: result } : { state: 'offer', offer: result })

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
  return wrap(computeTransport(t, input, r))
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

/** Vorschau Entrümpelung: dieselbe Prüfung wie später `quote`; ohne gewähltes Objekt wirft sie `InputError`. */
export function previewClearance(t: Tariffs, f: ClearanceFlow): PreviewOf<ClearancePrice> {
  const input = parseClearanceInput({ object: f.object, area: f.area, fill: f.fill, lift: f.lift, floor: f.floor, special: f.special, assembly: f.assembly ? toAssembly(f.draft) : null })
  return wrap(computeClearance(t, input))
}

/** Vorschau für den Service „Montage". */
export function previewAssembly(t: Tariffs, d: AssemblyDraft): PreviewOf<PriceResult<'assembly'>> {
  return { state: 'price', price: computeAssembly(t, parseAssembly(toAssembly(d))) }
}

export const floorText = (n: number) => (n === 0 ? 'Erdgeschoss' : `${n}. Stock`)
export const lmText = (n: number) => `${String(n).replace('.', ',')} lfm`

/** Beschriftung der Montage-Zeile; die Beträge kommen aus dem Preismodul. */
export function assemblyText(d: AssemblyDraft, t: Tariffs): string {
  if (d.kind === 'standard') return `Standardmöbel · ${lmText(Math.max(d.lm, num(t, 'assembly.min_lfm')))} × ${formatEuro(num(t, 'assembly.rate_per_lfm'))}`
  return `Küche · ${lmText(d.lm)} unten, ${lmText(d.upper)} oben, ${lmText(d.tall)} hoch · Grundbetrag ${formatEuro(num(t, 'kitchen.base'))}`
}

export function clearanceLineText(key: 'clearance' | 'access' | 'assembly', p: ClearancePrice, f: ClearanceFlow, t: Tariffs): LineText {
  switch (key) {
    case 'clearance': {
      const volume = `${String(p.volumeM3).replace('.', ',')} m³`
      // Mindestpreis, wenn die Menge ihn nicht erreicht (Preis kommt unverändert aus dem Modul)
      const belowMinimum = p.volumeM3 * num(t, 'clearance.rate') < num(t, 'clearance.minimum')
      return { label: 'Räumung & Entsorgung', detail: belowMinimum ? `${volume} · Mindestpreis` : `${volume} × ${formatEuro(num(t, 'clearance.rate'))}` }
    }
    case 'access': {
      const n = Math.max(0, f.floor - 1)
      return { label: 'Etagenzuschlag', detail: `${n} ${n === 1 ? 'Etage' : 'Etagen'} ohne Lift × ${formatEuro(num(t, 'clearance.floor_surcharge'))}` }
    }
    case 'assembly':
      return { label: 'Montage / Demontage', detail: assemblyText(f.draft, t) }
  }
}
