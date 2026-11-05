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
export type Termin = { date: string | null; window: TimeWindow; place: string; point: { lat: number; lon: number } | null; consent: boolean }

const initialTermin: Termin = { date: null, window: 'flexible', place: '', point: null, consent: false }
export const terminKey = (path: Path) => `movenow.termin.${path}`
export const attemptKey = (path: Path) => `movenow.attempt.${path}`
export const shownFullKey = (path: Path) => `movenow.shownfull.${path}`
export const contactKey = (path: Path) => `movenow.contact.${path}`

export type ContactDraft = { name: string; phone: string; email: string; stairsDoor: string }

/** Kontaktfelder der Zusammenfassung; sie überleben die Anmeldung und verschwinden mit dem Entwurf. */
export function readContact(path: Path): ContactDraft {
  const empty = { name: '', phone: '', email: '', stairsDoor: '' }
  try {
    const raw = JSON.parse(sessionStorage.getItem(contactKey(path)) ?? 'null') as Record<string, unknown> | null
    if (raw && (['name', 'phone', 'email', 'stairsDoor'] as const).every((k) => typeof raw[k] === 'string')) return raw as ContactDraft
  } catch {
    // ohne Speicher beginnen die Felder leer
  }
  return empty
}

export function writeContact(path: Path, contact: ContactDraft): void {
  try {
    sessionStorage.setItem(contactKey(path), JSON.stringify(contact))
  } catch {
    // gesperrt
  }
}
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
    r.place.length <= 200 &&
    typeof r.consent === 'boolean' &&
    (r.point === null || (!!r.point && typeof r.point === 'object' && Number.isFinite((r.point as Record<string, unknown>).lat) && Number.isFinite((r.point as Record<string, unknown>).lon)))
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
export const draftKeys = (path: Path) => [services[path].flowKey, terminKey(path), attemptKey(path), shownFullKey(path), contactKey(path)]

/** Was der Kunde in der Vorschau sah (wie `shown` in `quote`): Festpreis total = low = high, Spanne total null, Angebot mit Gründen. */
export type Shown = { kind: 'price'; totalCents: number | null; lowCents: number; highCents: number } | { kind: 'offer'; reasons: string[] }

/** Vorschau, die der Kunde beim Weitergehen zuletzt gesehen hat, vollständig (für `quote` und für den Vergleich auf der Bestätigung). */
export function rememberShown(path: Path, shown: Shown): void {
  try {
    sessionStorage.setItem(shownFullKey(path), JSON.stringify(shown))
  } catch {
    // ohne Speicher gibt es keinen Vergleich
  }
}

/** Strenge Prüfung eines gemerkten `Shown`: ganze Cent ≥ 0, Angebot mit mindestens einem Grund; nur bekannte Felder. */
function parseShown(raw: unknown): Shown | null {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  const whole = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
  if (r?.kind === 'offer' && Array.isArray(r.reasons) && r.reasons.length > 0 && r.reasons.every((x) => typeof x === 'string')) return { kind: 'offer', reasons: r.reasons as string[] }
  if (r?.kind === 'price' && whole(r.lowCents) && whole(r.highCents) && (r.totalCents === null || whole(r.totalCents))) return { kind: 'price', totalCents: r.totalCents as number | null, lowCents: r.lowCents, highCents: r.highCents }
  return null
}

export function readShownFull(path: Path): Shown | null {
  try {
    return parseShown(JSON.parse(sessionStorage.getItem(shownFullKey(path)) ?? 'null'))
  } catch {
    // keine Vorschau vermerkt
  }
  return null
}

/** Ergebnis des Absendens für die Bestätigungsseite (nur Anzeige; der Preis stammt aus der Antwort von `quote`). */
export type Sent = {
  path: Path
  id: string
  status: 'requested' | 'awaiting_offer'
  needsQuote: boolean
  snapshot: unknown
  /** Vorschau, die der Kunde zuletzt gesehen hat (vollständig, auch Spanne), für den Hinweis bei Abweichung. */
  shown: Shown | null
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
      return { ...(raw as Sent), shown: parseShown('shown' in raw ? raw.shown : null) }
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
    localStorage.setItem(HANDOVER_KEY, JSON.stringify({ until: Date.now() + HANDOVER_TTL_MS, path, items }))
  } catch {
    // Speicher gesperrt: der Entwurf bleibt nur in diesem Tab
  }
}

/**
 * Schreibt die Übergabe einmalig zurück (nur Schlüssel, die in diesem Tab fehlen) und löscht sie. Ungültiges oder Abgelaufenes wird verworfen.
 * Nur die Entwurfsschlüssel des Service, der die Übergabe angelegt hat (OPEN_ISSUES S8b-2 F5); eine Übergabe ohne gültigen `path` gilt nicht.
 */
export function restoreDraft(): void {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(HANDOVER_KEY) ?? 'null')
    localStorage.removeItem(HANDOVER_KEY)
    if (!raw || typeof raw !== 'object' || !('until' in raw) || typeof raw.until !== 'number' || raw.until <= Date.now() || !('items' in raw) || !raw.items || typeof raw.items !== 'object') return
    if (!('path' in raw) || typeof raw.path !== 'string' || !paths.includes(raw.path as Path)) return
    if (JSON.stringify(raw.items).length > MAX_HANDOVER_CHARS) return
    const allowed = new Set(draftKeys(raw.path as Path))
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
