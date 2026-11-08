// Outbox (S9c-11 K1, K2, K4; Migration 0036). Rollback-Proben: Claim und Mark (disjunkte Mengen, Lease, fünfter Versuch), Aufräumen im Cron,
// feste Fehlercodes. Alle bestehenden offenen Zeilen werden im Setup auf `sent` gesetzt, damit Reste anderer Läufe nichts verfälschen (Rollback).
import { describe, expect, it } from 'vitest'
import { probes, type Step } from '../support/owner.ts'

const ISOLATE = `update public.outbox set status = 'sent' where status in ('pending', 'sending');`
// Die ID jeder Zeile steht danach in app.o36_<key>: service_role darf `outbox` nicht lesen, die Schritte rufen nur Funktionen.
const row = (key: string, status = 'pending', attempts = 0, claimedAgo?: string) =>
  `insert into public.outbox (kind, recipient_kind, recipient_id, dedupe_key, status, attempts, claimed_at)
     values ('listing_new', 'partner', gen_random_uuid(), 'o36:${key}', '${status}', ${attempts}, ${claimedAgo ? `now() - interval '${claimedAgo}'` : 'null'});
   select set_config('app.o36_${key}', (select id::text from public.outbox where dedupe_key = 'o36:${key}'), true);`
const one = (key: string, cols: string) => `(select ${cols} from public.outbox where dedupe_key = 'o36:${key}')`
const st = (key: string) => `=${one(key, "status || ':' || attempts || ':' || coalesce(last_error, '')")}`
const id = (key: string) => `current_setting('app.o36_${key}')::bigint`
const svc = (name: string, sql: string): Step => ({ name, as: 'service_role', sql })
const rows = (v: string | undefined, n: number) => expect(v, String(v)).toBe(`= ${n}`)
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)

describe('outbox_claim und outbox_mark', () => {
  it('Claims sind disjunkt, die Lease dauert 10 Minuten, der fünfte Versuch endet in failed, ok setzt sent', () => {
    const steps: Step[] = [
      svc('claim 2', `=(select count(*) from public.outbox_claim(2))`),
      svc('claim 5 (Rest)', `=(select count(*) from public.outbox_claim(5))`),
      svc('claim leer', `=(select count(*) from public.outbox_claim(5))`),
      { name: 'a', sql: st('a') },
      { name: 'Lease 11 Minuten alt', sql: `update public.outbox set claimed_at = now() - interval '11 minutes' where dedupe_key = 'o36:a'` },
      { name: 'Lease 9 Minuten alt', sql: `update public.outbox set claimed_at = now() - interval '9 minutes' where dedupe_key = 'o36:b'` },
      svc('nur die abgelaufene', `=(select count(*) from public.outbox_claim(5))`),
      { name: 'a erneut', sql: st('a') },
      { name: 'b blieb', sql: st('b') },
      { name: 'd nach Claim', sql: st('d') },
      svc('mark fehlgeschlagen', `perform public.outbox_mark(${id('d')}, false, 'smtp_temp')`),
      { name: 'd final', sql: st('d') },
      svc('mark ok', `perform public.outbox_mark(${id('c')}, true, null)`),
      { name: 'c final', sql: st('c') },
      { name: 'mark ok setzt sent_at', sql: `=(select sent_at is not null from public.outbox where dedupe_key = 'o36:c')` },
    ]
    const r = probes(`${ISOLATE} ${row('a')} ${row('b')} ${row('c')} ${row('d', 'pending', 4)}`, steps)
    // a, b, c, d sind pending; die ersten beiden Claims holen a und b, dann c und d (Reihenfolge nach id)
    expect(r['claim 2']).toBe('= 2')
    expect(r['claim 5 (Rest)']).toBe('= 2')
    rows(r['claim leer'], 0)
    expect(r['a']).toBe('= sending:1:')
    rows(r['nur die abgelaufene'], 1)
    expect(r['a erneut']).toBe('= sending:2:')
    expect(r['b blieb']).toBe('= sending:1:')
    expect(r['d nach Claim']).toBe('= sending:5:') // attempts 4 → 5 im zweiten Claim
    expect(r['mark fehlgeschlagen']).toBe('ok')
    expect(r['d final']).toBe('= failed:5:smtp_temp')
    expect(r['c final']).toBe('= sent:1:')
    expect(r['mark ok setzt sent_at']).toBe('= true')
  })

  it('K1: eine Zeile mit fünf Versuchen und abgelaufener Lease wird vom Cron auf failed gesetzt, auch wenn sonst nichts zu senden ist', () => {
    const r = probes(`${ISOLATE} ${row('e', 'sending', 5, '11 minutes')} ${row('f', 'sending', 5, '5 minutes')}`, [
      { name: 'dispatch', sql: `perform public.outbox_dispatch()` },
      { name: 'e', sql: st('e') },
      { name: 'f (Lease läuft noch)', sql: st('f') },
    ])
    expect(r['dispatch']).toBe('ok')
    expect(r['e']).toBe('= failed:5:lease_expired')
    expect(r['f (Lease läuft noch)']).toBe('= sending:5:')
  })

  it('K4: feste Fehlercodes (CHECK), unbekannter Text wird zu smtp_error, mark wirkt nur auf sending', () => {
    const steps: Step[] = [
      { name: 'Freitext per UPDATE', sql: `update public.outbox set last_error = 'Zustellung an max@example.com fehlgeschlagen' where dedupe_key = 'o36:p'` },
      { name: 'fester Code per UPDATE', sql: `update public.outbox set last_error = 'no_recipient' where dedupe_key = 'o36:p'` },
      svc('Freitext über mark', `perform public.outbox_mark(${id('s')}, false, 'Zustellung an max@example.com fehlgeschlagen')`),
      { name: 's', sql: st('s') },
      svc('bekannter Code über mark', `perform public.outbox_mark(${id('t')}, false, 'unknown_kind')`),
      { name: 't', sql: st('t') },
      svc('mark auf pending', `perform public.outbox_mark(${id('p')}, true, null)`),
      { name: 'p unverändert', sql: `=${one('p', 'status')}` },
      svc('mark auf sent', `perform public.outbox_mark(${id('x')}, false, 'smtp_error')`),
      { name: 'x unverändert', sql: st('x') },
      { name: 'claim als Konto', as: 'authenticated', claims: { sub: crypto.randomUUID(), aal: 'aal2' }, sql: `perform public.outbox_claim(1)` },
      { name: 'mark als anon', as: 'anon', sql: `perform public.outbox_mark(1, true, null)` },
    ]
    const r = probes(`${ISOLATE} ${row('p')} ${row('s', 'sending', 1, '1 minute')} ${row('t', 'sending', 1, '1 minute')} ${row('x', 'sent', 1)}`, steps)
    err(r['Freitext per UPDATE'], '23514')
    expect(r['fester Code per UPDATE']).toBe('ok')
    expect(r['Freitext über mark']).toBe('ok')
    expect(r['s']).toBe('= pending:1:smtp_error')
    expect(r['t']).toBe('= pending:1:unknown_kind')
    expect(r['mark auf pending']).toBe('ok')
    expect(r['p unverändert']).toBe('= pending')
    expect(r['mark auf sent']).toBe('ok')
    expect(r['x unverändert']).toBe('= sent:1:')
    err(r['claim als Konto'], '42501')
    err(r['mark als anon'], '42501')
  })
})
