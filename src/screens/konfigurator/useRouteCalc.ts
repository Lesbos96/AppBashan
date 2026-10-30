import { useEffect, useState } from 'react'
import type { TransportFlow } from '../../lib/flow'
import { route, routeErrorText } from '../../lib/route'

// Gleiche Anfragen teilen sich einen Aufruf (StrictMode, schnelles Umschalten): das Limit der Function ist knapp.
const inflight = new Map<string, ReturnType<typeof route>>()
function fetchRoute(sig: string, ...args: Parameters<typeof route>) {
  let pending = inflight.get(sig)
  if (!pending) {
    pending = route(...args).finally(() => inflight.delete(sig))
    inflight.set(sig, pending)
  }
  return pending
}

/** Berechnet die Route, sobald beide Adressen bestätigt sind und die Einwilligung vorliegt; Fehler werden zum Zustand, nie zu Kilometern. */
export function useRouteCalc(flow: TransportFlow, update: (patch: Partial<TransportFlow>) => void) {
  const { from, to } = { from: flow.from?.point, to: flow.to?.point }
  const sig = flow.routeConsent && from && to && !flow.route ? `${from.lat},${from.lon}>${to.lat},${to.lon}|${flow.returnTrip}` : null
  const [state, setState] = useState<{ sig: string | null; loading: boolean; error: string | null }>({ sig: null, loading: false, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!sig || !from || !to) return
    let alive = true
    ;(async () => {
      setState({ sig, loading: true, error: null })
      try {
        const result = await fetchRoute(sig, from, to, flow.returnTrip)
        if (alive) update({ route: result })
      } catch (e) {
        if (alive) setState({ sig, loading: false, error: routeErrorText(e) })
      }
    })()
    return () => {
      alive = false
    }
    // sig fasst Adressen, Rückfahrt und Einwilligung zusammen; `from`/`to` ändern sich nur mit ihm
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, attempt, update])

  const current = state.sig === sig
  return {
    loading: sig !== null && (!current || state.loading),
    error: sig !== null && current ? state.error : null,
    retry: () => setAttempt((n) => n + 1),
  }
}
