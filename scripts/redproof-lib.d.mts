// Lose Typen für die Unit-Tests (die Skripte selbst sind reines JavaScript ohne Typprüfung).
/* eslint-disable @typescript-eslint/no-explicit-any */
export const EXIT: { OK: 0; FAIL: 1; PRE: 2; FATAL: 3; SIGNAL: 130 }
export const DEADMAN_MIN: number
export const VITEST_TIMEOUT_MS: number
export const CLEANUP_JOB: string
export const CLEANUP_WAIT_S: number
export const DEADMAN_PREFIX: string
export const RESTORE_CMD: string
export const SNAPSHOT_SQL: string
export class PreError extends Error {}
export class FatalError extends Error {}
export class StepError extends Error {}
export function restoreKinds(sql: string): string[]
export function isSelect(q: string): boolean
export function isProbeSql(q: string): boolean
export function diffSoll(soll: any[], ist: any[], ignore?: string[]): any[]
export function fmtDiff(d: any[]): string
export function judgeVitest(a: any): any
export function refuseReasons(rows: any[]): string[]
export function createRun(deps: any, opts: any): any
export function runMain(run: any, main: any, deps: any): Promise<number>
export function realDeps(opts?: any): any
