import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { leseRegister } from '../../scripts/sys/gate-loesch-lib.mjs'

// scripts/dev-testdaten-zuruecksetzen.mjs (dev1): löscht Testdaten samt Journal auf Dev. Der Test hält die Auflagen der Freigabe fest.
const P = 'scripts/dev-testdaten-zuruecksetzen.mjs'
const text = readFileSync(P, 'utf8')

describe('Dev-Reset der Testdaten: Auflagen', () => {
  it('steht im Register und bindet die Marker', () => {
    expect(leseRegister().skripte[P]).toEqual(['tests/support/marker.ts'])
  })
  it('Dev-Guard ist der erste Import, die Marker kommen aus marker.ts', () => {
    expect(text.indexOf("import './dev-guard.mjs'")).toBeGreaterThan(-1)
    expect(text.indexOf("import './dev-guard.mjs'")).toBeLessThan(text.indexOf('import {'))
    expect(text).toMatch(/import \{ COVER_FIRM, FIRM_MAIL_RE \} from '\.\.\/tests\/support\/marker\.ts'/)
  })
  it('keine Triggeränderung, kein Schema, keine Ausnahmebehandlung', () => {
    expect(text).not.toMatch(/alter\s+table|disable\s+trigger|drop\s+trigger|truncate|exception\s+when/i)
  })
  it('genau ein Replica-Fenster, danach sofort origin und eine Prüfung', () => {
    expect(text.match(/session_replication_role = replica/g)).toHaveLength(1)
    const ab = text.slice(text.indexOf('session_replication_role = replica'))
    expect(ab.indexOf('session_replication_role = origin')).toBeLessThan(ab.indexOf('delete from auth.users'))
    expect(ab).toMatch(/current_setting\('session_replication_role'\) <> 'origin'/)
  })
  it('im Fenster nur commission_entries löschen und copied_from_revision_id der Testanfragen leeren', () => {
    const fenster = text.slice(text.indexOf('session_replication_role = replica'), text.indexOf('session_replication_role = origin'))
    expect([...fenster.matchAll(/^\s*(delete from|update) (public\.\w+)/gm)].map((m) => `${m[1]} ${m[2]}`)).toEqual([
      'delete from public.commission_entries',
      'update public.price_revisions',
    ])
  })
  it('Probe endet mit rollback, Löschen mit commit; Löschen verlangt die Zahlen der Probe', () => {
    expect(text).toMatch(/rollback/)
    expect(text).toMatch(/commit/)
    expect(text).toMatch(/Zahlen weichen von der Probe ab/)
  })
})
