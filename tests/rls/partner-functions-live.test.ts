// Live-Aufrufe der deployten Edge Functions change-propose, change-decide und cancel-partner gegen Dev mit echten Tokens (s9i-7b, Teil B; OPEN_ISSUES S9f-8).
// Partner: echte aal2-Sitzungen (tests/support/totp.ts). Kunde: Wegwerfkonto (aal1). Fixtures sind committet, weil die Functions eigene Verbindungen nutzen;
// Rest nach dem Lauf: Journal ist unlöschbar, Kunde, Aufträge und beteiligte Firmen bleiben (Firmen gesperrt, tests/support/sweep.ts, OPEN_ISSUES S9c-7).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { splitChange, splitFee, type FeeTier } from '@pricing'
import { moveInputs } from '../support/quote.ts'
import { deleteUsers, env, makeUser, service, type TestUser } from '../support/db.ts'
import { currentFee } from '../support/fee.ts'
import { ownerSql } from '../support/owner.ts'
import { firm, grantAdmin, insertUsers, newId } from '../support/partner.ts'
import { sweepTestResidue } from '../support/sweep.ts'
import { tryAal2User, type Aal2User } from '../support/totp.ts'

const adm = newId()
const BOOKED = 68961
const [J1, J2, J3, J4, J5] = [newId(), newId(), newId(), newId(), newId()]
let rates: { tiers: FeeTier[]; vatRate: number } = { tiers: [], vatRate: 0 }
let skipReason: string | null = null
let pa: Aal2User, pb: Aal2User, pp: Aal2User, pr: Aal2User, ps: Aal2User
let cust: TestUser, cust2: TestUser

type Res = { status: number; body: Record<string, unknown> }
/** Ruft die deployte Function auf; `jwt` null = ganz ohne Anmeldung. */
async function fn(name: string, jwt: string | null, body: unknown): Promise<Res> {
  const headers: Record<string, string> = { apikey: env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), 'content-type': 'application/json' }
  if (jwt) headers.authorization = `Bearer ${jwt}`
  const res = await fetch(`${env('NEXT_PUBLIC_SUPABASE_URL')}/functions/v1/${name}`, { method: 'POST', headers, body: JSON.stringify(body) })
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> }
}

// Zählen als Eigentümer: outbox und audit_log sind für PostgREST (auch service_role) gesperrt
const count = async (table: string, col: string, val: string, extra: Record<string, string> = {}) => {
  const where = [[col, val], ...Object.entries(extra)].map(([k, v]) => `${k}::text = '${v}'`).join(' and ')
  return Number(ownerSql(`select count(*) as n from public.${table} where ${where}`)[0]?.n)
}
/** Alles, was ein Aufruf schreiben könnte: Status, Journal, Outbox, Audit, Revisionen, Folgeanfragen. */
async function state(req: string) {
  const s = await service.from('service_requests').select('status').eq('id', req).single()
  return {
    status: s.data?.status,
    journal: await count('commission_entries', 'request_id', req),
    outbox: await count('outbox', 'request_id', req),
    audit: await count('audit_log', 'entity_id', req),
    revisions: await count('price_revisions', 'request_id', req),
    followups: await count('service_requests', 'reissued_from', req),
  }
}

