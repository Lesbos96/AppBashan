export interface Offene {
  version: string
  pfad: string
  sha256: string
}
export interface Freigabe {
  modell: string
  dateien: { sha: string; pfad: string }[]
  geloescht?: string[]
  urteil: string
  hoch: number
}
export function offeneMigrationen(liste: unknown, dir: string): Offene[]
export function parseFreigabe(text: string): Freigabe
export function startMarke(offen: Offene[], start?: string): { ziel: 'db-push-start'; start: string; migrationen: Offene[] }
export function unmarkierteStarts(zeilen: { ziel?: string; start?: string; migrationen?: { pfad: string; sha256: string; version?: string }[] }[]): (Offene & { start?: string })[]
export function nachtragMarken(
  vorher: (Offene & { start?: string })[],
  liste: unknown,
  shaJetzt: (pfad: string) => string,
): { marken: { pfad: string; sha256: string; start?: string }[]; gruende: string[]; offen: Offene[] }
export function marken(
  vorher: Offene[],
  nachher: { version: string }[],
  shaJetzt: (pfad: string) => string,
): { marken: { pfad: string; sha256: string }[]; gruende: string[] }
export function pruefePush(offen: { pfad: string; sha256: string }[], freigaben: Freigabe[]): { ok: boolean; gruende: string[] }
