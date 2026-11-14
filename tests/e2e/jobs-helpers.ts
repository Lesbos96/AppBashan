import type { Page, Route } from '@playwright/test'
import { cors, reply, rest } from './backend'
import { factor, openPartner, type OpenOpts } from './mfa-helpers'

/*
 * Gemockte Partner-Anfragen (s9i-6a): `job_listings`, `partner_offers`, RPC `payout_preview` (s9p-1), Functions `accept` und `job-photo`, RPC `send_offer`
 * und `withdraw_offer`. Der Mock legt absichtlich fremde Schlüssel in `inputs` (Adresse, Telefon): die Oberfläche zeigt nur die Whitelist.
 * Was der Server erzwingt (Sichtbarkeit, Beträge, Wettlauf), belegen tests/rls/*.
 */

export const L1 = '0b8f1c3e-5d2a-4e7b-9a61-3c4d5e6f7a8b'
export const L2 = '2d1a3b4c-7e8f-4a9b-8c7d-6e5f4a3b2c1d'
export const REV1 = '1c9f2d4e-6e3b-4f8c-8b72-4d5e6f7a8b9c'
export const REV2 = '3e2b4c5d-8f9a-4b0c-9d8e-7f6a5b4c3d2e'
export const O1 = '4f3c5d6e-9a0b-4c1d-8e9f-8a7b6c5d4e3f'
export const PHOTO = '5a4d6e7f-0b1c-4d2e-9f0a-9b8c7d6e5f4a'
export const SENTINEL = { address: 'Teststraße 12/4', phone: '0660 1234567', name: 'Erika Mustermann' }

export type ListingRow = {
  id: string
  revision_id: string
  status: 'open' | 'accepted'
  district: number
  to_district: number | null
  service: 'transport' | 'move' | 'clearance' | 'assembly'
  inputs: Record<string, unknown>
  volume_m3: number | null
  preferred_date: string | null
  time_window: string | null
  total_cents: number | null
  low_cents: number | null
  high_cents: number | null
  accept_deadline: string
}
/** Zeile von `my_jobs()` (Migration 0057): ohne Name, Adresse, Telefon, E-Mail. */
export type JobRow = {
  assignment_id: string
  request_id: string
  listing_id: string | null
  status: 'accepted' | 'in_progress' | 'completed' | 'cancelled_by_customer' | 'cancelled_by_partner'
  termin_at: string
  accepted_at: string
  ended_at: string | null
  ended_reason: string | null
  district: number | null
  to_district: number | null
  service: 'transport' | 'move' | 'clearance' | 'assembly'
  preferred_date: string | null
  time_window: string | null
  total_cents: number | null
  payout_cents: number | null
  can_start: boolean
}
export const A1 = '6b5e7f80-1c2d-4e3f-a01b-0c9d8e7f6a5b'
export const A2 = '7c6f8091-2d3e-4f40-b12c-1d0e9f8a7b6c'
export const RQ1 = '8d70a1a2-3e4f-4051-a23d-2e1f0a9b8c7d'
export const RQ2 = '9e81b2b3-4f50-4162-b34e-3f2a1b0c9d8e'
/** Angenommener Umzug in Bezirk 3 (Ziel 10), Termin 2. Dezember 2026, 08:00 Uhr Wiener Zeit; 689,61 € mit Auszahlung 586,17 €; noch nicht startbar */
export const job = (over: Partial<JobRow> = {}): JobRow => ({
  assignment_id: A1,
  request_id: RQ1,
  listing_id: L1,
  status: 'accepted',
  termin_at: '2026-12-02T07:00:00+00:00',
  accepted_at: '2026-11-20T10:00:00+00:00',
  ended_at: null,
  ended_reason: null,
  district: 3,
  to_district: 10,
  service: 'move',
  preferred_date: '2026-12-02',
  time_window: 'morning',
  total_cents: 68961,
  payout_cents: 58617,
  can_start: false,
  ...over,
})
/** Antwort von `job_contact`: erfundene Platzhalterdaten */
export const CONTACT = { name: 'Erika Beispiel', phone: '+43 660 1234567', email: 'erika@beispiel.test', stairs_door: '3. Stock, Tür 4', from_address: 'Beispielgasse 12, 1030 Wien', to_address: 'Musterweg 5, 1100 Wien', preferred_date: '2026-12-02', time_window: 'morning' }
/** Fehlerantwort einer RPC wie PostgREST (`raise exception 'code'`) */
export const pgErr = (code: string, status = 400): Ans => ({ status, json: { code: 'P0001', message: code, details: null, hint: null } })

