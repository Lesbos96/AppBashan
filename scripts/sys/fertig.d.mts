import type { Freigabe } from './gate-db-lib.mjs'

export interface Lauf {
  nr: number
  ziel: string
  args?: string[]
  /** Testschalter (MV_*, E2E_*) als NAME=Wert; fehlt das Feld, zählt der Lauf nicht (sys1-3). */
  schalter?: string[]
  befehl: string
  exit: number
  sauber: boolean
  stabil?: boolean
  start?: string
  hash?: string
  schritt?: string
  /** SHA-256 der rls-Testdatei beim Start des Laufs (nur Läufe einer Datei unter tests/rls; fehlt oder leer = zählt nicht). */
  dateiSha?: string
  abdruck: string | null
  logOk: boolean
}
export interface GruenEintrag {
  abdruck: string
  hash?: string
  schritt?: string
  zeit?: string
}
export interface FertigKontext {
  /** Name des Schritts; nur Läufe dieses Schritts zählen beim Rot-Beweis. */
  schritt?: string
  stufe: 'R0' | 'R1' | 'R2' | 'R3'
  sauber: boolean
  ffMoeglich?: boolean
  hooksAktiv?: boolean
  runs: Lauf[]
  dbPushes?: { start: string; migrationen: { pfad: string; sha256: string }[] }[]
  loeschGeaendert?: { pfad: string; sha256: string }[]
  loeschFreigaben?: Freigabe[]
  freigabenGeaendert?: string[]
  abdruck: Record<string, string>
  jetzt?: number
  gruen?: Record<string, GruenEintrag>
  gruenHead?: Record<string, GruenEintrag>
  geloeschtMuss?: string[]
  berichtKopienFehlen?: string[]
  neueMigrationen: { pfad: string; sha256: string }[]
  freigaben: Freigabe[]
  abnahme: Freigabe | null
  abnahmeRunden?: string[]
  abnahmeRunde?: number | null
  abnahmeName?: string | null
  abnahmeVeraltet?: string[]
  abnahmeFehlt?: string[]
  /** Neu angelegte rls-Testdateien (eine Umbenennung ist eine neue Datei) mit dem SHA-256 der Datei im Endstand. */
  neueRlsTests: { pfad: string; sha256: string }[]
  berichtStand: string | null
  berichtGate?: string | null
  standZeilen: number | null
  schrittPruefen: boolean
  ohneBericht?: boolean
}
export const MUSS_ABNAHME: RegExp
export function gueltigerLauf(c: FertigKontext, suite: string): Lauf | null
export function pruefeFertig(c: FertigKontext): string[]
export function kopfPasst(text: string, r: { hash?: string; sauber: boolean; befehl: string; args?: string[]; schalter?: string[] }): boolean
export function neueRlsDateien(bereich: string, wurzel?: string): string[]
export function gateMeldung(stufe: string, fingerabdruckSha: string): string
export function mergeMeldung(commit: string): string
export function stageNachweise(pfade: string[], wurzel?: string): void