beforeAll(async () => {
  ownerSql(`begin; ${insertUsers([adm])} ${grantAdmin(adm)} commit;`)
  sweepTestResidue(adm)
  const first = await tryAal2User('pt-fn-pa')
  if ('reason' in first) {
    skipReason = first.reason
    return
  }
  pa = first.user
  const rest = []
  for (const tag of ['pt-fn-pb', 'pt-fn-pp', 'pt-fn-pr', 'pt-fn-ps']) {
    const r = await tryAal2User(tag)
    if ('reason' in r) throw new Error(r.reason)
    rest.push(r.user)
  }
  ;[pb, pp, pr, ps] = rest as [Aal2User, Aal2User, Aal2User, Aal2User]
  cust = await makeUser('pt-fn-c')
  cust2 = await makeUser('pt-fn-c2')
  const f = currentFee()
  const pv = Number(ownerSql('select (select version from public.current_price_version) as pv')[0]?.pv)
  rates = { tiers: f.tiers, vatRate: f.vr }
  const s0 = splitFee(BOOKED, rates)
  const c80 = splitChange(80000, rates, s0)
  const terms = '"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":0,"call_out_fee_cents":6900,"termsHash":"x"}'
  const inputs = JSON.stringify({ ...moveInputs, service: 'move' })
  // Nr. 148 (0065): die Pauschale (J4) gibt es erst ab Terminbeginn; alle anderen Aufträge liegen in 14 Tagen
  const job = (id: string, termin = "now() + interval '14 days'") => `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline, route)
    values ('${id}', '${cust.id}', gen_random_uuid(), 'move', 'requested', 21, ${termin}, now() + interval '1 day', '{"region":"vienna","outsideKm":0,"driveHours":0}');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '${inputs}', '{"kind":"price","totalCents":${BOOKED},"lowCents":${BOOKED},"highCents":${BOOKED},"lines":[],${terms}}', ${pv}, ${BOOKED}, ${BOOKED}, ${BOOKED});
    update public.service_requests set current_revision = (select id from public.price_revisions where request_id = '${id}' and n = 1) where id = '${id}';
    select public.distribute_request('${id}');
    select public.partner_accept('${pa.id}', (select id from public.job_listings where request_id = '${id}' and partner_id = current_setting('app.p_a')::uuid), (select id from public.price_revisions where request_id = '${id}' and n = 1),
      ${s0.payoutCents}, ${f.vr}, ${s0.feeCents}, ${s0.feeNetCents}, ${s0.feeVatCents}, ${s0.payoutCents}, ${f.fsv}, ${f.vrv});`
  const D21 = { districts: 'array[21]::smallint[]' }
  ownerSql(`begin; ${firm(pa.id, 'a', 'active', adm, D21)} ${firm(pb.id, 'b', 'active', adm, D21)} ${firm(pp.id, 'p', 'pending', adm, D21)} ${firm(pr.id, 'r', 'rejected', adm, D21)}
    ${firm(ps.id, 's', 'suspended', adm, D21)} ${job(J1)} ${job(J2)} ${job(J3)} ${job(J4, "now() - interval '2 hours'")} ${job(J5)}
    insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
    values ('${J3}', 'receipt', current_setting('app.p_a')::uuid, 'ready', gen_random_uuid() || '.jpg', repeat('b', 64), now()),
           ('${J4}', 'receipt', current_setting('app.p_a')::uuid, 'ready', gen_random_uuid() || '.jpg', repeat('c', 64), now()),
           ('${J5}', 'receipt', current_setting('app.p_a')::uuid, 'ready', gen_random_uuid() || '.jpg', repeat('d', 64), now());
    select public.propose_change('${pa.id}', 'aal2', '${J5}', (select current_revision from public.service_requests where id = '${J5}'), '{"hours":6}'::jsonb, 80000,
      array(select id from public.job_photos where request_id = '${J5}' and kind = 'receipt'));
    select public.decide_change('${cust.id}', (select id from public.price_revisions where request_id = '${J5}' and status = 'proposed'), false, 80000, ${f.vr},
      ${c80.feeCents}, ${c80.feeNetCents}, ${c80.feeVatCents}, ${c80.payoutCents}, ${f.fsv}, ${f.vrv});
    select public.propose_change('${pa.id}', 'aal2', '${J4}', (select current_revision from public.service_requests where id = '${J4}'), '{"hours":6}'::jsonb, 80000,
      array(select id from public.job_photos where request_id = '${J4}' and kind = 'receipt'));
    select public.decide_change('${cust.id}', (select id from public.price_revisions where request_id = '${J4}' and status = 'proposed'), false, 80000, ${f.vr},
      ${c80.feeCents}, ${c80.feeNetCents}, ${c80.feeVatCents}, ${c80.payoutCents}, ${f.fsv}, ${f.vrv}); commit;`)
}, 600_000)

