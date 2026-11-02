// Haltefenster und Preisabgleich (S9a-3), rein und mit injizierter Zeit: der Kunde zahlt nur, was er sah.
import type { Snapshot } from './snapshot.ts'

/** Zustand einer Preisversion aus `price_version_hold`; `null`: unbekannt oder unveröffentlicht. */
export type VersionHold = { started: boolean; isCurrent: boolean; replacedAt: string | null; holdMinutes: number | null }

/** Was der Kunde sah: Festpreis/Spanne (`total` nur beim Festpreis) oder ein Angebot ohne Preis (Gründe). */
export type Shown = { kind: 'price'; totalCents: number | null; lowCents: number; highCents: number } | { kind: 'offer'; reasons: string[] }

/**
 * Darf der Server mit dieser Version rechnen? Aktuelle Version immer; eine ersetzte nur, wenn sie schon galt und der Nachfolger
 * höchstens `holdMinutes` gilt. Künftige oder nie gültige Versionen nie. Fehlt `holdMinutes` bei einer ersetzten Version: Fehler (setting_missing).
 */
export function holdAllows(hold: VersionHold | null, nowMs: number): boolean {
  if (!hold || !hold.started) return false
  if (hold.isCurrent) return true
  if (hold.replacedAt === null) return false
  if (hold.holdMinutes === null) throw new Error('setting_missing')
  return nowMs < Date.parse(hold.replacedAt) + hold.holdMinutes * 60_000
}

/** Gleichheit ohne Toleranz: Art, Gesamtbetrag (Festpreis), Spanne bzw. Gründe (Angebot). */
export function matchesShown(snapshot: Snapshot, shown: Shown): boolean {
  if (snapshot['kind'] === 'offer') {
    const reasons = snapshot['reasons']
    return shown.kind === 'offer' && Array.isArray(reasons) && reasons.length === shown.reasons.length && reasons.every((r, i) => r === shown.reasons[i])
  }
  return (
    shown.kind === 'price' &&
    snapshot['kind'] === 'price' &&
    (snapshot['totalCents'] ?? null) === shown.totalCents &&
    snapshot['lowCents'] === shown.lowCents &&
    snapshot['highCents'] === shown.highCents
  )
}
