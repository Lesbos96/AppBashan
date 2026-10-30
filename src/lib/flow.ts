import { type AssemblyInput, type ClearanceInput, LIMITS } from '@pricing'
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

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const within = (v: unknown, [min, max]: readonly [number, number]) => finite(v) && v >= min && v <= max
const place = (v: unknown) => {
  if (v === null) return true
  const p = v as { label?: unknown; point?: { lat?: unknown; lon?: unknown } | null } | undefined
  return typeof p?.label === 'string' && (p.point === null || (!!p.point && finite(p.point.lat) && finite(p.point.lon)))
}
/** Jedes Feld hat den Typ des Anfangswerts; `skip` sind Felder mit eigener Prüfung. */
const typed = (r: Record<string, unknown>, initial: object, skip: string[] = []) => Object.entries(initial).every(([k, v]) => skip.includes(k) || typeof r[k] === typeof v)

/** Gespeicherter Zustand nur, wenn jedes Feld Typ, Aufzählung und Grenzen des Modells einhält; sonst verwerfen. */
function validTransport(raw: unknown): raw is TransportFlow {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as Record<string, unknown>
  return (
    typed(r, initialFlow, ['from', 'to', 'route', 'hours']) &&
    ['normal', 'piano', 'grand', 'safe'].includes(r.goods as string) &&
    ['van', 'truck', 'large'].includes(r.vehicleType as string) &&
    place(r.from) &&
    place(r.to) &&
    (r.route === null || (isRouteResult(r.route) && r.routeConsent === true && !!r.from && !!r.to)) &&
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

/** Montage-Wahl für Service „Montage" und den Schritt „Zusatz" der Entrümpelung; Küche braucht lm (unten), upper und tall. */
export type AssemblyDraft = { kind: 'standard' | 'kitchen'; lm: number; upper: number; tall: number }

export const initialDraft: AssemblyDraft = { kind: 'standard', lm: 2, upper: 0, tall: 0 }

export const toAssembly = (d: AssemblyDraft): AssemblyInput => (d.kind === 'standard' ? { kind: 'standard', lm: d.lm } : { kind: 'kitchen', lm: d.lm, upper: d.upper, tall: d.tall })

function validDraft(raw: unknown): raw is AssemblyDraft {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as Record<string, unknown>
  return ['standard', 'kitchen'].includes(r.kind as string) && within(r.lm, LIMITS.assemblyLm) && within(r.upper, LIMITS.assemblyLm) && within(r.tall, LIMITS.assemblyLm)
}

export type MontageFlow = { draft: AssemblyDraft }
export const initialMontage: MontageFlow = { draft: initialDraft }
const validMontage = (raw: unknown): raw is MontageFlow => !!raw && typeof raw === 'object' && validDraft((raw as Record<string, unknown>).draft)

/** Eingaben des Entrümpelungs-Wizards. `step` (1–6) ist die Seite des Wizards; Beschreibung ist kein Preisfeld. */
export type ClearanceFlow = {
  step: number
  object: '' | ClearanceInput['object']
  area: number
  fill: ClearanceInput['fill']
  floor: number
  /** Lift für die Gegenstände nutzbar (oder ebenerdig). */
  lift: boolean
  special: boolean
  assembly: boolean
  draft: AssemblyDraft
  description: string
}

export const clearanceSteps = 6

export const initialClearance: ClearanceFlow = {
  step: 1,
  object: '',
  area: 40,
  fill: 'normal',
  floor: 0,
  lift: true,
  special: false,
  assembly: false,
  draft: initialDraft,
  description: '',
}

function validClearance(raw: unknown): raw is ClearanceFlow {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as Record<string, unknown>
  return (
    typed(r, initialClearance, ['draft']) &&
    within(r.step, [1, clearanceSteps]) &&
    ['', 'flat', 'house', 'attic', 'cellar', 'office', 'heavy'].includes(r.object as string) &&
    ['light', 'normal', 'full'].includes(r.fill as string) &&
    within(r.area, LIMITS.clearanceArea) &&
    within(r.floor, LIMITS.floor) &&
    (r.description as string).length <= 800 &&
    validDraft(r.draft)
  )
}

/** Flow-Zustand im sessionStorage (nur in diesem Tab), bis `quote` ihn speichert; ungültiger oder fehlender Zustand startet leer. */
function useStored<T>(key: string, initial: T, valid: (raw: unknown) => raw is T): [T, (patch: Partial<T>) => void] {
  const [flow, setFlow] = useState<T>(() => {
    try {
      const raw: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null')
      if (valid(raw)) return raw
    } catch {
      // Zustand ist nur eine Bequemlichkeit; ohne Speicher startet der Flow leer
    }
    return initial
  })
  const update = useCallback(
    (patch: Partial<T>) =>
      setFlow((prev) => {
        const next = { ...prev, ...patch }
        try {
          sessionStorage.setItem(key, JSON.stringify(next))
        } catch {
          // siehe oben
        }
        return next
      }),
    [key],
  )
  return [flow, update]
}

export const useFlow = (service: Service) => useStored(`movenow.flow.${service}`, initialFlow, validTransport)
export const useClearanceFlow = () => useStored('movenow.flow.clearance', initialClearance, validClearance)
export const useMontageFlow = () => useStored('movenow.flow.montage', initialMontage, validMontage)