/** Zeile von `my_job_changes()` (Migration 0058): Preisgrundlage und letzter eigener Nachtrag; ohne Name, Adresse, Gebühr. */
export type ChangeRow = {
  request_id: string
  service: 'transport' | 'move' | 'clearance' | 'assembly'
  source: string
  inputs: Record<string, unknown>
  total_cents: number | null
  change_id: string | null
  change_status: 'proposed' | 'accepted' | 'declined' | 'expired' | 'withdrawn' | null
  change_total_cents: number | null
  change_valid_until: string | null
  change_decided_at: string | null
  receipt_ids: string[]
}
export const CH1 = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
export const RC1 = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'
const MOVE_INPUTS = { service: 'move', goods: 'normal', crew: 2, vehicles: 1, vehicleType: 'van', hours: 3, fromFloor: 2, toFloor: 0, fromLift: false, toLift: true, boxes: 10, parking: 0, packing: false, assembly: null }
/** Preisgrundlage des Umzugs `RQ1` ohne Nachtrag: Festpreis 689,61 € aus der Buchung */
export const change = (over: Partial<ChangeRow> = {}): ChangeRow => ({
  request_id: RQ1,
  service: 'move',
  source: 'submit',
  inputs: { ...MOVE_INPUTS },
  total_cents: 68961,
  change_id: null,
  change_status: null,
  change_total_cents: null,
  change_valid_until: null,
  change_decided_at: null,
  receipt_ids: [],
  ...over,
})
/** Nachtrag der Firma in einem Zustand: neuer Gesamtpreis 810,00 € */
export const proposed = (status: NonNullable<ChangeRow['change_status']>, over: Partial<ChangeRow> = {}): ChangeRow =>
  change({ change_id: CH1, change_status: status, change_total_cents: 81000, change_valid_until: '2026-12-01T10:00:00+00:00', change_decided_at: status === 'proposed' ? null : '2026-11-30T10:00:00+00:00', receipt_ids: [RC1], ...over })

export type OfferRow = { id: string; base_revision_id: string; amount_cents: number; status: 'sent' | 'confirmed' | 'withdrawn' | 'expired' | 'superseded' | 'rejected'; valid_until: string }
export type Ans = { status: number; json: unknown }

const IN = (extra: Record<string, unknown> = {}) => ({ goods: 'normal', crew: 2, vehicles: 1, vehicleType: 'van', hours: 3, fromFloor: 2, toFloor: 0, fromLift: false, toLift: true, boxes: 10, parking: 0, packing: false, assembly: null, ...SENTINEL, ...extra })

/** Festpreis 689,61 € (Auszahlung bei 15 % und 20 %: 586,17 €) */
export const fixed = (over: Partial<ListingRow> = {}): ListingRow => ({
  id: L1,
  revision_id: REV1,
  status: 'open',
  district: 3,
  to_district: 10,
  service: 'transport',
  inputs: IN(),
  volume_m3: 4,
  preferred_date: '2026-12-02',
  time_window: 'morning',
  total_cents: 68961,
  low_cents: 68961,
  high_cents: 68961,
  accept_deadline: '2026-12-01T10:00:00Z',
  ...over,
})
/** Spanne 500 bis 900 € ohne Gesamtpreis: nur Angebot */
export const range = (over: Partial<ListingRow> = {}): ListingRow =>
  fixed({ id: L2, revision_id: REV2, service: 'clearance', to_district: null, volume_m3: null, inputs: { object: 'cellar', area: 30, fill: 'full', lift: false, floor: -1, special: false, assembly: null, ...SENTINEL }, total_cents: null, low_cents: 50000, high_cents: 90000, ...over })

