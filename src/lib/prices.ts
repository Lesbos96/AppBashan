import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Source = { label: string; url?: string }
export type PriceRow = { key: string; value: number; unit: string; label: string; sources: Source[]; researchedAt: string | null }
export type Prices = { version: number; effectiveOn: string; rows: PriceRow[] }

function parseSources(json: unknown): Source[] {
  if (!Array.isArray(json)) return []
  return json.flatMap((s) =>
    s && typeof s === 'object' && 'label' in s && typeof s.label === 'string'
      ? [{ label: s.label, url: 'url' in s && typeof s.url === 'string' && s.url.startsWith('https://') ? s.url : undefined }]
      : [],
  )
}

/** Aktuelle Tarife (öffentlich lesbar); die Version bestimmt die View `current_price_version`. */
export async function loadPrices(): Promise<Prices> {
  const current = await supabase.from('current_price_version').select('version, effective_on').single()
  if (current.error) throw current.error
  const { version, effective_on } = current.data
  if (version == null || effective_on == null) throw new Error('Keine gültige Tarifversion')
  const config = await supabase
    .from('price_config')
    .select('key, value, unit, label, sources, researched_at')
    .eq('version', version)
    .order('key')
  if (config.error) throw config.error
  return {
    version,
    effectiveOn: effective_on,
    rows: config.data.map((r) => ({
      key: r.key,
      value: Number(r.value),
      unit: r.unit,
      label: r.label,
      sources: parseSources(r.sources),
      researchedAt: r.researched_at,
    })),
  }
}

export type Loadable<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T }

/** Lädt einmal, `retry` lädt neu. Fehler (auch offline) werden zum Zustand, nie zu Ersatzwerten. */
export function useLoad<T>(load: () => Promise<T>): [Loadable<T>, () => void] {
  const [state, setState] = useState<Loadable<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    load().then(
      (data) => alive && setState({ status: 'ready', data }),
      () => alive && setState({ status: 'error' }),
    )
    return () => {
      alive = false
    }
    // load ist pro Aufruf konstant (Modulfunktion)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])
  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])
  return [state, retry]
}
