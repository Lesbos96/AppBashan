// Durchgangstest Kunde ↔ Partner gegen Dev (s9i-7c2): Zuschlag, Start, Beleg, Nachtrag, Zustimmung, Abschluss und Storno über die deployten Wege mit echten Tokens
// (Edge accept, photo-receipt, change-propose, change-decide, cancel-partner, cancel-customer, offer-confirm; RPC start_job, complete_job, job_contact, my_commissions) wie die App sie aufruft.
// Anfrage = SQL-Fixture (Edge quote ist live nicht testbar: externer Routenanbieter); Termine relativ zur DB-Uhr. Plan: tmp/proof/s9i-7c2-fable-plan.md.
// Fixtures sind committet (Journal ist unlöschbar); Rest nach dem Lauf: Kunde, Aufträge, Folgeanfrage, Firmen (gesperrt), Belegzeilen; Belegobjekte werden gelöscht.
import { appendFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Image } from 'imagescript'
import '../../scripts/dev-guard.mjs'
import { splitChange, splitFee, type FeeTier } from '@pricing'
import { journalCsv } from '../../supabase/functions/_shared/commission/csv.ts'
import { moveInputs } from '../support/quote.ts'
import { anon, deleteUsers, env, makeUser, type TestUser } from '../support/db.ts'
import { currentFee } from '../support/fee.ts'
import { ownerSql } from '../support/owner.ts'
import { COVER_FIRM, FIRM_MAIL_RE } from '../support/marker.ts'
import { FIRM_MAIL, firm, grantAdmin, insertUsers, newId } from '../support/partner.ts'
import { sweepReceiptObjects, sweepTestResidue } from '../support/sweep.ts'
import { tryAal2User, type Aal2User } from '../support/totp.ts'

// Erwartungswerte an EINER Stelle (Provisionsstaffel v2: 12 % bis 500 EUR, 10 % bis 1.000 EUR, 7 % darüber; USt. 20 %; s9p-1).
// Der Test „Erwartungskonstanten“ rechnet sie mit der aktuellen Staffel aus der Datenbank gegen und nennt bei Abweichung die Ursache.
type Money = { total: number; fee: number; net: number; vat: number; payout: number }
const BOOKED: Money = { total: 68961, fee: 7896, net: 6580, vat: 1316, payout: 61065 }
const CALL_OUT: Money = { total: 6900, fee: 828, net: 690, vat: 138, payout: 6072 }
const OFFER: Money = { total: 150000, fee: 14500, net: 12083, vat: 2417, payout: 135500 }
const ZERO: Money = { total: 0, fee: 0, net: 0, vat: 0, payout: 0 }

const adm = newId()
const [W1, W2A, W2B, W3, W4, W5, W6, W7] = [newId(), newId(), newId(), newId(), newId(), newId(), newId(), newId()]
const OURS = [W1, W2A, W2B, W3, W4, W5, W6, W7]
let skipReason: string | null = null
let pa: Aal2User, pb: Aal2User
let cust: TestUser
let rates = { tiers: [] as FeeTier[], vatRate: 0 }
let feeVersion = 0
let monthStart = ''
let partnerA = ''
const ctx = { t1: 0, change1: null as null | Money, t3: 0, receipts: [] as string[] }

type Res = { status: number; body: Record<string, unknown> }
const hdr = (jwt: string | null, extra: Record<string, string> = {}) => ({ apikey: env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), ...(jwt ? { authorization: `Bearer ${jwt}` } : {}), ...extra })
async function fn(name: string, jwt: string | null, body: unknown): Promise<Res> {
  const res = await fetch(`${env('NEXT_PUBLIC_SUPABASE_URL')}/functions/v1/${name}`, { method: 'POST', headers: hdr(jwt, { 'content-type': 'application/json' }), body: JSON.stringify(body) })
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> }
}
/** Beleg wie die App: JPEG-Body, `?request=`. Je Aufruf eine andere Farbe, im Speicher erzeugt. */
async function upload(jwt: string | null, req: string, body?: Uint8Array): Promise<Res> {
  const jpg = body ?? (await new Image(16, 16).fill(Image.rgbToColor(40 + ctx.receipts.length * 50, 120, 200)).encodeJPEG({ quality: 80 }))
  const res = await fetch(`${env('NEXT_PUBLIC_SUPABASE_URL')}/functions/v1/photo-receipt?request=${req}`, { method: 'POST', headers: hdr(jwt, { 'content-type': 'image/jpeg' }), body: jpg as BodyInit })
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> }
}

const json = <T>(v: unknown): T => (typeof v === 'string' ? JSON.parse(v) : v) as T
type J = { kind: string; total: number; fee: number; net: number; vat: number; payout: number; rev: boolean }
/** Eine Abfrage je Schritt: Status, Journal (Art, Vorzeichen über die Beträge, Bezug), Folgeanfragen, Listings, Outbox. */
function snap(req: string) {
  const r = ownerSql(`select (select status::text from public.service_requests where id = '${req}') as status,
    (select coalesce(json_agg(json_build_object('kind', kind, 'total', total_cents, 'fee', fee_cents, 'net', fee_net_cents, 'vat', fee_vat_cents, 'payout', payout_cents, 'rev', reverses_entry_id is not null) order by created_at, id), '[]'::json) from public.commission_entries where request_id = '${req}') as journal,
    (select count(*) from public.service_requests where reissued_from = '${req}') as followups,
    (select count(*) from public.job_listings where request_id = '${req}') as listings,
    (select coalesce(json_object_agg(kind, n), '{}'::json) from (select kind, count(*) as n from public.outbox where request_id = '${req}' group by kind) x) as outbox,
    (select count(*) from public.price_revisions where request_id = '${req}') as revisions`)[0]!
  return { status: String(r.status), journal: json<J[]>(r.journal), followups: Number(r.followups), listings: Number(r.listings), outbox: json<Record<string, number>>(r.outbox), revisions: Number(r.revisions) }
}
const ist = (line: string) => appendFileSync('tmp/reports/flow-live-ist.txt', `${line}\n`)
function step(weg: string, name: string, req: string) {
  const s = snap(req)
  ist(`${weg} | ${name} | status=${s.status} | journal=[${s.journal.map((j) => `${j.kind}${j.rev ? '(Gegen)' : ''}:${j.total}/${j.fee}/${j.net}/${j.vat}/${j.payout}`).join(' ')}] | folgeanfragen=${s.followups} listings=${s.listings} revisionen=${s.revisions} outbox=${JSON.stringify(s.outbox)}`)
  return s
}
const sum = (rows: Pick<J, 'total' | 'fee' | 'net' | 'vat' | 'payout'>[]): Money => ({
  total: rows.reduce((a, r) => a + r.total, 0), fee: rows.reduce((a, r) => a + r.fee, 0), net: rows.reduce((a, r) => a + r.net, 0), vat: rows.reduce((a, r) => a + r.vat, 0), payout: rows.reduce((a, r) => a + r.payout, 0),
})
const kinds = (s: { journal: J[] }) => s.journal.map((j) => j.kind + (j.rev ? '-' : '+'))