export type JobsState = {
  listings: ListingRow[]
  offers: OfferRow[]
  /** Satz der Auszahlungsvorschau (`payout_preview`, Standard 15 %); ein Test ändert ihn wie der Server nach einer Staffeländerung */
  payoutRate: number
  /** true: `payout_preview` antwortet mit einem Fehler, die App zeigt dann keine Auszahlung */
  payoutFails: boolean
  accepts: Record<string, unknown>[]
  sends: Record<string, unknown>[]
  withdraws: Record<string, unknown>[]
  photoCalls: Record<string, unknown>[]
  /** URLs der Abrufe von `job_listings` und `partner_offers` (Spaltenliste prüfen) */
  urls: string[]
  /** Antworten für die nächsten Aufrufe (Warteschlangen); leer = Erfolg */
  acceptAnswers: Ans[]
  sendAnswers: Ans[]
  withdrawAnswers: Ans[]
  /** Aufträge der Firma (`my_jobs`); Start und Abschluss ändern sie wie der Server */
  myJobs: JobRow[]
  jobReads: number
  /** Statuscodes für die nächsten Abrufe von `my_jobs` (Warteschlange) */
  jobStatus: number[]
  starts: string[]
  completes: string[]
  contacts: string[]
  startAnswers: Ans[]
  completeAnswers: Ans[]
  contactAnswers: Ans[]
  /** Preisgrundlagen und Nachträge (`my_job_changes`); `change-propose` und `withdraw_change` ändern sie wie der Server */
  changes: ChangeRow[]
  changeReads: number
  /** Statuscodes für die nächsten Abrufe von `my_job_changes` (Warteschlange), z. B. 500 */
  changeStatus: number[]
  /** Gesamtpreis, den der gemockte Server für den Nachtrag berechnet (810,00 €) */
  serverTotal: number
  /** Alle Aufrufe von `change-propose` (Vorschau und Anlegen), Rohkörper */
  proposals: Record<string, unknown>[]
  previewAnswers: Ans[]
  proposeAnswers: Ans[]
  /** Hochgeladene Belege: Auftrag, Typ, Größe */
  receipts: { request: string | null; type: string | undefined; bytes: number }[]
  receiptAnswers: Ans[]
  withdrawnChanges: string[]
  withdrawChangeAnswers: Ans[]
  /** Absage (s9i-7b2): Pauschale in Cent, die der gemockte Server bei Grund `scope_impossible` meldet (sonst 0); Auszahlung = Pauschale − round(15 %) */
  callOut: number
  /** Alle Aufrufe von `cancel-partner` (Vorschau und Absage), Rohkörper */
  cancels: Record<string, unknown>[]
  cancelPreviewAnswers: Ans[]
  cancelAnswers: Ans[]
  /** Journal (s9i-7c1): Zeilen von `my_commissions` (gefiltert nach `p_month`), jeder Aufruf mit Monat, URL (select, order, offset, limit) und Prefer-Kopf; `abort` = Netzfehler */
  commissions: Record<string, unknown>[]
  journalCalls: { month: unknown; prefer: string | undefined; url: string }[]
  journalAnswers: (Ans | 'abort')[]
  /** Statuscode für den nächsten Abruf der Liste (Warteschlange), z. B. 500 */
  listStatus: number[]
  listingReads: number
  offerReads: number
  payoutReads: number
}

const pre = (r: Route) => (r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: cors }) : null)

