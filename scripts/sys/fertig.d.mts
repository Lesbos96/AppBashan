import type { Freigabe } from './gate-db-lib.mjs'

export interface Lauf {
  nr: number
  ziel: string
  args?: string[]
  befehl: string
  exit: number
  sauber: boolean
  stabil?: boolean
  start?: string
  abdruck: string | null
  logOk: boolean
}
export interface FertigKontext {
  stufe: 'R0' | 'R1' | 'R2' | 'R3'
  sauber: boolean
  ffMoeglich?: boolean
  hooksAktiv?: boolean
  runs: Lauf[]
  dbPushes?: string[]
  abdruck: Record<string, string>
  gruen?: Record<string, { abdruck: string }>
  neueMigrationen: { pfad: string; sha256: string }[]
  freigaben: Freigabe[]
  abnahme: Freigabe | null
  abnahmeVeraltet?: string[]
  neueRlsTests: string[]
  berichtStand: string | null
  standZeilen: number | null
  schrittPruefen: boolean
}
export function gueltigerLauf(c: FertigKontext, suite: string): Lauf | null
export function pruefeFertig(c: FertigKontext): string[]
