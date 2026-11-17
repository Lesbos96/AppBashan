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
  it('im Fenster genau eine Anweisung: das Journal der Testanfragen löschen', () => {
    const fenster = text.slice(text.indexOf('session_replication_role = replica'), text.indexOf('session_replication_role = origin'))
    expect([...fenster.matchAll(/^\s*(delete from|update|insert into|truncate) (public\.\w+)/gm)].map((m) => `${m[1]} ${m[2]}`)).toEqual(['delete from public.commission_entries'])
    expect(fenster).toMatch(/request_id in \(select id from tr\)/)
  })
  it('Live-Konten nur mit Zusatz up, kein breiteres Muster', () => {
    expect(text).toMatch(/like 'live-up-%@movenow\.test'/)
    expect(text).not.toMatch(/like 'live-%/)
  })
  it('alle Abbruchbedingungen stehen vor dem Fenster', () => {
    const fenster = text.indexOf('session_replication_role = replica')
    for (const b of ['Abdeckungsfirma vorhanden', 'Journalzeile einer Nicht-Testfirma', 'Gegenbuchung außerhalb', "interval '15 minutes'", "'request-photos', 'job-photos', 'partner-documents'", 'nicht die Rolle customer', 'Mitglied einer Nicht-Testfirma', 'mehr als 1000', 'Zahlen weichen von der Probe ab']) {
      expect(text.indexOf(b), b).toBeGreaterThan(-1)
      expect(text.indexOf(b), b).toBeLessThan(fenster)
    }
  })
  it('eine Transaktion, ein Aufruf; nur das Schlusswort hängt vom Modus ab', () => {
    expect(text.match(/ownerSql\(sql\)/g)).toHaveLength(1)
    expect(text.match(/`begin;/g)).toHaveLength(1)
    expect(text.match(/\$\{loeschen \?/g)).toEqual(['${loeschen ?'])
    expect(text).toMatch(/\$\{loeschen \? 'commit' : 'rollback'\};`/)
  })
  it('Sicherung in beiden Modi vor der Transaktion, Löschen bricht bei Abweichung ab', () => {
    const sicherung = text.indexOf('writeFileSync(')
    expect(sicherung).toBeGreaterThan(-1)
    expect(sicherung).toBeLessThan(text.indexOf('ownerSql(sql)'))
    expect(text).toMatch(/Sicherung weicht von den Zahlen der Probe ab/)
  })
  it('Start nur über das Gate, Sperre mit pid und kind, Kontrolle der Trigger auch bei Fehler, genau zehn Zahlen', () => {
    expect(text).toMatch(/if \(!process\.env\.MV_LOESCH_LAUF\)/)
    expect(text).toMatch(/\[sperre\.pid, sperre\.kind\]/)
    expect(text.indexOf("tgname = 'append_only' and tgenabled = 'O'")).toBeLessThan(text.indexOf('if (fehler)'))
    expect(text).toMatch(/rows\.length !== 10/)
  })
})