export async function mockJobs(page: Page, init: Partial<JobsState> = {}): Promise<JobsState> {
  // Tiefe Kopie: die Antwort-Warteschlangen dürfen nicht über Tests hinweg geteilt werden (die Shot-Tabelle ist ein Modulwert, den jeder Lauf eines Workers wiederverwendet)
  const s: JobsState = { listings: [], offers: [], payoutRate: 0.15, payoutFails: false, accepts: [], sends: [], withdraws: [], photoCalls: [], urls: [], acceptAnswers: [], sendAnswers: [], withdrawAnswers: [], listStatus: [], listingReads: 0, offerReads: 0, payoutReads: 0, myJobs: [], jobReads: 0, jobStatus: [], starts: [], completes: [], contacts: [], startAnswers: [], completeAnswers: [], contactAnswers: [], changes: [], changeReads: 0, changeStatus: [], serverTotal: 81000, proposals: [], previewAnswers: [], proposeAnswers: [], receipts: [], receiptAnswers: [], withdrawnChanges: [], withdrawChangeAnswers: [], callOut: 6900, cancels: [], cancelPreviewAnswers: [], cancelAnswers: [], commissions: [], journalCalls: [], journalAnswers: [], ...structuredClone(init) }
  // Journal (s9i-7c1): wie PostgREST: Zeilen des Monats, Ausschnitt nach `Range`, Gesamtzahl im Kopf `content-range` (sichtbar für die App über expose-headers)
  await page.route('**/rest/v1/rpc/my_commissions**', (r) => {
    const o = pre(r)
    if (o) return o
    const h = r.request().headers()
    const month = (r.request().postDataJSON() as { p_month?: unknown }).p_month
    s.journalCalls.push({ month, prefer: h['prefer'], url: r.request().url() })
    const a = s.journalAnswers.shift()
    if (a === 'abort') return r.abort('failed')
    if (a) return r.fulfill({ status: a.status, headers: cors, json: a.json })
    const all = s.commissions.filter((c) => c.billing_month === month)
    // postgrest-js schickt `.range()` bei POST als `offset` und `limit` in der URL
    const q = new URL(r.request().url()).searchParams
    const from = Number(q.get('offset') ?? 0)
    const to = from + Number(q.get('limit') ?? 1000) - 1
    const page = all.slice(from, to + 1)
    return r.fulfill({
      headers: { ...cors, 'access-control-expose-headers': 'content-range', 'content-range': `${page.length ? `${from}-${from + page.length - 1}` : '*'}/${all.length}` },
      json: page,
    })
  })
  await page.route('**/rest/v1/job_listings**', (r) => {
    const o = pre(r)
    if (o) return o
    s.listingReads++
    s.urls.push(r.request().url())
    const st = s.listStatus.shift()
    if (st && st >= 400) return r.fulfill({ status: st, headers: cors, json: { code: 'XX000', message: 'boom', details: null, hint: null } })
    return rest(r, s.listings)
  })
  await page.route('**/rest/v1/partner_offers**', (r) => {
    const o = pre(r)
    if (o) return o
    s.offerReads++
    s.urls.push(r.request().url())
    return rest(r, s.offers)
  })
  // Auszahlungsvorschau: der Server rechnet (Gesamt − Provision, half-up in Cent); sonst gilt der Standard aus backend.ts
  await page.route('**/rest/v1/rpc/payout_preview**', (r) => {
    const o = pre(r)
    if (o) return o
    s.payoutReads++
    if (s.payoutFails) return r.fulfill({ status: 500, headers: cors, json: { code: 'XX000', message: 'boom', details: null, hint: null } })
    const total = Number((r.request().postDataJSON() as { p_total: number }).p_total)
    return reply(r, total - Math.round(total * s.payoutRate))
  })
  await page.route('**/functions/v1/accept', (r) => {
    const o = pre(r)
    if (o) return o
    const body = r.request().postDataJSON() as Record<string, unknown>
    s.accepts.push(body)
    const a = s.acceptAnswers.shift()
    if (a) return r.fulfill({ status: a.status, headers: cors, json: a.json })
    const won = s.listings.find((l) => l.id === body.listingId)
    s.listings = s.listings.map((l) => (l.id === body.listingId ? { ...l, status: 'accepted' as const } : l))
    // Der Server legt die Zuordnung an; Beträge stammen aus dem Journal (hier: Preis des Listings, Auszahlung wie gesendet)
    if (won) s.myJobs.push(job({ listing_id: won.id, service: won.service, district: won.district, to_district: won.to_district, preferred_date: won.preferred_date, time_window: won.time_window, total_cents: won.total_cents, payout_cents: body.shownPayoutCents as number }))
    return r.fulfill({ headers: cors, json: { assignmentId: A1 } })
  })
  await page.route('**/rest/v1/rpc/my_jobs**', (r) => {
    const o = pre(r)
    if (o) return o
    s.jobReads++
    const st = s.jobStatus.shift()
    // 403 steht für „Firma inzwischen gesperrt“ (P0001 partner_not_active), alles andere für einen Serverfehler
    if (st && st >= 400) return r.fulfill({ status: st, headers: cors, json: { code: st === 403 ? 'P0001' : 'XX000', message: st === 403 ? 'partner_not_active' : 'boom', details: null, hint: null } })
    return r.fulfill({ headers: cors, json: s.myJobs })
  })
  // Nachtrag (s9i-7a): Der Mock verhält sich wie der Server: nur ein offener Nachtrag je Auftrag, der Betrag kommt aus `serverTotal`, ein anderer gezeigter Betrag ergibt 409
  await page.route('**/rest/v1/rpc/my_job_changes**', (r) => {
    const o = pre(r)
    if (o) return o
    s.changeReads++
    const st = s.changeStatus.shift()
    if (st && st >= 400) return r.fulfill({ status: st, headers: cors, json: { code: 'XX000', message: 'boom', details: null, hint: null } })
    return r.fulfill({ headers: cors, json: s.changes })
  })
  await page.route('**/functions/v1/change-propose', (r) => {
    const o = pre(r)
    if (o) return o
    const body = r.request().postDataJSON() as Record<string, unknown>
    s.proposals.push(body)
    const row = s.changes.find((c) => c.request_id === body.requestId)
    if (body.preview === true) {
      const a = s.previewAnswers.shift()
      if (a) return r.fulfill({ status: a.status, headers: cors, json: a.json })
      return r.fulfill({ headers: cors, json: { totalCents: s.serverTotal, baseCents: row?.total_cents ?? 68961 } })
    }
    const a = s.proposeAnswers.shift()
    if (a) return r.fulfill({ status: a.status, headers: cors, json: a.json })
    if (body.shownTotalCents !== s.serverTotal) return r.fulfill({ status: 409, headers: cors, json: { error: 'amount_changed' } })
    if (row?.change_status === 'proposed') return r.fulfill({ status: 409, headers: cors, json: { error: 'change_open' } })
    if (row) Object.assign(row, { change_id: CH1, change_status: 'proposed', change_total_cents: s.serverTotal, change_valid_until: '2026-12-01T10:00:00+00:00', change_decided_at: null, receipt_ids: body.photoIds })
    return r.fulfill({ headers: cors, json: { revisionId: CH1, totalCents: s.serverTotal } })
  })
  await page.route('**/functions/v1/photo-receipt**', (r) => {
    const o = pre(r)
    if (o) return o
    const req = r.request()
    s.receipts.push({ request: new URL(req.url()).searchParams.get('request'), type: req.headers()['content-type'], bytes: req.postDataBuffer()?.length ?? 0 })
    const a = s.receiptAnswers.shift()
    if (a) return r.fulfill({ status: a.status, headers: cors, json: a.json })
    // Die Beleg-IDs sind laufende UUIDs; die Zeile der Firma führt sie wie der Server (bereite Belege der eigenen Firma)
    const id = `c3d4e5f6-a7b8-4c9d-8e0f-${String(s.receipts.length).padStart(12, '0')}`
    const row = s.changes.find((c) => c.request_id === new URL(req.url()).searchParams.get('request'))
    if (row) row.receipt_ids = [...row.receipt_ids, id]
    return r.fulfill({ headers: cors, json: { id } })
  })
  await page.route('**/rest/v1/rpc/withdraw_change**', (r) => {
    const o = pre(r)
    if (o) return o
    const body = r.request().postDataJSON() as { p_revision: string }
    s.withdrawnChanges.push(body.p_revision)
    const a = s.withdrawChangeAnswers.shift()
    if (a) return r.fulfill({ status: a.status, headers: cors, json: a.json })
    const row = s.changes.find((c) => c.change_id === body.p_revision)
    if (row) Object.assign(row, { change_status: 'withdrawn', change_decided_at: '2026-11-30T12:00:00+00:00' })
    return r.fulfill({ status: 204, headers: cors })
  })
  // Absage (s9i-7b2): der Mock verhält sich wie der Server: Pauschale nur bei `scope_impossible`, anderer gezeigter Betrag ergibt 409 `amount_changed`
  await page.route('**/functions/v1/cancel-partner', (r) => {
    const o = pre(r)
    if (o) return o
    const body = r.request().postDataJSON() as Record<string, unknown>
    s.cancels.push(body)
    const callOut = body.reason === 'scope_impossible' ? s.callOut : 0
    const payout = callOut - Math.round(callOut * 0.15)
    const a = (body.preview === true ? s.cancelPreviewAnswers : s.cancelAnswers).shift()
    if (a) return r.fulfill({ status: a.status, headers: cors, json: a.json })
    if (body.preview === true) return r.fulfill({ headers: cors, json: { callOutCents: callOut, payoutCents: payout } })
    // Wie der Server: die Pauschale fällt nur mit Belegen an (`feeBaseCents = ids.length > 0 ? callOutCents : 0`)
    const due = Array.isArray(body.photoIds) && body.photoIds.length > 0 ? callOut : 0
    if (body.shownCallOutCents !== due) return r.fulfill({ status: 409, headers: cors, json: { error: 'amount_changed' } })
    s.myJobs = s.myJobs.map((j) => (j.request_id === body.requestId ? { ...j, status: 'cancelled_by_partner' as const, ended_at: '2026-12-01T12:00:00+00:00', ended_reason: 'cancelled_by_partner', total_cents: due, payout_cents: due - Math.round(due * 0.15) } : j))
    return r.fulfill({ headers: cors, json: { status: 'cancelled_by_partner', callOutCents: due } })
  })
  // Start, Abschluss und Kontakt: der Mock verhält sich wie der Server (Status, Zuordnung); Fehler kommen aus den Warteschlangen
  const act = (name: 'start_job' | 'complete_job' | 'job_contact', log: string[], answers: Ans[], apply: (id: string) => void, okJson?: unknown) =>
    page.route(`**/rest/v1/rpc/${name}**`, (r) => {
      const o = pre(r)
      if (o) return o
      const id = (r.request().postDataJSON() as { p_request: string }).p_request
      log.push(id)
      const a = answers.shift()
      if (a) return r.fulfill({ status: a.status, headers: cors, json: a.json })
      apply(id)
      return okJson === undefined ? r.fulfill({ status: 204, headers: cors }) : r.fulfill({ headers: cors, json: okJson })
    })
  await act('start_job', s.starts, s.startAnswers, (id) => (s.myJobs = s.myJobs.map((j) => (j.request_id === id ? { ...j, status: 'in_progress' as const, can_start: false } : j))))
  await act('complete_job', s.completes, s.completeAnswers, (id) => (s.myJobs = s.myJobs.map((j) => (j.request_id === id ? { ...j, status: 'completed' as const, ended_at: '2026-12-02T12:00:00+00:00', ended_reason: 'completed' } : j))))
  await act('job_contact', s.contacts, s.contactAnswers, () => undefined, [CONTACT])
  await page.route('**/rest/v1/rpc/send_offer**', (r) => {
    const o = pre(r)
    if (o) return o
    const body = r.request().postDataJSON() as { p_listing: string; p_amount: number }
    s.sends.push(body)
    const a = s.sendAnswers.shift()
    if (a) return r.fulfill({ status: a.status, headers: cors, json: a.json })
    const l = s.listings.find((x) => x.id === body.p_listing)
    s.offers.push({ id: O1, base_revision_id: l?.revision_id ?? REV2, amount_cents: body.p_amount, status: 'sent', valid_until: '2026-12-03T10:00:00Z' })
    return r.fulfill({ headers: cors, json: O1 })
  })
  await page.route('**/rest/v1/rpc/withdraw_offer**', (r) => {
    const o = pre(r)
    if (o) return o
    const body = r.request().postDataJSON() as { p_offer: string }
    s.withdraws.push(body)
    const a = s.withdrawAnswers.shift()
    if (a) return r.fulfill({ status: a.status, headers: cors, json: a.json })
    s.offers = s.offers.map((x) => (x.id === body.p_offer ? { ...x, status: 'withdrawn' as const } : x))
    return r.fulfill({ status: 204, headers: cors })
  })
  await page.route('**/functions/v1/job-photo', (r) => {
    const o = pre(r)
    if (o) return o
    s.photoCalls.push(r.request().postDataJSON() as Record<string, unknown>)
    return r.fulfill({ headers: cors, json: [{ id: PHOTO, kind: 'request', url: 'https://example.test/foto-1.jpg' }] })
  })
  await page.route('https://example.test/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#888"/></svg>' }))
  return s
}

/** Firma `active`, Konto mit verifiziertem Faktor und aal2 (kein MFA-Schritt), dazu die gemockten Anfragen. */
export async function openJobs(page: Page, init: Partial<JobsState> = {}, o: OpenOpts = {}) {
  const jobs = await mockJobs(page, init)
  const opened = await openPartner(page, { status: 'active', aal: 'aal2', factors: [factor('f-1', 'verified')], ...o })
  return { jobs, ...opened }
}
