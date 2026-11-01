import { useCallback, useRef, useState } from 'react'

/** URL-Segment → Service der Function `quote`, Seitentitel, Rücksprung in den Konfigurator und Flow-Schlüssel im sessionStorage. */
export const services = {
  transport: { service: 'transport', title: 'Möbeltransport', back: '/transport', flowKey: 'movenow.flow.transport', hasAddresses: true },
  umzug: { service: 'move', title: 'Umzug', back: '/umzug', flowKey: 'movenow.flow.move', hasAddresses: true },
  entruempelung: { service: 'clearance', title: 'Entrümpelung', back: '/entruempelung/ergebnis', flowKey: 'movenow.flow.clearance', hasAddresses: false },
  montage: { service: 'assembly', title: 'Montage', back: '/montage', flowKey: 'movenow.flow.montage', hasAddresses: false },
} as const

export type Path = keyof typeof services
export const paths = Object.keys(services) as Path[]

export const timeWindows = [
  { value: 'morning', label: 'Vormittag' },
  { value: 'midday', label: 'Mittag' },
  { value: 'afternoon', label: 'Nachmittag' },
  { value: 'flexible', label: 'Flexibel' },
] as const

export type TimeWindow = (typeof timeWindows)[number]['value']

/** Wunschtermin und (bei Entrümpelung und Montage) der Ort; bei Transport und Umzug stehen die Adressen im Konfigurator. */
export type Termin = { date: string | null; window: TimeWindow; place: string }

const initialTermin: Termin = { date: null, window: 'flexible', place: '' }
export const terminKey = (path: Path) => `movenow.termin.${path}`
export const attemptKey = (path: Path) => `movenow.attempt.${path}`
export const shownKey = (path: Path) => `movenow.shown.${path}`
const SENT_KEY = 'movenow.sent'
const MAX_HANDOVER_CHARS = 20_000

const DATE = /^\d{4}-\d{2}-\d{2}$/

function validTermin(raw: unknown): raw is Termin {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as Record<string, unknown>
  return (
    (r.date === null || (typeof r.date === 'string' && DATE.test(r.date))) &&
    timeWindows.some((w) => w.value === r.window) &&
    typeof r.place === 'string' &&
    r.place.length <= 200
  )
}

export function readTermin(path: Path): Termin {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(terminKey(path)) ?? 'null')
    if (validTermin(raw)) return raw
  } catch {
    // ohne Speicher beginnt der Termin leer
  }
  return initialTermin
}

export function useTermin(path: Path): [Termin, (patch: Partial<Termin>) => void] {
  const [termin, setTermin] = useState(() => readTermin(path))
  // Synchron schreiben: ein Updater läuft erst beim nächsten Render und ginge bei einer Navigation im selben Tipp verloren.
  const latest = useRef(termin)
  const update = useCallback(
    (patch: Partial<Termin>) => {
      const next = { ...latest.current, ...patch }
      latest.current = next
      try {
        sessionStorage.setItem(terminKey(path), JSON.stringify(next))
      } catch {
        // siehe oben
      }
      setTermin(next)
    },
    [path],
  )
  return [termin, update]
}