// Testfirmen werden an ihrer Kontaktadresse gefunden (FIRM_MAIL, tests/support/sweep.ts), die Reihenfolge Firmen vor Nutzern ist daher nicht mehr nötig, bleibt aber so
afterAll(async () => {
  sweepTestResidue(adm, true)
  await deleteUsers()
}, 120_000)

const live = (name: string, body: (c: { skip: () => void }) => Promise<void>) => it(name, async (c) => { if (skipReason) c.skip(); else await body(c) }, 120_000)

describe('cancel-partner live (Dev, echte Tokens)', () => {
  const ok = { requestId: J1, reason: 'unavailable', shownCallOutCents: 0 }
  live('ohne Anmeldung 401; aal1 und Kunde 403 mfa_required', async () => {
    expect(await fn('cancel-partner', null, ok)).toEqual({ status: 401, body: { error: 'unauthorized' } })
    expect(await fn('cancel-partner', pa.jwt1, ok)).toEqual({ status: 403, body: { error: 'mfa_required' } })
    expect(await fn('cancel-partner', cust.jwt, ok)).toEqual({ status: 403, body: { error: 'mfa_required' } })
  })
  live('fremde Firma 404; pending, rejected, suspended 403 partner_not_active; nichts geschrieben', async () => {
    const before = await state(J1)
    expect(await fn('cancel-partner', pb.jwt2, ok)).toEqual({ status: 404, body: { error: 'not_found' } })
    for (const p of [pp, pr, ps]) expect(await fn('cancel-partner', p.jwt2, ok)).toEqual({ status: 403, body: { error: 'partner_not_active' } })
    expect(await state(J1)).toEqual(before)
  })
  live('Vorschau schreibt nichts: ohne Nachtrag keine Pauschale', async () => {
    const before = await state(J1)
    expect(await fn('cancel-partner', pa.jwt2, { requestId: J1, reason: 'scope_impossible', preview: true })).toEqual({ status: 200, body: { callOutCents: 0, payoutCents: 0 } })
    expect(await state(J1)).toEqual(before)
  })
  live('abweichender gezeigter Betrag: 409 amount_changed, nichts geschrieben', async () => {
    const before = await state(J1)
    const r = await fn('cancel-partner', pa.jwt2, { requestId: J1, reason: 'scope_impossible', photoIds: [newId()], shownCallOutCents: 6900 })
    expect(r).toEqual({ status: 409, body: { error: 'amount_changed' } })
    expect(await state(J1)).toEqual(before)
  })
  live('zwei gleichzeitige Aufrufe und ein dritter nach verlorener Antwort: genau eine Wirkung, alle drei antworten 200 mit dem ersten Ergebnis (n12b)', async () => {
    const body = { requestId: J2, reason: 'unavailable', shownCallOutCents: 0 }
    const rs = await Promise.all([fn('cancel-partner', pa.jwt2, body), fn('cancel-partner', pa.jwt2, body)])
    expect(rs, JSON.stringify(rs)).toEqual([{ status: 200, body: { status: 'cancelled_by_partner', callOutCents: 0 } }, { status: 200, body: { status: 'cancelled_by_partner', callOutCents: 0 } }])
    const late = await fn('cancel-partner', pa.jwt2, body)
    expect(late).toEqual({ status: 200, body: { status: 'cancelled_by_partner', callOutCents: 0 } })
    // nicht dieselbe Wiederholung: anderer Grund oder fremde Firma bleibt 404, nie ein Ergebnis
    expect(await fn('cancel-partner', pa.jwt2, { ...body, reason: 'other' })).toEqual({ status: 404, body: { error: 'not_found' } })
    expect(await fn('cancel-partner', pb.jwt2, body)).toEqual({ status: 404, body: { error: 'not_found' } })
    const s = await state(J2)
    expect(s.status).toBe('cancelled_by_partner')
    expect(await count('commission_entries', 'request_id', J2, { kind: 'cancellation' })).toBe(1)
    expect(await count('audit_log', 'entity_id', J2, { action: 'cancel_by_partner' })).toBe(1)
    expect(s.followups).toBe(1) // Termin in 14 Tagen, kein Festangebot: genau eine Weitervermittlung
  })
  live('Geldpfad: Vorschau zeigt die Pauschale, der echte Aufruf bucht genau eine Gebührenzeile wie splitFee, der Kunde sieht nur den Betrag', async () => {
    const fee = splitFee(6900, rates)
    const base = { requestId: J4, reason: 'scope_impossible' }
    expect(await fn('cancel-partner', pa.jwt2, { ...base, preview: true })).toEqual({ status: 200, body: { callOutCents: 6900, payoutCents: fee.payoutCents } })
    const photos = ((await service.from('job_photos').select('id').eq('request_id', J4).eq('kind', 'receipt')).data ?? []).map((p) => p.id)
    expect(photos).toHaveLength(1)
    expect(await fn('cancel-partner', pa.jwt2, { ...base, photoIds: photos, shownCallOutCents: 6900 })).toEqual({ status: 200, body: { status: 'cancelled_by_partner', callOutCents: 6900 } })
    // n12b: dieselbe Wiederholung nach verlorener Antwort mit Pauschale: dasselbe Ergebnis, unten bleibt es bei genau einer Gebührenzeile
    expect(await fn('cancel-partner', pa.jwt2, { ...base, photoIds: photos, shownCallOutCents: 6900 })).toEqual({ status: 200, body: { status: 'cancelled_by_partner', callOutCents: 6900 } })
    const rows = ownerSql(`select total_cents, fee_cents, fee_net_cents, fee_vat_cents, payout_cents from public.commission_entries where request_id = '${J4}' and kind = 'cancellation_fee'`)
    expect(rows.map((r) => [Number(r.total_cents), Number(r.fee_cents), Number(r.fee_net_cents), Number(r.fee_vat_cents), Number(r.payout_cents)])).toEqual([
      [6900, fee.feeCents, fee.feeNetCents, fee.feeVatCents, fee.payoutCents],
    ])
    const s = await state(J4)
    expect(s.followups).toBe(0)
    expect(await count('outbox', 'request_id', J4, { kind: 'partner_cancelled_fee' })).toBe(1)
    const mine = await cust.db.rpc('my_cancel_info', { p_request: J4 })
    expect(mine.data, JSON.stringify(mine.error)).toBe(6900)
    expect((await cust2.db.rpc('my_cancel_info', { p_request: J4 })).error).not.toBeNull()
  })
  live('Nr. 148: vor dem Termin (J5, in 14 Tagen, Nachtrag abgelehnt) zeigt die Vorschau 0, ein Aufruf mit Belegen und 6.900 gibt 409, nichts geschrieben', async () => {
    const base = { requestId: J5, reason: 'scope_impossible' }
    expect(await fn('cancel-partner', pa.jwt2, { ...base, preview: true })).toEqual({ status: 200, body: { callOutCents: 0, payoutCents: 0 } })
    const photos = ((await service.from('job_photos').select('id').eq('request_id', J5).eq('kind', 'receipt')).data ?? []).map((p) => p.id)
    expect(photos).toHaveLength(1)
    const before = await state(J5)
    expect(await fn('cancel-partner', pa.jwt2, { ...base, photoIds: photos, shownCallOutCents: 6900 })).toEqual({ status: 409, body: { error: 'amount_changed' } })
    expect(await state(J5)).toEqual(before)
    expect(before.status).toBe('accepted')
  })
})

