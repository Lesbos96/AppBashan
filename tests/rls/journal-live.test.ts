// Journal-CSV der Firma (s9i-7c1): my_commissions mit echten aal2-Tokens gegen Dev, so wie die App es aufruft (count exact, feste Sortierung, range).
// Rechte-Matrix, keine Kundendatenspalten, Summe je Auftrag nach Storno ohne Pauschale = 0, Abgleich mit export_commissions und Datei aus den Live-Zeilen.
// Fixtures sind committet (Journal ist unlöschbar); Rest nach dem Lauf: Kunde, Aufträge und Firmen (gesperrt, tests/support/sweep.ts, OPEN_ISSUES S9c-7).
import { appendFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { splitChange, splitFee } from '@pricing'
import { journalCsv } from '../../supabase/functions/_shared/commission/csv.ts'
import { moveInputs } from '../support/quote.ts'
import { anon, deleteUsers, env, makeUser, service, type TestUser } from '../support/db.ts'
import { ownerSql } from '../support/owner.ts'
import { firm, grantAdmin, insertUsers, newId } from '../support/partner.ts'
import { sweepTestResidue } from '../support/sweep.ts'
import { tryAal2User, type Aal2User } from '../support/totp.ts'

const adm = newId()
const BOOKED = 68961
const [J1, J2, J4] = [newId(), newId(), newId()]
const OURS: string[] = [J1, J2, J4]
let skipReason: string | null = null
let pa: Aal2User, pb: Aal2User, pp: Aal2User, pr: Aal2User, ps: Aal2User
let cust: TestUser
let month = ''
let partnerA = ''

const COLUMNS = 'entry_id, request_id, kind, reverses_entry_id, created_at, total_cents, fee_rate, fee_net_cents, fee_vat_cents, fee_cents, payout_cents, billing_month'
type R = { entry_id: string; request_id: string; kind: string; reverses_entry_id: string | null; created_at: string; total_cents: number; fee_rate: number; fee_net_cents: number; fee_vat_cents: number; fee_cents: number; payout_cents: number; billing_month: string }

async function fn(name: string, jwt: string, body: unknown) {
  const res = await fetch(`${env('NEXT_PUBLIC_SUPABASE_URL')}/functions/v1/${name}`, {
    method: 'POST',
    headers: { apikey: env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), 'content-type': 'application/json', authorization: `Bearer ${jwt}` },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> }
}

/** Genau der Aufruf der App (src/lib/partnerJournal.ts). */
const appCall = (db: Aal2User['aal2'], m = month) =>
  (db.rpc('my_commissions', { p_month: `${m}-01` } as never, { count: 'exact' }) as unknown as {
    select: (c: string) => { order: (c: string) => { order: (c: string) => { range: (a: number, b: number) => Promise<{ data: R[] | null; error: { code: string; message: string } | null; count: number | null }> } } }
  })
    .select(COLUMNS)
    .order('created_at')
    .order('entry_id')
    .range(0, 999)

// Ist-Werte der Rechte-Matrix für den Nachweis (vitest zeigt die Konsole bestandener Tests hier nicht): Arbeitsdatei, jeder Lauf überschreibt sie beim ersten Eintrag nicht, sondern hängt an
const ist = (line: string) => appendFileSync('tmp/reports/journal-live-ist.txt', `${line}\n`)
const mine = (rows: R[] | null, req: string) => (rows ?? []).filter((r) => r.request_id === req)
const sum = (rows: R[], col: keyof R) => rows.reduce((a, r) => a + Number(r[col]), 0)

beforeAll(async () => {
  ownerSql(`begin; ${insertUsers([adm])} ${grantAdmin(adm)} commit;`)
  sweepTestResidue(adm)
  const first = await tryAal2User('pt-jn-pa')
  if ('reason' in first) {
    skipReason = first.reason
    return
  }
  pa = first.user
  const rest = []
  for (const tag of ['pt-jn-pb', 'pt-jn-pp', 'pt-jn-pr', 'pt-jn-ps']) {
    const r = await tryAal2User(tag)
    if ('reason' in r) throw new Error(r.reason)
    rest.push(r.user)
  }
  ;[pb, pp, pr, ps] = rest as [Aal2User, Aal2User, Aal2User, Aal2User]
  cust = await makeUser('pt-jn-c')
  const f = ownerSql(`select (select value::float8 from public.platform_settings where key = 'fee_rate' and effective_from <= (now() at time zone 'Europe/Vienna')::date order by effective_from desc, version desc limit 1) as fr,
    (select value::float8 from public.platform_settings where key = 'fee_vat_rate' and effective_from <= (now() at time zone 'Europe/Vienna')::date order by effective_from desc, version desc limit 1) as vr,
    (select version from public.platform_settings where key = 'fee_rate' and effective_from <= (now() at time zone 'Europe/Vienna')::date order by effective_from desc, version desc limit 1) as frv,
    (select version from public.platform_settings where key = 'fee_vat_rate' and effective_from <= (now() at time zone 'Europe/Vienna')::date order by effective_from desc, version desc limit 1) as vrv,
    (select version from public.current_price_version) as pv,
    to_char(now() at time zone 'Europe/Vienna', 'YYYY-MM') as m`)[0] as { fr: number; vr: number; frv: number; vrv: number; pv: number; m: string }
  month = f.m
  const rates = { feeRate: f.fr, vatRate: f.vr }
  const s0 = splitFee(BOOKED, rates)
  const c80 = splitChange(80000, rates, s0)
  const terms = '"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":0,"call_out_fee_cents":6900,"termsHash":"x"}'
  const inputs = JSON.stringify({ ...moveInputs, service: 'move' })
  const job = (id: string) => `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline, route)
    values ('${id}', '${cust.id}', gen_random_uuid(), 'move', 'requested', 21, now() + interval '14 days', now() + interval '1 day', '{"region":"vienna","outsideKm":0,"driveHours":0}');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '${inputs}', '{"kind":"price","totalCents":${BOOKED},"lowCents":${BOOKED},"highCents":${BOOKED},"lines":[],${terms}}', ${f.pv}, ${BOOKED}, ${BOOKED}, ${BOOKED});
    update public.service_requests set current_revision = (select id from public.price_revisions where request_id = '${id}' and n = 1) where id = '${id}';
    select public.distribute_request('${id}');
    select public.partner_accept('${pa.id}', (select id from public.job_listings where request_id = '${id}' and partner_id = current_setting('app.p_a')::uuid), (select id from public.price_revisions where request_id = '${id}' and n = 1),
      ${s0.payoutCents}, ${f.fr}, ${f.vr}, ${s0.feeCents}, ${s0.feeNetCents}, ${s0.feeVatCents}, ${s0.payoutCents}, ${f.frv}, ${f.vrv});`
  const change = (id: string, accept: boolean, sha: string) => `
    insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
    values ('${id}', 'receipt', current_setting('app.p_a')::uuid, 'ready', gen_random_uuid() || '.jpg', repeat('${sha}', 64), now());
    select public.propose_change('${pa.id}', 'aal2', '${id}', (select current_revision from public.service_requests where id = '${id}'), '{"hours":6}'::jsonb, 80000,
      array(select id from public.job_photos where request_id = '${id}' and kind = 'receipt'));
    select public.decide_change('${cust.id}', (select id from public.price_revisions where request_id = '${id}' and status = 'proposed'), ${accept}, 80000, ${f.fr}, ${f.vr},
      ${c80.feeCents}, ${c80.feeNetCents}, ${c80.feeVatCents}, ${c80.payoutCents}, ${f.frv}, ${f.vrv});`
  const D21 = { districts: 'array[21]::smallint[]' }
  ownerSql(`begin; ${firm(pa.id, 'a', 'active', adm, D21)} ${firm(pb.id, 'b', 'active', adm, D21)} ${firm(pp.id, 'p', 'pending', adm, D21)} ${firm(pr.id, 'r', 'rejected', adm, D21)}
    ${firm(ps.id, 's', 'suspended', adm, D21)} ${job(J1)} ${job(J2)} ${job(J4)} ${change(J2, true, 'd')} ${change(J4, false, 'c')} commit;`)
  partnerA = String(ownerSql(`select partner_id from public.partner_members where user_id = '${pa.id}'`)[0]?.partner_id ?? '')
  // J1: Storno ohne Pauschale; J2: angenommener Nachtrag, dann Storno ohne Pauschale; J4: abgelehnter Nachtrag, Storno mit Pauschale und Beleg
  expect((await fn('cancel-partner', pa.jwt2, { requestId: J1, reason: 'unavailable', shownCallOutCents: 0 })).status).toBe(200)
  expect((await fn('cancel-partner', pa.jwt2, { requestId: J2, reason: 'unavailable', shownCallOutCents: 0 })).status).toBe(200)
  const photos = ((await service.from('job_photos').select('id').eq('request_id', J4).eq('kind', 'receipt')).data ?? []).map((p) => p.id)
  expect(await fn('cancel-partner', pa.jwt2, { requestId: J4, reason: 'scope_impossible', photoIds: photos, shownCallOutCents: 6900 })).toEqual({ status: 200, body: { status: 'cancelled_by_partner', callOutCents: 6900 } })
}, 600_000)

afterAll(async () => {
  sweepTestResidue(adm, true)
  await deleteUsers()
}, 120_000)

const live = (name: string, body: () => Promise<void>) => it(name, async (c) => { if (skipReason) c.skip(); else await body() }, 120_000)

describe('my_commissions für den Journal-Export (Dev, echte Tokens)', () => {
  live('Rechte: anon 42501; Kunde und aal1 mfa_required; Firma a sieht ihre Zeilen', async () => {
    const a = await (anon.rpc('my_commissions', { p_month: `${month}-01` }) as unknown as Promise<{ error: { code: string } | null }>)
    const k = await appCall(cust.db)
    const l = await appCall(pa.aal1)
    const r = await appCall(pa.aal2)
    ist(`IST anon=${a.error?.code} kunde=${k.error?.message} aal1=${l.error?.message} firma-a-aal2-zeilen=${r.data?.length}`)
    expect(a.error?.code).toBe('42501')
    expect(k.error?.message).toBe('mfa_required')
    expect(l.error?.message).toBe('mfa_required')
    expect(r.error).toBeNull()
    expect(r.count).toBe(r.data?.length)
    expect(new Set((r.data ?? []).map((x) => x.request_id))).toEqual(new Set([J1, J2, J4]))
  })

  live('fremde Firma sieht keine Zeile von Firma a; pending, rejected, suspended: kein Fehler, leer', async () => {
    const b = await appCall(pb.aal2)
    expect(b.error).toBeNull()
    ist(`IST firma-b-zeilen-von-a=${(b.data ?? []).filter((x) => OURS.includes(x.request_id)).length} firma-b-gesamt=${b.data?.length}`)
    expect((b.data ?? []).filter((x) => OURS.includes(x.request_id))).toHaveLength(0)
    for (const p of [pp, pr, ps]) {
      const r = await appCall(p.aal2)
      expect(r.error).toBeNull()
      expect(r.data).toEqual([])
    }
  })

  live('alle Zeilen gehören zu Firma a (Spalte partner_id über den Typ) und zum gewählten Monat', async () => {
    const full = await (pa.aal2.rpc('my_commissions', { p_month: `${month}-01` } as never) as unknown as Promise<{ data: { partner_id: string; billing_month: string }[] }>)
    expect(full.data.length).toBeGreaterThanOrEqual(6)
    expect(new Set(full.data.map((x) => x.partner_id))).toEqual(new Set([partnerA]))
    expect(new Set(full.data.map((x) => x.billing_month))).toEqual(new Set([`${month}-01`]))
  })

  live('Typ commission_row: genau die bekannten Spalten, keine Kundendaten (eine neue Spalte bricht den Test und braucht Prüfung)', async () => {
    const cols = ownerSql(`select attname from pg_attribute where attrelid = 'public.commission_row'::regclass and attnum > 0 and not attisdropped order by attnum`).map((r) => r.attname)
    expect(cols).toEqual([
      'entry_id', 'request_id', 'partner_id', 'partner_name', 'kind', 'reverses_entry_id', 'created_at', 'total_cents', 'fee_rate', 'fee_net_cents', 'fee_vat_cents', 'fee_cents',
      'payout_cents', 'vat_rule', 'request_status', 'ended_at', 'billing_month',
    ])
    expect(cols.join(' ')).not.toMatch(/customer|kunde|address|adresse|phone|telefon|mail|contact|kontakt|note|text/)
  })

  live('Storno ohne Pauschale: Summe je Auftrag 0, Gegenbuchung verweist auf die Buchung; mit Nachtrag auch', async () => {
    const r = (await appCall(pa.aal2)).data
    for (const req of [J1, J2]) {
      const rows = mine(r, req)
      expect(rows.filter((x) => x.kind === 'booking')).toHaveLength(1)
      for (const col of ['total_cents', 'fee_net_cents', 'fee_vat_cents', 'fee_cents', 'payout_cents'] as const) expect(sum(rows, col), `${req} ${col}`).toBe(0)
      for (const c of rows.filter((x) => x.kind === 'cancellation')) expect(rows.map((x) => x.entry_id)).toContain(c.reverses_entry_id)
    }
    expect(mine(r, J1).map((x) => x.kind).sort()).toEqual(['booking', 'cancellation'])
    expect(mine(r, J2).map((x) => x.kind)).toContain('change')
  })

  live('Storno mit Pauschale: Stornopauschale 6.900 ct (Gebühr 1.035 = 863 + 172, Auszahlung 5.865), Rest hebt sich auf', async () => {
    const rows = mine((await appCall(pa.aal2)).data, J4)
    const fee = rows.filter((x) => x.kind === 'cancellation_fee')
    expect(fee).toHaveLength(1)
    expect(fee[0]).toMatchObject({ total_cents: 6900, fee_cents: 1035, fee_net_cents: 863, fee_vat_cents: 172, payout_cents: 5865 })
    for (const col of ['total_cents', 'fee_net_cents', 'fee_vat_cents', 'fee_cents', 'payout_cents'] as const) expect(sum(rows, col)).toBe(Number(fee[0]![col]))
  })

  live('Abgleich mit export_commissions (admin): dieselben Zeilen und Beträge', async () => {
    const mineRows = (await appCall(pa.aal2)).data ?? []
    const exp = await (service.rpc('export_commissions', { p_actor: adm, p_month: `${month}-01` }) as unknown as Promise<{ data: R[] | null }>)
    const key = (x: R) => `${x.entry_id}|${x.kind}|${x.reverses_entry_id}|${x.total_cents}|${x.fee_cents}|${x.fee_net_cents}|${x.fee_vat_cents}|${x.payout_cents}`
    const own = (exp.data ?? []).filter((x) => OURS.includes(x.request_id))
    expect(mineRows.map(key).sort()).toEqual(own.map(key).sort())
  })

  live('Datei aus den Live-Zeilen: je Auftrag Summe der Spalte „Betrag Kunde“ 0, 0 und 6900 ct; keine Kunden-ID; eine Zeile je Journalzeile', async () => {
    const rows = (await appCall(pa.aal2)).data ?? []
    const csv = journalCsv(rows as never)
    const lines = csv.split('\r\n').filter(Boolean)
    expect(lines).toHaveLength(rows.length + 1)
    expect(csv).not.toContain(cust.id)
    const total = (req: string) =>
      lines.slice(1).filter((l) => l.split(';')[2] === req).reduce((a, l) => a + Math.round(Number(l.split(';')[5]!.replace(',', '.')) * 100), 0)
    expect([total(J1), total(J2), total(J4)]).toEqual([0, 0, 6900])
  })
})
