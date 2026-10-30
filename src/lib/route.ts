import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { isRouteResult } from './routeResult'
import { supabase } from './supabase'
import type { Candidate, Point, RouteResult } from '../../supabase/functions/_shared/route/facts.ts'

export type { Candidate, Point, RouteResult }

/** Fehlerarten für die Oberfläche; die Function nennt nur Statuscodes, die UI braucht nur diese Unterscheidung. */
export class RouteError extends Error {
  constructor(readonly kind: 'network' | 'rate_limited' | 'unavailable') {
    super(kind)
  }
}

const messages = {
  network: 'Keine Verbindung. Prüfe dein Netz und versuche es erneut.',
  rate_limited: 'Gerade sind zu viele Anfragen unterwegs. Versuche es in einer Minute erneut.',
  unavailable: 'Die Routenberechnung ist gerade nicht erreichbar. Versuche es später erneut.',
}

export const routeErrorText = (e: unknown) => messages[e instanceof RouteError ? e.kind : 'unavailable']

async function call(body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('route', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) throw new RouteError(error.context.status === 429 ? 'rate_limited' : 'unavailable')
    throw new RouteError(error instanceof FunctionsFetchError ? 'network' : 'unavailable')
  }
  return data
}

/** Adresstext → Kandidaten zur Bestätigung. Der Text geht erst nach Einwilligung an die Function. */
export async function geocode(q: string): Promise<Candidate[]> {
  const body = (await call({ mode: 'geocode', q })) as { candidates?: unknown } | null
  if (!Array.isArray(body?.candidates)) throw new RouteError('unavailable')
  return body.candidates.filter((c): c is Candidate => typeof c?.label === 'string' && Number.isFinite(c.lat) && Number.isFinite(c.lon))
}

/** Routenfakten aus der Function; eine ungültige Antwort wird zum Fehler, nie zu Ersatzwerten. */
export async function route(from: Point, to: Point, returnTrip: boolean): Promise<RouteResult> {
  const r = await call({ mode: 'route', from, to, returnTrip })
  if (!isRouteResult(r)) throw new RouteError('unavailable')
  return r
}