const partnerOf = (user: string) => String(ownerSql(`select partner_id from public.partner_members where user_id = '${user}'`)[0]?.partner_id)
const rev1 = (req: string) => String(ownerSql(`select id from public.price_revisions where request_id = '${req}' and n = 1`)[0]?.id)
const listingOf = (req: string, partner: string) => String(ownerSql(`select id from public.job_listings where request_id = '${req}' and partner_id = '${partner}'`)[0]?.id)
const photosOf = (req: string) => ownerSql(`select id from public.job_photos where request_id = '${req}' and kind = 'receipt' order by created_at`).map((r) => String(r.id))
const contact = (db: Aal2User['aal2'], req: string) => db.rpc('job_contact', { p_request: req })

beforeAll(async () => {
  writeFileSync('tmp/reports/flow-live-ist.txt', `LAUF ${new Date().toISOString()} commit ${execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim()}${execFileSync('git', ['status', '--porcelain', '--untracked-files=no']).toString().trim() ? ' (Arbeitsbaum geändert)' : ' (sauber)'} Kennung 7c2-1311-c\n`)
  ownerSql(`begin; ${insertUsers([adm])} ${grantAdmin(adm)} commit;`)
  sweepTestResidue(adm)
  await sweepReceiptObjects()
  const f = ownerSql(`select (select version from public.current_price_version) as pv, to_char(now() at time zone 'Europe/Vienna', 'YYYY-MM') as m`)[0] as { pv: number; m: string }
  const cf = currentFee()
  rates = { tiers: cf.tiers, vatRate: cf.vr }
  feeVersion = cf.fsv
  monthStart = f.m
  // Auflage 1: Sätze gegen die Literale prüfen, bevor etwas committet ist
  for (const [total, want] of [[BOOKED.total, BOOKED], [CALL_OUT.total, CALL_OUT], [OFFER.total, OFFER]] as const) {
    const s = splitFee(total, rates)
    const got = { total, fee: s.feeCents, net: s.feeNetCents, vat: s.feeVatCents, payout: s.payoutCents }
    if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`Erwartungskonstanten passen nicht zur Staffel ${JSON.stringify(cf.tiers)}/${cf.vr}: ist ${JSON.stringify(got)}, Konstante ${JSON.stringify(want)} (s9p-1: Konstanten oben anpassen)`)
  }
  const first = await tryAal2User('pt-fl-pa')
  if ('reason' in first) {
    skipReason = first.reason
    return
  }
  pa = first.user
  const b = await tryAal2User('pt-fl-pb')
  if ('reason' in b) throw new Error(b.reason)
  pb = b.user
  cust = await makeUser('pt-fl-c')
  const terms = '"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":0,"call_out_fee_cents":6900,"termsHash":"x"}'
  const inputs = JSON.stringify({ ...moveInputs, service: 'move' })
  const job = (id: string, termin: string) => `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline, route)
    values ('${id}', '${cust.id}', gen_random_uuid(), 'move', 'requested', 21, ${termin}, now() + interval '1 day', '{"region":"vienna","outsideKm":0,"driveHours":0}');
    insert into public.request_contacts (request_id, name, phone, email, stairs_door) values ('${id}', 'Karl Kunde', '+43 1 234', 'karl@movenow.test', '3. Stock');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '${inputs}', '{"kind":"price","totalCents":${BOOKED.total},"lowCents":${BOOKED.total},"highCents":${BOOKED.total},"lines":[],${terms}}', ${f.pv}, ${BOOKED.total}, ${BOOKED.total}, ${BOOKED.total});
    update public.service_requests set current_revision = (select id from public.price_revisions where request_id = '${id}' and n = 1) where id = '${id}';
    select public.distribute_request('${id}');`
  // Auftrag ohne Festpreis (Spanne, awaiting_offer): Firmen senden Angebote, der Kunde bestätigt über offer-confirm
  const ranged = (id: string) => `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline, route)
    values ('${id}', '${cust.id}', gen_random_uuid(), 'move', 'awaiting_offer', 21, now() + interval '14 days', now() + interval '1 day', '{"region":"vienna","outsideKm":0,"driveHours":0}');
    insert into public.request_contacts (request_id, name, phone, email, stairs_door) values ('${id}', 'Karl Kunde', '+43 1 234', 'karl@movenow.test', '3. Stock');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '${inputs}', '{"kind":"price","lowCents":100000,"highCents":200000,"lines":[],${terms}}', ${f.pv}, null, 100000, 200000);
    update public.service_requests set current_revision = (select id from public.price_revisions where request_id = '${id}' and n = 1) where id = '${id}';
    select public.distribute_request('${id}');`
  const past = "now() - interval '2 hours'"
  const future = "now() + interval '14 days'"
  const D21 = { districts: 'array[21]::smallint[]' }
  ownerSql(`begin; ${firm(pa.id, 'a', 'active', adm, D21)} ${firm(pb.id, 'b', 'active', adm, D21)} ${job(W1, past)} ${job(W2A, future)} ${job(W2B, past)} ${job(W3, past)} ${job(W4, future)} ${ranged(W5)} ${job(W6, "now() - interval '5 minutes'")} ${job(W7, past)} commit;`) // W6: Termin heute (Wiener Tag) für set_en_route, nicht 2 Stunden zurück (kurz nach Mitternacht wäre das gestern)
  partnerA = partnerOf(pa.id)
}, 600_000)

