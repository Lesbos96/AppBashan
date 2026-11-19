// Outbox (S9c-11 K1, K2, K4; Migration 0036). Rollback-Proben: Claim und Mark (disjunkte Mengen, Lease, fünfter Versuch), Aufräumen im Cron,
// feste Fehlercodes. Alle bestehenden offenen Zeilen werden im Setup auf `sent` gesetzt, damit Reste anderer Läufe nichts verfälschen (Rollback).
import { describe, expect, it } from 'vitest'
import { ownerSql, probes, type Step } from '../support/owner.ts'

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

  it('mail1: eine fehlgeschlagene Zeile wird erst nach 15 Min. × 4^(Versuche − 1) erneut geholt; ein Fehlversuch behält claimed_at, Erfolg und Ende löschen es', () => {
    const claimed = (key: string) => `=(select claimed_at is not null from public.outbox where dedupe_key = 'o36:${key}')`
    const steps: Step[] = [
      svc('claim', `=(select count(*) from public.outbox_claim(50))`),
      ...['g', 'h', 'i', 'j', 'k', 'l'].map((k): Step => ({ name: k, sql: st(k) })),
      { name: 'neu 1 Min.', sql: `=${one('n', "status || ':' || attempts")}` },
      svc('mark Fehlversuch', `perform public.outbox_mark(${id('m')}, false, 'smtp_temp')`),
      { name: 'm behält claimed_at', sql: claimed('m') },
      svc('mark ok', `perform public.outbox_mark(${id('q')}, true, null)`),
      { name: 'q ohne claimed_at', sql: claimed('q') },
      svc('mark fünfter Fehlversuch', `perform public.outbox_mark(${id('r')}, false, 'smtp_temp')`),
      { name: 'r failed', sql: st('r') },
      { name: 'r ohne claimed_at', sql: claimed('r') },
    ]
    const setup = `${ISOLATE} ${row('g', 'pending', 1, '14 minutes')} ${row('h', 'pending', 1, '16 minutes')} ${row('i', 'pending', 2, '59 minutes')} ${row('j', 'pending', 2, '61 minutes')}
      ${row('k', 'pending', 4, '15 hours')} ${row('l', 'pending', 4, '17 hours')} ${row('n')} ${row('m', 'sending', 1, '1 minute')} ${row('q', 'sending', 1, '1 minute')} ${row('r', 'sending', 5, '1 minute')}`
    const r = probes(setup, steps)
    rows(r['claim'], 4) // h, j, l und die neue Zeile n; g, i, k warten noch
    expect([r['g'], r['i'], r['k']]).toEqual(['= pending:1:', '= pending:2:', '= pending:4:'])
    expect([r['h'], r['j'], r['l']]).toEqual(['= sending:2:', '= sending:3:', '= sending:5:'])
    expect(r['neu 1 Min.']).toBe('= sending:1')
    expect(r['m behält claimed_at']).toBe('= true')
    expect(r['q ohne claimed_at']).toBe('= false')
    expect(r['r failed']).toBe('= failed:5:smtp_temp')
    expect(r['r ohne claimed_at']).toBe('= false')
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

  it('outbox_dispatch ist nur für den Eigentümer (Cron): service_role bekommt permission denied for function', () => {
    const r = probes('', [svc('dispatch als service_role', 'perform public.outbox_dispatch()')])
    err(r['dispatch als service_role'], 'permission denied for function outbox_dispatch')
  })

  it('Cron-Weg: der Job läuft als Eigentümer der Funktion und war zuletzt erfolgreich (nur lesen)', () => {
    const [j] = ownerSql(`select (j.username = pg_get_userbyid(p.proowner))::text as als_eigentuemer,
      (select d.status || ':' || (d.start_time > now() - interval '5 minutes') from cron.job_run_details d where d.jobid = j.jobid and d.status in ('succeeded', 'failed') order by d.start_time desc limit 1) as letzter_lauf
      from cron.job j, pg_proc p where j.jobname = 'outbox-dispatch' and p.oid = 'public.outbox_dispatch()'::regprocedure`)
    expect(j?.als_eigentuemer).toBe('true')
    expect(j?.letzter_lauf).toBe('succeeded:true') // der jüngste beendete Lauf, höchstens 5 Minuten alt
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

  it('mail2: no_recipient macht die Zeile sofort endgültig (ohne claimed_at); smtp_account gibt sie ohne Versuch zurück, auch beim fünften; ein Erfolg löscht den Code', () => {
    const claimed = (key: string) => `=(select claimed_at is not null from public.outbox where dedupe_key = 'o36:${key}')`
    const mark = (key: string, ok: boolean, code: string | null) => svc(`mark ${key}`, `perform public.outbox_mark(${id(key)}, ${ok}, ${code ? `'${code}'` : 'null'})`)
    const steps: Step[] = [
      mark('nr', false, 'no_recipient'),
      mark('a1', false, 'smtp_account'),
      mark('a3', false, 'smtp_account'),
      mark('a5', false, 'smtp_account'),
      mark('a0', false, 'smtp_account'),
      mark('okr', true, null),
      mark('ok5', true, 'smtp_account'),
      ...['nr', 'a1', 'a3', 'a5', 'a0', 'okr', 'ok5'].map((k): Step => ({ name: k, sql: st(k) })),
      { name: 'nr claimed_at', sql: claimed('nr') },
      { name: 'a1 claimed_at', sql: claimed('a1') },
    ]
    const setup = `${ISOLATE} ${['nr', 'a1', 'okr'].map((k) => row(k, 'sending', 1, '1 minute')).join(' ')} ${row('a3', 'sending', 3, '1 minute')} ${row('a5', 'sending', 5, '1 minute')} ${row('a0', 'sending', 0, '1 minute')} ${row('ok5', 'sending', 5, '1 minute')}
      update public.outbox set last_error = 'smtp_account' where dedupe_key = 'o36:okr';`
    const r = probes(setup, steps)
    expect(['nr', 'a1', 'a3', 'a5', 'a0', 'okr', 'ok5'].map((k) => r[k])).toEqual([
      '= failed:1:no_recipient', // sofort endgültig, kein weiterer Versuch nötig
      '= pending:0:smtp_account', // der Versuch zählt nicht
      '= pending:2:smtp_account',
      '= pending:4:smtp_account', // auch beim fünften Versuch nicht failed
      '= pending:0:smtp_account', // nie unter null
      '= sent:1:', // Erfolg löscht den Code
      '= sent:5:', // ok gewinnt vor dem Code
    ])
    expect(r['nr claimed_at']).toBe('= false')
    expect(r['a1 claimed_at']).toBe('= true')
  })

  it('mail2: nach smtp_account gilt der Abstand 15 Min. × 4^(Versuche − 1) mit den verbleibenden Versuchen (0 und 1: 15 Min., 2: 60 Min., 4: 16 Std.); die Lease und das Limit von fünf Versuchen bleiben', () => {
    const due = (key: string) => `=(select private.outbox_is_due(o) from public.outbox o where o.dedupe_key = 'o36:${key}')`
    const age = (key: string, ago: string) => ({ name: `${key} ${ago}`, sql: `update public.outbox set claimed_at = now() - interval '${ago}' where dedupe_key = 'o36:${key}'` })
    const cases: [string, string, boolean][] = [
      ['d0', '14 minutes', false], ['d0', '16 minutes', true], ['d1', '14 minutes', false], ['d1', '16 minutes', true],
      ['d2', '59 minutes', false], ['d2', '61 minutes', true], ['d4', '15 hours', false], ['d4', '17 hours', true],
    ]
    const steps: Step[] = [
      ...['d0', 'd1', 'd2', 'd4'].map((k) => svc(`mark ${k}`, `perform public.outbox_mark(${id(k)}, false, 'smtp_account')`)),
      { name: 'sofort d1', sql: due('d1') },
      ...cases.flatMap(([k, ago]): Step[] => [age(k, ago), { name: `${k} ${ago}?`, sql: due(k) }]),
    ]
    const setup = `${ISOLATE} ${row('d0', 'sending', 0, '1 minute')} ${row('d1', 'sending', 1, '1 minute')} ${row('d2', 'sending', 3, '1 minute')} ${row('d4', 'sending', 5, '1 minute')}`
    const r = probes(setup, steps)
    expect(r['sofort d1']).toBe('= false') // gerade zurückgegeben: erst nach dem Abstand wieder dran
    for (const [k, ago, soll] of cases) expect(r[`${k} ${ago}?`], `${k} ${ago}`).toBe(`= ${soll}`)
  })

  it('mail2: outbox_claim nennt das Inhaber-Konto der Firma (ältester Inhaber, nie staff, nie contact_email); ohne Inhaber leer; Rechte nur für service_role', () => {
    const user = (key: string) => `insert into auth.users (id, email, aud, role) values ('${key}', '${key}@example.com', 'authenticated', 'authenticated');`
    const ids = { sa: crypto.randomUUID(), oa: crypto.randomUUID(), ob: crypto.randomUUID(), sb: crypto.randomUUID() }
    const partner = (n: string) => `insert into public.partners (name, legal_form, small_business, address_street, address_postcode, address_city, contact_name, contact_phone, contact_email, terms_version, terms_accepted_at)
      values ('Mail2 ${n}', 'gmbh', true, 'Str 1', '1010', 'Wien', 'Max', '12345', 'kontakt-${n}@example.com', '1', now());
      select set_config('app.m76_${n}', (select id::text from public.partners where name = 'Mail2 ${n}'), true);`
    const member = (n: string, user: string, role: string, ago: string) =>
      `insert into public.partner_members (partner_id, user_id, role, created_at) values (current_setting('app.m76_${n}')::uuid, '${user}', '${role}', now() - interval '${ago}');`
    const put = (n: string) => `insert into public.outbox (kind, recipient_kind, recipient_id, dedupe_key) values ('listing_new', 'partner', current_setting('app.m76_${n}')::uuid, 'm76:${n}');`
    const setup = `${ISOLATE} ${Object.values(ids).map((u) => user(u)).join(' ')} ${partner('a')} ${partner('b')} ${partner('c')}
      ${member('a', ids.sa, 'staff', '3 days')} ${member('a', ids.oa, 'owner', '2 days')} ${member('a', ids.ob, 'owner', '1 day')} ${member('b', ids.sb, 'staff', '1 day')} ${put('a')} ${put('b')} ${put('c')}`
    const pick = (n: string) => `select owner_id from c where recipient_id = current_setting('app.m76_${n}')::uuid`
    const r = probes(setup, [
      svc('owner_id je Firma', `=(with c as (select * from public.outbox_claim(50)) select coalesce((${pick('a')}) = '${ids.oa}', false)::text || ',' || coalesce((${pick('b')}) is null, false)::text || ',' || coalesce((${pick('c')}) is null, false)::text)`),
      { name: 'Rechte', sql: `=has_function_privilege('service_role', 'public.outbox_claim(integer)', 'execute')::text || ',' || has_function_privilege('authenticated', 'public.outbox_claim(integer)', 'execute')::text || ',' || has_function_privilege('anon', 'public.outbox_claim(integer)', 'execute')::text` },
      { name: 'als anon', as: 'anon', sql: `perform public.outbox_claim(1)` },
    ])
    expect(r['owner_id je Firma']).toBe('= true,true,true')
    expect(r['Rechte']).toBe('= true,false,false')
    err(r['als anon'], '42501')
  })
})

// Die Form des Fehlers, auf die der Versand sich stützt (mail2): ein nicht vorhandenes Konto ist 404 user_not_found, nichts anderes zählt als „kein Empfänger“.
describe('Auth-Lookup live (mail2)', () => {
  it('getUserById einer unbekannten ID: AuthApiError 404 user_not_found', async () => {
    const { service } = await import('../support/db.ts')
    const { error } = await service.auth.admin.getUserById(crypto.randomUUID())
    expect([error?.name, error?.status, error?.code]).toEqual(['AuthApiError', 404, 'user_not_found'])
  })
})
