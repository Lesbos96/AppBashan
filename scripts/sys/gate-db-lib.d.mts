export interface Offene {
  version: string
  pfad: string
  sha256: string
}
export interface Freigabe {
  modell: string
  dateien: { sha: string; pfad: string }[]
  urteil: string
  hoch: number
}
export function offeneMigrationen(liste: unknown, dir: string): Offene[]
export function parseFreigabe(text: string): Freigabe
export function pruefePush(offen: { pfad: string; sha256: string }[], freigaben: Freigabe[]): { ok: boolean; gruende: string[] }