afterAll(async () => {
  for (const [name, f] of [['Belegobjekte', async () => ist(`AUFRÄUMEN Belegobjekte gelöscht: ${await sweepReceiptObjects()}`)], ['Firmen und Nutzer', async () => sweepTestResidue(adm, true)], ['Konten', deleteUsers],
    ['Rest', async () => {
      const r = ownerSql(`select count(*) filter (where p.status in ('active', 'payment_hold')) as aktiv, count(*) as gesamt,
        (select status::text from public.partners where id = nullif('${partnerA}', '')::uuid) as firma_a
        from public.partners p where p.contact_email ~ '${FIRM_MAIL_RE}' and p.name <> '${COVER_FIRM}'`)[0]!
      ist(`AUFRÄUMEN Rest | Testfirmen active/payment_hold=${r.aktiv} gesamt=${r.gesamt} Firma a=${r.firma_a}`)
    }]] as const) {
    try {
      await f()
    } catch (e) {
      console.warn(`Aufräumen ${name} fehlgeschlagen:`, (e as Error).message.slice(0, 200))
      ist(`AUFRÄUMEN ${name} FEHLER ${(e as Error).message.slice(0, 120)}`)
    }
  }
}, 180_000)

const live = (name: string, body: () => Promise<void>) => it(name, async (c) => { if (skipReason) c.skip(); else await body() }, 180_000)

describe('Erwartungskonstanten', () => {
  it('Buchung, Pauschale und Nachtragszeile entsprechen splitFee/splitChange mit dem Satz aus platform_settings', () => {
    const s0 = splitFee(BOOKED.total, rates)
    expect([s0.feeCents, s0.feeNetCents, s0.feeVatCents, s0.payoutCents]).toEqual([BOOKED.fee, BOOKED.net, BOOKED.vat, BOOKED.payout])
    const c = splitFee(CALL_OUT.total, rates)
    expect([c.feeCents, c.feeNetCents, c.feeVatCents, c.payoutCents]).toEqual([CALL_OUT.fee, CALL_OUT.net, CALL_OUT.vat, CALL_OUT.payout])
    const o = splitFee(OFFER.total, rates)
    expect([o.feeCents, o.feeNetCents, o.feeVatCents, o.payoutCents]).toEqual([OFFER.fee, OFFER.net, OFFER.vat, OFFER.payout])
    expect(rates.tiers).toEqual([{ upToCents: 50000, bp: 1200 }, { upToCents: 100000, bp: 1000 }, { upToCents: null, bp: 700 }])
  })
})

