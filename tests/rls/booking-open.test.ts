// s9i-1: Buchungsschalter `booking_open` (Migration 0056). Der Zustand „zu“ wird nie committet (parallele Tests bekämen 503),
// sondern als Eigentümer-SQL in begin … rollback geprüft (tests/support/owner.ts).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { anon, deleteUsers, makeUser, type TestUser } from '../support/db.ts'
import { ownerError, ownerSql } from '../support/owner.ts'

let cust: TestUser
const today = `(now() at time zone 'Europe/Vienna')::date`
const ins = (version: number, value: number, from: string) =>
  `insert into public.platform_settings (key, version, value, effective_from) values ('booking_open', ${version}, ${value}, ${from});`
const probe = (setup: string) =>
  ownerSql(`begin; delete from public.platform_settings where key = 'booking_open'; ${setup} select public.booking_open() as open; rollback;`)[0]?.open

beforeAll(async () => {
  cust = await makeUser('buchung-kunde')
})
afterAll(deleteUsers)

describe('booking_open()', () => {
  it('liefert anon und Kunden nur true/false (Dev: offen über den Seed)', async () => {
    const a = await anon.rpc('booking_open')
    expect(a.error).toBeNull()
    expect(a.data).toBe(true)
    const c = await cust.db.rpc('booking_open')
    expect(c.error).toBeNull()
    expect(c.data).toBe(true)
  })

  it('Kunden lesen die Zeile selbst nicht und schreiben nichts', async () => {
    const r = await cust.db.from('platform_settings').select('key').eq('key', 'booking_open')
    expect(r.data ?? []).toEqual([])
    const w = await cust.db.from('platform_settings').insert({ key: 'booking_open', version: 99, value: 1, effective_from: '2026-11-10' })
    expect(w.error?.code).toBe('42501')
  })

  it('keine Zeile → zu (fail closed)', () => expect(probe('')).toBe(false))
  it('1 ab heute → offen', () => expect(probe(ins(1, 1, today))).toBe(true))
  it('1 mit künftigem Datum → noch zu', () => expect(probe(ins(1, 1, `${today} + 5`))).toBe(false))
  it('0 ab heute → zu', () => expect(probe(ins(1, 0, today))).toBe(false))
  it('künftige 1, danach 0 ab heute → zu (höchste Version entscheidet)', () => expect(probe(ins(1, 1, `${today} + 5`) + ins(2, 0, today))).toBe(false))
  it('1 ab heute, danach 0 → zu; danach wieder 1 → offen', () => {
    expect(probe(ins(1, 1, today) + ins(2, 0, today))).toBe(false)
    expect(probe(ins(1, 1, today) + ins(2, 0, today) + ins(3, 1, today))).toBe(true)
  })
  it('1 ab heute, danach 0 mit künftigem Datum → sofort zu; danach 1 mit künftigem Datum → zu bis dahin', () => {
    expect(probe(ins(1, 1, today) + ins(2, 0, `${today} + 5`))).toBe(false)
    expect(probe(ins(1, 1, today) + ins(2, 1, `${today} + 5`))).toBe(false)
  })
  it('Wert außerhalb 0/1 scheitert am Check', () => {
    expect(ownerError(`begin; delete from public.platform_settings where key = 'booking_open'; ${ins(1, 2, today)} rollback;`)).toMatch(/platform_settings_booking/)
  })
})
