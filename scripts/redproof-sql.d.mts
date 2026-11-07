// Lose Typen für die Unit-Tests.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Select = (q: string) => any[]
type Text = { loosen: string; restore: string }
export function patchFns(select: Select, edits: [string, string, string][]): Text
export function patchFn(select: Select, fn: string, from: string, to: string): Text
export function triggerOff(table: string, name: string): Text
export function toggle(loosen: string, restore: string): Text
export function policyLoosen(select: Select, name: string, table: string, clause: string, looseExpr: string): Text
export function combine(...parts: Text[]): Text
export function constraintDrop(select: Select, table: string, name: string, purge?: string | ((expr: string) => string)): Text
export function createObject(loosen: string, restore: string): Text