describe('W1 Hauptweg: Zuschlag, Start, Beleg, Nachtrag, Zustimmung, Abschluss (Termin vor 2 Stunden); Konstanten: Buchung, Pauschale, Angebot', () => {
  live('accept: Rechte, falscher Betrag; dann der Zuschlag von Firma a; Firma b bekommt 409', async () => {
    const a = partnerA
    const b = partnerOf(pb.id)
    const body = { listingId: listingOf(W1, a), revisionId: rev1(W1), shownPayoutCents: BOOKED.payout }
    const s0 = step('W1', '1 Anfrage (Fixture)', W1)
    expect(s0).toMatchObject({ status: 'requested', journal: [] })
    expect(s0.listings).toBeGreaterThanOrEqual(2) // Firma a und b (weitere aktive Firmen im Bezirk 21 möglich)
    expect((await fn('accept', null, body)).status).toBe(401)
    expect((await fn('accept', pa.jwt1, body)).status).toBe(403)
    expect((await fn('accept', cust.jwt, body)).status).toBe(403)
    expect((await fn('accept', pb.jwt2, body)).status).toBe(404)
    const wrong = await fn('accept', pa.jwt2, { ...body, shownPayoutCents: BOOKED.payout + 1 })
    expect(wrong, JSON.stringify(wrong)).toMatchObject({ status: 409, body: { error: 'payout_changed' } })
    expect(snap(W1)).toMatchObject({ status: 'requested', journal: [] })
    const ok = await fn('accept', pa.jwt2, body)
    expect(ok.status, JSON.stringify(ok)).toBe(200)
    const s1 = step('W1', '2 accept (pa, aal2)', W1)
    expect(s1.status).toBe('accepted')
    expect(s1.journal).toEqual([{ kind: 'booking', rev: false, ...BOOKED }])
    // N-12: Wiederholung nach verlorener Antwort = dieselbe Antwort ohne zweite Wirkung; andere Auszahlung bleibt 409
    expect(await fn('accept', pa.jwt2, body), 'Wiederholung').toEqual(ok)
    expect(await fn('accept', pa.jwt2, { ...body, shownPayoutCents: BOOKED.payout + 1 })).toMatchObject({ status: 409, body: { error: 'already_taken' } })
    expect((await fn('accept', pb.jwt2, { listingId: listingOf(W1, b), revisionId: rev1(W1), shownPayoutCents: BOOKED.payout })).status).toBe(409)
    expect(snap(W1).journal).toHaveLength(1)
  })

  live('start_job: fremde Firma und Kunde abgewiesen, Firma a startet; Auftrag läuft', async () => {
    expect((await pb.aal2.rpc('start_job', { p_request: W1 })).error?.message).toBe('not_assigned')
    expect((await cust.db.rpc('start_job', { p_request: W1 })).error).not.toBeNull()
    expect((await pa.aal1.rpc('start_job', { p_request: W1 })).error?.message).toBe('mfa_required')
    expect((await pa.aal2.rpc('start_job', { p_request: W1 })).error).toBeNull()
    expect(step('W1', '3 start_job (pa, aal2)', W1).status).toBe('in_progress')
  })

  live('Beleg-Upload (photo-receipt): Rechte, Nicht-JPEG; echter Upload ergibt eine Zeile receipt/ready von Firma a', async () => {
    expect((await upload(null, W1)).status).toBe(401)
    expect((await upload(pa.jwt1, W1)).status).toBe(403)
    expect((await upload(cust.jwt, W1)).status).toBe(403)
    expect((await upload(pb.jwt2, W1)).status).toBe(404)
    const notJpeg = await upload(pa.jwt2, W1, new TextEncoder().encode('kein bild'))
    expect(notJpeg, JSON.stringify(notJpeg)).toMatchObject({ status: 422, body: { error: 'not_jpeg' } })
    expect(photosOf(W1)).toHaveLength(0)
    const jpg = await new Image(16, 16).fill(Image.rgbToColor(40 + ctx.receipts.length * 50, 120, 200)).encodeJPEG({ quality: 80 })
    const ok = await upload(pa.jwt2, W1, jpg)
    expect(ok.status, JSON.stringify(ok)).toBe(200)
    ctx.receipts.push(String(ok.body.id))
    // bl1 (n12-1): dieselbe Datei noch einmal (verlorene Antwort): dieselbe Id, keine zweite Zeile
    const again = await upload(pa.jwt2, W1, jpg)
    expect(again, JSON.stringify(again)).toMatchObject({ status: 200, body: { id: ok.body.id } })
    expect(photosOf(W1)).toHaveLength(1)
    const row = ownerSql(`select kind, status, uploaded_partner_id::text as p, (select count(*) from storage.objects o where o.bucket_id = 'job-photos' and o.name = j.storage_path) as obj from public.job_photos j where id = '${ok.body.id}'`)[0]
    expect(row).toMatchObject({ kind: 'receipt', status: 'ready', p: partnerA })
    expect(Number(row?.obj)).toBe(1)
    ist(`W1 | 4 Beleg | id=${ok.body.id} receipt/ready, Objekt im Bucket: ${row?.obj}`)
  })

  live('Nachtrag: Vorschau T, Anlegen mit gezeigtem Betrag; Journal bleibt bei der Buchung', async () => {
    const prev = await fn('change-propose', pa.jwt2, { requestId: W1, changes: { hours: 6 }, preview: true })
    expect(prev.status, JSON.stringify(prev)).toBe(200)
    ctx.t1 = Number(prev.body.totalCents)
    expect(prev.body.baseCents).toBe(BOOKED.total)
    expect(ctx.t1).toBe(BOOKED.total + 7080) // 6 statt 5 Stunden: eine Stunde zu 7.080 ct (tests/unit/pricing.test.ts:31), unabhängig von der Antwort
    ist(`W1 | 5a Vorschau | totalCents=${ctx.t1} baseCents=${prev.body.baseCents}`)
    const real = await fn('change-propose', pa.jwt2, { requestId: W1, changes: { hours: 6 }, photoIds: photosOf(W1), shownTotalCents: ctx.t1 })
    expect(real, JSON.stringify(real)).toMatchObject({ status: 200, body: { totalCents: ctx.t1 } })
    const s = step('W1', '5b change-propose', W1)
    expect(s.status).toBe('in_progress')
    expect(kinds(s)).toEqual(['booking+'])
    expect(Number(ownerSql(`select total_cents from public.price_revisions where request_id = '${W1}' and status = 'proposed'`)[0]?.total_cents)).toBe(ctx.t1)
  })

  live('Zustimmung des Kunden: Zeile change = unabhängig gerechnete Summe minus Buchung (auch splitChange); Kunde sieht den Betrag', async () => {
    const rev = String(ownerSql(`select id from public.price_revisions where request_id = '${W1}' and status = 'proposed'`)[0]?.id)
    // unabhängiger Rechner: Postgres (private.fee_cents der Staffelversion), netto = round(Gebühr / (1 + USt.))
    const calc = ownerSql(`select private.fee_cents(${feeVersion}, ${ctx.t1}) as fee, round(private.fee_cents(${feeVersion}, ${ctx.t1})::numeric / (1 + ${rates.vatRate}::numeric))::bigint as net`)[0]!
    const fee = Number(calc.fee)
    const net = Number(calc.net)
    const want: Money = { total: ctx.t1 - BOOKED.total, fee: fee - BOOKED.fee, net: net - BOOKED.net, vat: fee - net - BOOKED.vat, payout: ctx.t1 - fee - BOOKED.payout }
    ctx.change1 = want
    expect((await fn('change-decide', pa.jwt2, { revisionId: rev, decision: 'accept', shownTotalCents: ctx.t1 })).status).toBe(404)
    expect(await fn('change-decide', cust.jwt, { revisionId: rev, decision: 'accept', shownTotalCents: ctx.t1 + 1 })).toEqual({ status: 409, body: { error: 'amount_changed' } })
    expect(await fn('change-decide', cust.jwt, { revisionId: rev, decision: 'accept', shownTotalCents: ctx.t1 })).toEqual({ status: 200, body: { status: 'accepted' } })
    const s = step('W1', '6 change-decide accept (Kunde)', W1)
    expect(s.journal).toHaveLength(2)
    expect(s.journal[1]).toEqual({ kind: 'change', rev: false, ...want })
    const c = splitChange(ctx.t1, rates, splitFee(BOOKED.total, rates))
    expect([c.feeCents, c.feeNetCents, c.feeVatCents, c.payoutCents]).toEqual([want.fee, want.net, want.vat, want.payout])
    for (const j of s.journal) expect([j.net + j.vat, j.total - j.fee]).toEqual([j.fee, j.payout])
    expect(sum(s.journal).total).toBe(ctx.t1)
  })

  live('Abschluss: vorher keine Zeile in my_commissions, Kunde schließt ab, danach cancel-partner 404 und Zustand unverändert', async () => {
    const before = await pa.aal2.rpc('my_commissions')
    expect((before.data ?? []).filter((r) => r.request_id === W1)).toHaveLength(0)
    expect((await cust.db.rpc('complete_job', { p_request: W1 })).error).toBeNull()
    const s = step('W1', '7 complete_job (Kunde)', W1)
    expect(s.status).toBe('completed')
    expect(kinds(s)).toEqual(['booking+', 'change+'])
    const after = snap(W1)
    expect(await fn('cancel-partner', pa.jwt2, { requestId: W1, reason: 'scope_impossible', shownCallOutCents: 0 })).toEqual({ status: 404, body: { error: 'not_found' } })
    expect(snap(W1)).toEqual(after)
  })
})

