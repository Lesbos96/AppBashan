import type { RouteResult } from '../../supabase/functions/_shared/route/facts.ts'

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

/** Strenge Prüfung einer Routenantwort (auch für gespeicherten Zustand): Region aus dem Enum, Zahlen endlich und ≥ 0, Linie aus [lon, lat]-Paaren. */
export function isRouteResult(r: unknown): r is RouteResult {
  if (!r || typeof r !== 'object') return false
  const x = r as Record<string, unknown>
  return (
    (['vienna', 'austria', 'international'] as unknown[]).includes(x.region) &&
    isNum(x.outsideKm) &&
    isNum(x.driveHours) &&
    isNum(x.distanceKm) &&
    isNum(x.totalKm) &&
    Array.isArray(x.geometry) &&
    x.geometry.every((p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n)))
  )
}
