import type { Freigabe } from './gate-db-lib.mjs'

export function leseAbnahme(root: string, schritt: string): { abnahme: Freigabe | null; runde: number | null; name: string | null; gruende: string[] }