describe('W2a Storno ohne Pauschale vor dem Termin (Termin in 14 Tagen)', () => {
  live('accept, job_contact (1 Zeile), cancel-partner unavailable: Gegenbuchung, Summe 0, job_contact gesperrt, eine Folgeanfrage ohne Listing für Firma a', async () => {
    expect((await fn('accept', pa.jwt2, { listingId: listingOf(W2A, partnerA), revisionId: rev1(W2A), shownPayoutCents: BOOKED.payout })).status).toBe(200)
    expect(step('W2A', '1 accept', W2A).status).toBe('accepted')
    const c = await contact(pa.aal2, W2A)
    expect(c.error).toBeNull()
    expect(c.data).toHaveLength(1)
    expect(c.data?.[0]?.name).toBe('Karl Kunde')
    const r = await fn('cancel-partner', pa.jwt2, { requestId: W2A, reason: 'unavailable', shownCallOutCents: 0 })
    expect(r, JSON.stringify(r)).toEqual({ status: 200, body: { status: 'cancelled_by_partner', callOutCents: 0 } })
    const s = step('W2A', '2 cancel-partner unavailable', W2A)
    expect(s.status).toBe('cancelled_by_partner')
    expect(kinds(s)).toEqual(['booking+', 'cancellation-'])
    expect(sum(s.journal)).toEqual(ZERO)
    expect(s.journal[1]).toEqual({ kind: 'cancellation', rev: true, total: -BOOKED.total, fee: -BOOKED.fee, net: -BOOKED.net, vat: -BOOKED.vat, payout: -BOOKED.payout })
    expect((await contact(pa.aal2, W2A)).error?.message).toBe('not_assigned')
    expect(s.followups).toBe(1)
    expect(Number(ownerSql(`select count(*) as n from public.job_listings where partner_id = '${partnerA}' and request_id = (select id from public.service_requests where reissued_from = '${W2A}')`)[0]?.n)).toBe(0)
  })
})

describe('W2b Storno ohne Pauschale nach dem Start (Termin vor 2 Stunden)', () => {
  live('accept, start, unavailable nach dem Termin 409, scope_impossible ohne Beleg: Summe 0, job_contact gesperrt, keine Folgeanfrage', async () => {
    expect((await fn('accept', pa.jwt2, { listingId: listingOf(W2B, partnerA), revisionId: rev1(W2B), shownPayoutCents: BOOKED.payout })).status).toBe(200)
    expect((await pa.aal2.rpc('start_job', { p_request: W2B })).error).toBeNull()
    // bl1 (OFFEN rs1-3): der Cron `complete-due` (alle 5 Minuten) legt für eine Anfrage nach dem Termin die Outbox-Zeile `completion_ask` an, wann immer er läuft.
    // Der Test stellt diesen Zustand selbst her und prüft, dass er da ist, statt auf den Cron zu treffen: danach ist `complete_due()` wirkungslos (`on conflict do nothing`).
    ownerSql('select public.complete_due()')
    expect(snap(W2B).outbox.completion_ask, 'completion_ask nach complete_due').toBe(1)
    const run = step('W2B', '1 accept, start_job', W2B)
    expect(run.status).toBe('in_progress')
    expect(await fn('cancel-partner', pa.jwt2, { requestId: W2B, reason: 'unavailable', shownCallOutCents: 0 })).toEqual({ status: 409, body: { error: 'too_late_for_reason' } })
    expect(snap(W2B)).toEqual(run)
    const r = await fn('cancel-partner', pa.jwt2, { requestId: W2B, reason: 'scope_impossible', shownCallOutCents: 0 })
    expect(r, JSON.stringify(r)).toEqual({ status: 200, body: { status: 'cancelled_by_partner', callOutCents: 0 } })
    const s = step('W2B', '2 cancel-partner scope_impossible ohne Beleg', W2B)
    expect(s.status).toBe('cancelled_by_partner')
    expect(kinds(s)).toEqual(['booking+', 'cancellation-'])
    expect(sum(s.journal)).toEqual(ZERO)
    expect((await contact(pa.aal2, W2B)).error?.message).toBe('not_assigned')
    expect(s.followups).toBe(0)
    expect(s.outbox.partner_cancelled).toBe(1)
  })
})

describe('W3 Storno mit Pauschale: Nachtrag abgelehnt, scope_impossible, Beleg (Termin vor 2 Stunden)', () => {
  live('accept, start, Beleg, Nachtrag, Kunde lehnt ab; Vorschau 6.900 / 5.865; Storno bucht genau eine Pauschale', async () => {
    expect((await fn('accept', pa.jwt2, { listingId: listingOf(W3, partnerA), revisionId: rev1(W3), shownPayoutCents: BOOKED.payout })).status).toBe(200)
    expect((await pa.aal2.rpc('start_job', { p_request: W3 })).error).toBeNull()
    const up = await upload(pa.jwt2, W3)
    expect(up.status, JSON.stringify(up)).toBe(200)
    ctx.receipts.push(String(up.body.id))
    const prev = await fn('change-propose', pa.jwt2, { requestId: W3, changes: { hours: 6 }, preview: true })
    ctx.t3 = Number(prev.body.totalCents)
    expect((await fn('change-propose', pa.jwt2, { requestId: W3, changes: { hours: 6 }, photoIds: photosOf(W3), shownTotalCents: ctx.t3 })).status).toBe(200)
    const rev = String(ownerSql(`select id from public.price_revisions where request_id = '${W3}' and status = 'proposed'`)[0]?.id)
    expect(await fn('change-decide', cust.jwt, { revisionId: rev, decision: 'decline' })).toEqual({ status: 200, body: { status: 'declined' } })
    expect(step('W3', '1 accept, start, Beleg, Nachtrag, abgelehnt', W3)).toMatchObject({ status: 'in_progress', revisions: 2 })
    const pv = await fn('cancel-partner', pa.jwt2, { requestId: W3, reason: 'scope_impossible', preview: true })
    expect(pv).toEqual({ status: 200, body: { callOutCents: CALL_OUT.total, payoutCents: CALL_OUT.payout } })
    const r = await fn('cancel-partner', pa.jwt2, { requestId: W3, reason: 'scope_impossible', photoIds: photosOf(W3), shownCallOutCents: CALL_OUT.total })
    expect(r, JSON.stringify(r)).toEqual({ status: 200, body: { status: 'cancelled_by_partner', callOutCents: CALL_OUT.total } })
    const s = step('W3', '2 cancel-partner mit Pauschale', W3)
    expect(s.status).toBe('cancelled_by_partner')
    // Gegenbuchung und Pauschale entstehen in einer Transaktion (gleicher Zeitstempel): Reihenfolge nicht festgelegt, daher sortiert vergleichen
    expect(kinds(s).sort()).toEqual(['booking+', 'cancellation-', 'cancellation_fee+'])
    expect(s.journal.find((j) => j.kind === 'cancellation_fee')).toEqual({ kind: 'cancellation_fee', rev: false, ...CALL_OUT })
    expect(sum(s.journal)).toEqual(CALL_OUT)
    expect(s.followups).toBe(0)
    expect(s.outbox.partner_cancelled_fee).toBe(1)
    expect((await cust.db.rpc('my_cancel_info', { p_request: W3 })).data).toBe(CALL_OUT.total)
    const c = await contact(pa.aal2, W3)
    expect(c.error).toBeNull()
    expect(c.data).toHaveLength(1)
    expect(c.data?.[0]?.name).toBe('Karl Kunde')
    expect((await contact(pb.aal2, W3)).error?.message).toBe('not_assigned')
  })
})