describe('change-propose und change-decide live (Dev, echte Tokens)', () => {
  const change = { requestId: J3, changes: { hours: 7 } }
  let total = 0
  live('ohne Anmeldung 401; aal1, Kunde 403; fremde Firma 404; pending, rejected, suspended 403', async () => {
    const body = { ...change, preview: true }
    expect(await fn('change-propose', null, body)).toEqual({ status: 401, body: { error: 'unauthorized' } })
    expect(await fn('change-propose', pa.jwt1, body)).toEqual({ status: 403, body: { error: 'mfa_required' } })
    expect(await fn('change-propose', cust.jwt, body)).toEqual({ status: 403, body: { error: 'mfa_required' } })
    expect(await fn('change-propose', pb.jwt2, body)).toEqual({ status: 404, body: { error: 'not_found' } })
    for (const p of [pp, pr, ps]) expect(await fn('change-propose', p.jwt2, body)).toEqual({ status: 403, body: { error: 'partner_not_active' } })
  })
  live('Vorschau: Betrag aus der Gebuchten-Version, nichts angelegt', async () => {
    const before = await state(J3)
    const r = await fn('change-propose', pa.jwt2, { ...change, preview: true })
    expect(r.status, JSON.stringify(r)).toBe(200)
    total = Number(r.body.totalCents)
    expect(total).toBeGreaterThan(BOOKED)
    expect(r.body.baseCents).toBe(BOOKED)
    expect(await state(J3)).toEqual(before)
  })
  live('abweichender gezeigter Betrag: 409 amount_changed, nichts angelegt', async () => {
    const before = await state(J3)
    const r = await fn('change-propose', pa.jwt2, { ...change, photoIds: [newId()], shownTotalCents: total + 1 })
    expect(r).toEqual({ status: 409, body: { error: 'amount_changed' } })
    expect(await state(J3)).toEqual(before)
  })
  live('Anlegen mit gezeigtem Betrag: 200; zweiter Aufruf nach verlorener Antwort 200 mit derselben Antwort, genau ein offener Nachtrag', async () => {
    const photo = await service.from('job_photos').select('id').eq('request_id', J3).eq('kind', 'receipt')
    const body = { ...change, photoIds: (photo.data ?? []).map((p) => p.id), shownTotalCents: total }
    const first = await fn('change-propose', pa.jwt2, body)
    expect(first.status, JSON.stringify(first)).toBe(200)
    expect(first.body.totalCents).toBe(total)
    const again = await fn('change-propose', pa.jwt2, body)
    expect(again).toEqual(first)
    expect(await count('price_revisions', 'request_id', J3, { status: 'proposed' })).toBe(1)
  })
  live('change-decide: ohne Anmeldung 401; Partner und fremder Kunde 404; falscher Betrag 409; Annahme 200; Wiederholung 200 mit einer Journalzeile', async () => {
    const rev = (await service.from('price_revisions').select('id').eq('request_id', J3).eq('status', 'proposed').single()).data?.id as string
    const accept = { revisionId: rev, decision: 'accept', shownTotalCents: total }
    expect(await fn('change-decide', null, accept)).toEqual({ status: 401, body: { error: 'unauthorized' } })
    expect((await fn('change-decide', pa.jwt2, accept)).status).toBe(404)
    expect((await fn('change-decide', cust2.jwt, accept)).status).toBe(404)
    expect(await fn('change-decide', cust.jwt, { ...accept, shownTotalCents: total + 1 })).toEqual({ status: 409, body: { error: 'amount_changed' } })
    expect(await count('price_revisions', 'request_id', J3, { status: 'proposed' })).toBe(1)
    expect(await fn('change-decide', cust.jwt, accept)).toEqual({ status: 200, body: { status: 'accepted' } })
    expect(await fn('change-decide', cust.jwt, accept)).toEqual({ status: 200, body: { status: 'accepted' } })
    expect(await count('commission_entries', 'request_id', J3, { kind: 'change' })).toBe(1)
    expect((await fn('change-decide', cust.jwt, { revisionId: rev, decision: 'decline' })).status).toBe(409)
  })
})
