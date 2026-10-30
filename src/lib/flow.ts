import { LIMITS } from '@pricing'
import { useCallback, useState } from 'react'
import type { RouteResult } from '../../supabase/functions/_shared/route/facts.ts'
import { isRouteResult } from './routeResult'

export type Service = 'transport' | 'move'

/** Adresse; `point` ist gesetzt, wenn der Nutzer einen Treffer des Routendienstes bestätigt hat. */
export type Place = { label: string; point: { lat: number; lon: number } | null }

/** Eingaben des Konfigurators (Möbeltransport und Umzug). Beschreibung und Volumen sind keine Preisfelder. */
export type TransportFlow = {
  goods: 'normal' | 'piano' | 'grand' | 'safe'
  description: string
  volume: number
  crew: number
  vehicles: number
  vehicleType: 'van' | 'truck' | 'large'
  fromFloor: number
  toFloor: number
  fromLift: boolean
  toLift: boolean
  from: Place | null
  to: Place | null
  /** Einwilligung, Adresstexte an den Routendienst zu senden. */
  routeConsent: boolean
  returnTrip: boolean
  /** Aus `route`; gilt nur für die Adressen und die Rückfahrt, mit denen sie berechnet wurde. */
  route: RouteResult | null
  /** Zeit in Stunden; `null` = Mindestdauer des Services. */
  hours: number | null
  assembly: boolean
  assemblyLm: number
  boxes: number
  parking: number
  packing: boolean
}

export const initialFlow: TransportFlow = {
  goods: 'normal',
  description: '',
  volume: 10,
  crew: 2,
  vehicles: 1,
  vehicleType: 'van',
  fromFloor: 0,
  toFloor: 0,
  fromLift: false,
  toLift: false,
  from: null,
  to: null,
  routeConsent: false,
  returnTrip: true,
  route: null,
  hours: null,
  assembly: false,
  assemblyLm: 2,
  boxes: 0,
  parking: 0,
  packing: false,
}

const key = (service: Service) => `movenow.flow.${service}`

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const within = (v: unknown, [min, max]: readonly [number, number]) => finite(v) && v >= min && v <= max
const place = (v: unknown) => {
  if (v === null) return true
  const p = v as { label?: unknown; point?: { lat?: unknown; lon?: unknown } | null } | undefined
  return typeof p?.label === 'string' && (p.point === null || (!!p.point && finite(p.point.lat) && finite(p.point.lon)))
}

/** Gespeicherter Zustand nur, wenn jedes Feld Typ, Aufzählung und Grenzen des Modells einhält; sonst verwerfen. */
function valid(raw: unknown): raw is TransportFlow {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as Record<string, unknown>
  const skip = ['from', 'to', 'route', 'hours']
  const typed = Object.entries(initialFlow).every(([k, v]) => skip.includes(k) || typeof r[k] === typeof v)
  return (
    typed &&
    ['normal', 'piano', 'grand', 'safe'].includes(r.goods as string) &&
    ['van', 'truck', 'large'].includes(r.vehicleType as string) &&
    place(r.from) &&
    place(r.to) &&
    (r.route === null || isRouteResult(r.route)) &&
    (r.hours === null || within(r.hours, LIMITS.hours)) &&
    within(r.crew, LIMITS.crew) &&
    within(r.vehicles, LIMITS.vehicles) &&
    within(r.fromFloor, LIMITS.floor) &&
    within(r.toFloor, LIMITS.floor) &&
    within(r.boxes, LIMITS.boxes) &&
    within(r.parking, LIMITS.parking) &&
    within(r.assemblyLm, LIMITS.assemblyLm) &&
    within(r.volume, [1, 100])
  )
}

function read(service: Service): TransportFlow {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(key(service)) ?? 'null')
    if (valid(raw)) return raw
  } catch {
    // Zustand ist nur eine Bequemlichkeit; ohne Speicher startet der Flow leer
  }
  return initialFlow
}

/** Flow-Zustand je Service im sessionStorage (nur in diesem Tab), bis `quote` ihn speichert. */
export function useFlow(service: Service): [TransportFlow, (patch: Partial<TransportFlow>) => void] {
  const [flow, setFlow] = useState(() => read(service))
  const update = useCallback(
    (patch: Partial<TransportFlow>) =>
      setFlow((prev) => {
        const next = { ...prev, ...patch }
        try {
          sessionStorage.setItem(key(service), JSON.stringify(next))
        } catch {
          // siehe read()
        }
        return next
      }),
    [service],
  )
  return [flow, update]
}