describe('W4 Storno durch den Kunden vor dem Termin ohne Gebühr (Termin in 14 Tagen), Edge cancel-customer', () => {
  live('accept, Vorschau 0, falscher Betrag 409, Storno: Gegenbuchung, Summe 0, job_contact gesperrt (Nr. 154)', async () => {
    expect((await fn('accept', pa.jwt2, { listingId: listingOf(W4, partnerA), revisionId: rev1(W4), shownPayoutCents: BOOKED.payout })).status).toBe(200)
    expect(step('W4', '1 accept', W4).status).toBe('accepted')
    expect((await fn('cancel-customer', null, { requestId: W4, shownFeeCents: 0 })).status).toBe(401)
    expect((await fn('cancel-customer', pa.jwt2, { requestId: W4, shownFeeCents: 0 })).status).toBe(404) // Firma ist nicht der Kunde: not_found, kein Hinweis auf die Anfrage
    const pv = await fn('cancel-customer', cust.jwt, { requestId: W4, preview: true })
    expect(pv, JSON.stringify(pv)).toEqual({ status: 200, body: { cancelFeeCents: 0 } })
    const wrong = await fn('cancel-customer', cust.jwt, { requestId: W4, shownFeeCents: 100 })
    expect(wrong, JSON.stringify(wrong)).toMatchObject({ status: 409, body: { error: 'cancel_fee_changed', cancelFeeCents: 0 } })
    expect(snap(W4).status).toBe('accepted')
    const r = await fn('cancel-customer', cust.jwt, { requestId: W4, shownFeeCents: 0 })
    expect(r, JSON.stringify(r)).toEqual({ status: 200, body: { status: 'cancelled_by_customer', cancelFeeCents: 0 } })
    // n12b: Wiederholung nach verlorener Antwort: dasselbe Ergebnis; mit anderer gezeigter Gebühr oder von der Firma bleibt es 409 bzw. 404, nie ein Betrag
    expect(await fn('cancel-customer', cust.jwt, { requestId: W4, shownFeeCents: 0 })).toEqual(r)
    expect(await fn('cancel-customer', cust.jwt, { requestId: W4, shownFeeCents: 100 })).toEqual({ status: 409, body: { error: 'invalid_transition' } })
    expect((await fn('cancel-customer', pa.jwt2, { requestId: W4, shownFeeCents: 0 })).status).toBe(404)
    const s = step('W4', '2 cancel-customer', W4)
    expect(s.status).toBe('cancelled_by_customer')
    expect(kinds(s)).toEqual(['booking+', 'cancellation-'])
    expect(sum(s.journal)).toEqual(ZERO)
    // 0065 (Nr. 154): auch nach kostenlosem Storno durch den Kunden ist job_contact sofort gesperrt
    const c = await contact(pa.aal2, W4)
    expect(c.error?.message).toBe('not_assigned')
    expect(c.data).toBeNull()
  })
})

describe('W5 Angebot: Firma sendet, Kunde bestätigt über die Edge offer-confirm', () => {
  live('send_offer, Bestätigung mit falschem Betrag 409, dann 200: eine Buchung über den Angebotsbetrag', async () => {
    const lst = listingOf(W5, partnerA)
    expect(step('W5', '1 Anfrage (Fixture, Spanne)', W5)).toMatchObject({ status: 'awaiting_offer', journal: [] })
    expect((await pa.aal1.rpc('send_offer', { p_listing: lst, p_amount: OFFER.total })).error?.message).toBe('mfa_required')
    const sent = await pa.aal2.rpc('send_offer', { p_listing: lst, p_amount: OFFER.total })
    expect(sent.error, JSON.stringify(sent.error)).toBeNull()
    expect(step('W5', '2 send_offer (pa, aal2)', W5)).toMatchObject({ status: 'offered', journal: [] })
    const offer = String(ownerSql(`select id from public.partner_offers where request_id = '${W5}' and partner_id = '${partnerA}'`)[0]?.id)
    const body = { offerId: offer, shownAmountCents: OFFER.total }
    expect((await fn('offer-confirm', null, body)).status).toBe(401)
    expect((await fn('offer-confirm', pa.jwt2, body)).status, 'Firma ist nicht der Kunde').toBe(404)
    const wrong = await fn('offer-confirm', cust.jwt, { ...body, shownAmountCents: OFFER.total + 1 })
    expect(wrong, JSON.stringify(wrong)).toMatchObject({ status: 409, body: { error: 'amount_changed' } })
    expect(snap(W5).journal).toEqual([])
    const ok = await fn('offer-confirm', cust.jwt, body)
    expect(ok, JSON.stringify(ok)).toEqual({ status: 200, body: { status: 'confirmed' } })
    const s = step('W5', '3 offer-confirm (Kunde)', W5)
    expect(s.status).toBe('accepted')
    expect(s.journal).toEqual([{ kind: 'booking', rev: false, ...OFFER }])
    expect((await contact(pa.aal2, W5)).data).toHaveLength(1)
  })
})

type Row = { entry_id: string; request_id: string; kind: string; reverses_entry_id: string | null; created_at: string; total_cents: number; fee_schedule: string; fee_net_cents: number; fee_vat_cents: number; fee_cents: number; payout_cents: number; billing_month: string; partner_id: string }
const mine = async (db: Aal2User['aal2']) => ((await (db.rpc('my_commissions') as unknown as Promise<{ data: Row[] | null; error: { code: string; message: string } | null }>)))
// Journal-Summen nur für W1 bis W5; W6 und W7 (s9k-1, Meldung) haben eigene Zeilen und gehören nicht in die Erwartung
const own = (rows: Row[] | null) => (rows ?? []).filter((r) => ([W1, W2A, W2B, W3, W4, W5] as string[]).includes(r.request_id))
const total = (rows: Row[], req: string): Money => sum(rows.filter((r) => r.request_id === req).map((r) => ({ total: r.total_cents, fee: r.fee_cents, net: r.fee_net_cents, vat: r.fee_vat_cents, payout: r.payout_cents })))
const cents = (s: string) => { const m = /^(-?)(\d+),(\d{2})$/.exec(s); if (!m) throw new Error(`Betrag ${s}`); return (m[1] ? -1 : 1) * (Number(m[2]) * 100 + Number(m[3])) }

