import type { Freigabe } from './gate-db-lib.mjs'

export interface LoeschRegister {
  skripte: Record<string, string[]>
  ausgenommen: Record<string, { grund: string; sha256: string }>
}
export const REGISTER: string
export const FREIGABEN: string
export const LOESCH_MUSTER: RegExp
export function leseRegister(pfad?: string): LoeschRegister
export function freigabenAusDir(dir?: string): Freigabe[]
export function freigabenAusGit(rev?: string, dir?: string): Freigabe[]
export function pruefeLoesch(pfade: string[], freigaben: Freigabe[], wurzel?: string): { ok: boolean; gruende: string[] }
export function loeschFreigabe(url: string, opt?: { register?: string; freigaben?: () => Freigabe[] }): void
export function loeschLog(pfad: string, zahlen: Record<string, number>, extra?: Record<string, unknown>): void
export function scanne(wurzel?: string): string[]