/** Heutiges Datum in Wien (`YYYY-MM-DD`), unabhängig von der Zeitzone des Geräts (der Server prüft gegen Wien). */
export const viennaToday = (now = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Vienna' }).format(now)

/** Alles, was zu einem Entwurf gehört. Fotos folgen mit S8b-3. */
export const draftKeys = (path: Path) => [services[path].flowKey, terminKey(path), attemptKey(path), shownKey(path)]

/** Gesamtpreis (Cent) der Vorschau, die der Kunde beim Weitergehen zuletzt gesehen hat; ohne Preis (Angebot) wird nichts vermerkt. */
export function rememberShown(path: Path, totalCents: number | null): void {
  try {
    if (totalCents === null) sessionStorage.removeItem(shownKey(path))
    else sessionStorage.setItem(shownKey(path), String(totalCents))
  } catch {
    // ohne Speicher gibt es keinen Vergleich
  }
}

export function readShown(path: Path): number | null {
  try {
    const cents = Number(sessionStorage.getItem(shownKey(path)))
    return Number.isSafeInteger(cents) && cents > 0 ? cents : null
  } catch {
    return null
  }
}

/** Ergebnis des Absendens für die Bestätigungsseite (nur Anzeige; der Preis stammt aus der Antwort von `quote`). */
export type Sent = {
  path: Path
  id: string
  status: 'requested' | 'inspection_requested'
  needsQuote: boolean
  snapshot: unknown
  /** Vorschaupreis, den der Kunde zuletzt gesehen hat (Cent), für den Hinweis bei Abweichung. */
  shownCents: number | null
  date: string | null
  route: string
}

export function finishDraft(path: Path, sent: Sent): void {
  try {
    for (const key of draftKeys(path)) sessionStorage.removeItem(key)
    sessionStorage.setItem(SENT_KEY, JSON.stringify(sent))
  } catch {
    // Speicher gesperrt: die Bestätigung fällt auf die Aufträge zurück
  }
}

/** Die Bestätigung des vorigen Kontos (mit Preis) soll im nächsten nicht erscheinen. */
export function clearSent(): void {
  try {
    sessionStorage.removeItem(SENT_KEY)
  } catch {
    // gesperrt
  }
}

export function readSent(): Sent | null {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(SENT_KEY) ?? 'null')
    if (raw && typeof raw === 'object' && 'path' in raw && typeof raw.path === 'string' && paths.includes(raw.path as Path) && 'id' in raw && typeof raw.id === 'string') {
      const shown = 'shownCents' in raw ? raw.shownCents : null
      return { ...(raw as Sent), shownCents: typeof shown === 'number' && Number.isSafeInteger(shown) && shown > 0 ? shown : null }
    }
  } catch {
    // keine Bestätigung vorhanden
  }
  return null
}

// Übergabe über die Anmeldung: Der Link der Mail öffnet oft in einem neuen Tab, dort fehlt der sessionStorage.
// Der Entwurf des gerade gesendeten Service liegt deshalb kurz im localStorage (gleiche Frist wie das Rücksprungziel).
const HANDOVER_KEY = 'movenow.handover'
const HANDOVER_TTL_MS = 15 * 60 * 1000

export function stashDraft(path: Path): void {
  try {
    const items: Record<string, string> = {}
    for (const key of draftKeys(path)) {
      const value = sessionStorage.getItem(key)
      if (value !== null) items[key] = value
    }
    localStorage.setItem(HANDOVER_KEY, JSON.stringify({ until: Date.now() + HANDOVER_TTL_MS, items }))
  } catch {
    // Speicher gesperrt: der Entwurf bleibt nur in diesem Tab
  }
}

/** Schreibt die Übergabe einmalig zurück (nur Schlüssel, die in diesem Tab fehlen) und löscht sie. Ungültiges oder Abgelaufenes wird verworfen. */
export function restoreDraft(): void {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(HANDOVER_KEY) ?? 'null')
    localStorage.removeItem(HANDOVER_KEY)
    if (!raw || typeof raw !== 'object' || !('until' in raw) || typeof raw.until !== 'number' || raw.until <= Date.now() || !('items' in raw) || !raw.items || typeof raw.items !== 'object') return
    if (JSON.stringify(raw.items).length > MAX_HANDOVER_CHARS) return
    const allowed = new Set(paths.flatMap(draftKeys))
    for (const [key, value] of Object.entries(raw.items)) {
      if (allowed.has(key) && typeof value === 'string' && sessionStorage.getItem(key) === null) sessionStorage.setItem(key, value)
    }
  } catch {
    // kaputter Eintrag: nichts zu übernehmen
  }
}

/** Beim App-Start: abgelaufene Übergaben löschen, damit keine Adressen unbegrenzt auf dem Gerät bleiben. */
export function purgeHandover(): void {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(HANDOVER_KEY) ?? 'null')
    if (raw === null || typeof raw !== 'object' || !('until' in raw) || typeof raw.until !== 'number' || raw.until <= Date.now()) localStorage.removeItem(HANDOVER_KEY)
  } catch {
    try {
      localStorage.removeItem(HANDOVER_KEY)
    } catch {
      // gesperrt
    }
  }
}

export const clearHandover = () => localStorage.removeItem(HANDOVER_KEY)