describe('W6 Meldung „nicht stattgefunden“ während des Auftrags (Z1 → Z2), W7 nach dem Abschluss der Firma (Z3 → Z4); s9k-1', () => {
  const accept = async (req: string) => expect((await fn('accept', pa.jwt2, { listingId: listingOf(req, partnerA), revisionId: rev1(req), shownPayoutCents: BOOKED.payout })).status).toBe(200)
  const jobOf = async (req: string) => (await pa.aal2.rpc('my_jobs')).data?.find((j) => j.request_id === req)
  const info = async (req: string) => (await cust.db.rpc('my_report_info', { p_request: req })).data?.[0]

  live('W6: Frage offen (Server), Kunde meldet, die Firma ist gesperrt (Abschluss, Nachtrag) und sieht nur „in Prüfung“', async () => {
    await accept(W6)
    const eta = await pa.aal2.rpc('set_en_route', { p_request: W6, p_minutes: 15 }) // mail1: Ereignis „Unterwegs“, Zeile in der Outbox
    expect(eta.error).toBeNull()
    expect(new Date(String(eta.data)).getTime()).toBeGreaterThan(Date.now())
    expect((await pa.aal2.rpc('start_job', { p_request: W6 })).error).toBeNull()
    expect(await info(W6)).toMatchObject({ can_report: true })
    expect((await info(W6))?.report_until).toBeTruthy()
    expect((await pa.aal2.rpc('report_not_done', { p_request: W6 })).error).not.toBeNull() // Firma ist nicht der Kunde
    expect((await cust.db.rpc('report_not_done', { p_request: W6 })).error).toBeNull()
    const s = step('W6', '1 accept, start_job, report_not_done (Kunde)', W6)
    expect(s.status).toBe('in_progress')
    expect(await info(W6)).toMatchObject({ can_report: false, report_until: null })
    expect((await pa.aal2.rpc('complete_job', { p_request: W6 })).error?.message).toBe('under_review')
    expect(await fn('change-propose', pa.jwt2, { requestId: W6, changes: { hours: 6 }, preview: true })).toEqual({ status: 409, body: { error: 'under_review' } })
    expect(await jobOf(W6)).toMatchObject({ under_review: true, status: 'in_progress', can_start: false })
    expect(snap(W6)).toEqual(s)
    expect((await cust.db.rpc('complete_job', { p_request: W6 })).error?.message).toBe('invalid_transition')
    // mail1, Live-Beleg der Kette Ereignis → Outbox → Cron → outbox-send: Der Cron holt die Zeilen „en_route“ und „report_new“. Kunde und Konten sind Testkonten
    // (.test, Auth-API) und der Dev-Schutz überspringt sie: Endzustand erledigt, ein Versuch, kein Fehlercode. Das setzt voraus, dass die Adresse und (bei „Unterwegs“)
    // die Ankunftszeit mit dem Secret Key gelesen wurden; ein Lesefehler ließe die Zeile wartend mit Fehlercode zurück.
    const rows = async () => ownerSql(`select kind, status, attempts, coalesce(last_error, '-') as err from public.outbox where request_id = '${W6}' and kind in ('en_route', 'report_new') order by kind`)
      .map((r) => ({ kind: String(r.kind), status: String(r.status), attempts: Number(r.attempts), err: String(r.err) }))
    let outbox = await rows()
    for (let i = 0; i < 24 && (outbox.length < 2 || outbox.some((r) => r.status !== 'sent')); i++) {
      await new Promise((res) => setTimeout(res, 5000))
      outbox = await rows()
    }
    ist(`W6 | Outbox durch den Cron (en_route, report_new) | ${JSON.stringify(outbox)}`)
    expect(outbox).toEqual([{ kind: 'en_route', status: 'sent', attempts: 1, err: '-' }, { kind: 'report_new', status: 'sent', attempts: 1, err: '-' }])
  })

  live('W7: Firma schließt ab, der Kunde kann noch melden (Server-Signal), danach in Prüfung', async () => {
    await accept(W7)
    expect((await pa.aal2.rpc('start_job', { p_request: W7 })).error).toBeNull()
    expect((await pa.aal2.rpc('complete_job', { p_request: W7 })).error).toBeNull()
    expect(step('W7', '1 accept, start_job, complete_job (Firma)', W7).status).toBe('completed')
    expect(await info(W7)).toMatchObject({ can_report: true })
    expect(await jobOf(W7)).toMatchObject({ under_review: false })
    expect((await cust.db.rpc('report_not_done', { p_request: W7 })).error).toBeNull()
    expect(step('W7', '2 report_not_done (Kunde, nach completed)', W7).status).toBe('completed')
    expect(await info(W7)).toMatchObject({ can_report: false })
    expect(await jobOf(W7)).toMatchObject({ under_review: true, status: 'completed' })
  })

  live('my_report_info: fremde Konten und Firma bekommen not_found', async () => {
    expect((await pa.aal2.rpc('my_report_info', { p_request: W7 })).error?.message).toBe('not_found')
    expect((await pb.aal2.rpc('my_report_info', { p_request: W7 })).error?.message).toBe('not_found')
  })
})

describe('Journal: Summen aus my_commissions und aus der Datei, Rechte, Gebühr unsichtbar, payment_hold', () => {
  live('Summe je Auftrag aus my_commissions UND aus journalCsv gleich und = Erwartung (W1 = T, W2A 0, W2B 0, W3 Pauschale 6.900, W4 0, W5 noch keine Zeile)', async () => {
    const r = await mine(pa.aal2)
    expect(r.error).toBeNull()
    const rows = own(r.data)
    const wantW1 = ctx.change1!
    const w1: Money = { total: BOOKED.total + wantW1.total, fee: BOOKED.fee + wantW1.fee, net: BOOKED.net + wantW1.net, vat: BOOKED.vat + wantW1.vat, payout: BOOKED.payout + wantW1.payout }
    const want: [string, Money][] = [[W1, w1], [W2A, ZERO], [W2B, ZERO], [W3, CALL_OUT], [W4, ZERO], [W5, ZERO /* angenommen, nicht abgeschlossen: noch keine Abrechnungszeile (wie W1 vor complete_job) */]]
    const csv = journalCsv(rows as never)
    writeFileSync('tmp/reports/flow-live.csv', csv)
    const lines = csv.split('\r\n').filter(Boolean)
    expect(lines).toHaveLength(rows.length + 1)
    const counts: Record<string, number> = { [W1]: 2, [W2A]: 2, [W2B]: 2, [W3]: 3, [W4]: 2, [W5]: 0 } // Zeilen je Auftrag: Buchung, Nachtrag, Gegenbuchung, Pauschale
    expect(rows).toHaveLength(11)
    for (const [req, w] of want) {
      expect(rows.filter((x) => x.request_id === req), `Zeilen ${req}`).toHaveLength(counts[req]!)
      expect(total(rows, req), `my_commissions ${req}`).toEqual(w)
      const cs = lines.slice(1).map((l) => l.split(';')).filter((c) => c[2] === req)
      const fromCsv: Money = { total: 0, fee: 0, net: 0, vat: 0, payout: 0 }
      for (const c of cs) {
        fromCsv.total += cents(c[5]!)
        fromCsv.net += cents(c[7]!)
        fromCsv.vat += cents(c[8]!)
        fromCsv.fee += cents(c[9]!)
        fromCsv.payout += cents(c[10]!)
      }
      expect(fromCsv, `Datei ${req}`).toEqual(w)
      ist(`SUMME ${req === W1 ? 'W1' : req === W2A ? 'W2A' : req === W2B ? 'W2B' : req === W3 ? 'W3' : req === W4 ? 'W4' : 'W5'} | my_commissions=${JSON.stringify(total(rows, req))} | csv=${JSON.stringify(fromCsv)} | erwartet=${JSON.stringify(w)}`)
    }
    expect(w1.total).toBe(ctx.t1)
    expect(csv).not.toContain(cust.id)
    for (const x of rows) expect(x.partner_id).toBe(partnerA)
    // Monat: Wiener Monat bei Laufbeginn oder -ende (beide aus der DB-Uhr), die Formel wird nicht nachgebaut
    const monthEnd = String(ownerSql(`select to_char(now() at time zone 'Europe/Vienna', 'YYYY-MM') as m`)[0]?.m)
    for (const x of rows) expect([`${monthStart}-01`, `${monthEnd}-01`], `${x.entry_id} ${x.billing_month}`).toContain(x.billing_month)
  })

  live('Rechte: anon 42501; Kunde und aal1 mfa_required; fremde Firma sieht keine Zeile der Aufträge', async () => {
    const a = await (anon.rpc('my_commissions') as unknown as Promise<{ error: { code: string } | null }>)
    expect(a.error?.code).toBe('42501')
    expect((await mine(cust.db)).error?.message).toBe('mfa_required')
    expect((await mine(pa.aal1)).error?.message).toBe('mfa_required')
    const b = await mine(pb.aal2)
    expect(b.error).toBeNull()
    ist(`RECHTE | fremde Firma b: Zeilen der Aufträge=${own(b.data).length}, gesamt=${b.data?.length}`)
    expect(own(b.data)).toHaveLength(0)
  })

  live('Kunde und Dritte lesen keine Gebühr: commission_entries leer, Satz und Staffel nicht lesbar, Snapshot des Nachtrags ohne Gebührenfelder', async () => {
    const empty = (r: { data: unknown[] | null; error: { code?: string } | null }) => expect(r.error?.code === '42501' || (r.data ?? []).length === 0).toBe(true)
    // Positivkontrolle: dieselbe Abfrage liefert der Firma a mit aal2 Zeilen (sonst bewiese „leer“ nichts)
    expect(((await pa.aal2.from('commission_entries').select('id').in('request_id', OURS)).data ?? []).length).toBeGreaterThan(0)
    empty(await cust.db.from('commission_entries').select('id').in('request_id', OURS))
    empty(await pb.aal2.from('commission_entries').select('id').in('request_id', OURS))
    empty(await pa.aal1.from('commission_entries').select('id').in('request_id', OURS))
    empty(await cust.db.from('platform_settings').select('key').eq('key', 'fee_rate'))
    empty(await cust.db.from('fee_schedules').select('version'))
    empty(await cust.db.from('fee_schedule_tiers').select('version'))
    const snaps = await cust.db.from('price_revisions').select('snapshot').eq('request_id', W1).eq('source', 'change_order')
    expect(snaps.data ?? []).toHaveLength(1)
    expect(JSON.stringify(snaps.data)).not.toMatch(/payout|commission|provision|fee_rate|fee_tiers|fee_schedule|feeCents|fee_net/i)
  })

  live('payment_hold: Firma a (Testfirma dieses Laufs mit Journalzeilen) wird gesetzt, my_commissions liefert dieselben Zeilen und Summen', async () => {
    const meta = ownerSql(`select p.status::text as st, p.contact_email as mail, p.name, (select count(*) from public.commission_entries c where c.partner_id = p.id and c.request_id <> all (array['${OURS.join("','")}']::uuid[])) as fremd
      from public.partners p where p.id = '${partnerA}'`)[0]!
    expect([meta.st, meta.mail, Number(meta.fremd)]).toEqual(['active', FIRM_MAIL, 0])
    expect(meta.name).not.toBe(COVER_FIRM)
    const key = (rows: Row[] | null) => own(rows).map((x) => `${x.entry_id}|${x.kind}|${x.total_cents}|${x.fee_cents}|${x.payout_cents}`).sort()
    const before = key((await mine(pa.aal2)).data)
    expect(before.length).toBeGreaterThanOrEqual(8)
    const set = ownerSql(`select public.admin_set_partner_status('${adm}', p.id, 'payment_hold', 'Test payment_hold s9i-7c2 Durchgang') from public.partners p where p.id = '${partnerA}' and p.contact_email = '${FIRM_MAIL}'`)
    expect(set).toHaveLength(1)
    expect(Number(ownerSql(`select count(*) as n from public.audit_log where actor_id = '${adm}' and action = 'set_partner_status' and entity_id = '${partnerA}'`)[0]?.n)).toBe(1)
    expect(String(ownerSql(`select status::text as st from public.partners where id = '${partnerA}'`)[0]?.st)).toBe('payment_hold')
    const after = await mine(pa.aal2)
    expect(after.error).toBeNull()
    expect(key(after.data)).toEqual(before)
    ist(`PAYMENT_HOLD | Zeilen vorher=${before.length} nachher=${key(after.data).length} (gleich)`)
  })
})
