import type { Page, Route } from '@playwright/test'
import { cors, rest } from './backend'
import { factor, openPartner, type OpenOpts } from './mfa-helpers'

/*
 * Gemockte Partner-Anfragen (s9i-6a): `job_listings`, `partner_offers`, `current_fee_rates`, Functions `accept` und `job-photo`, RPC `send_offer`
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
  rates: { fee_rate: number | null; fee_vat_rate: number | null }
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
  /** Statuscode für den nächsten Abruf der Liste (Warteschlange), z. B. 500 */
  listStatus: number[]
  listingReads: number
}

const pre = (r: Route) => (r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: cors }) : null)

export async function mockJobs(page: Page, init: Partial<JobsState> = {}): Promise<JobsState> {
  const s: JobsState = { listings: [], offers: [], rates: { fee_rate: 0.15, fee_vat_rate: 0.2 }, accepts: [], sends: [], withdraws: [], photoCalls: [], urls: [], acceptAnswers: [], sendAnswers: [], withdrawAnswers: [], listStatus: [], listingReads: 0, ...init }
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
    s.urls.push(r.request().url())
    return rest(r, s.offers)
  })
  await page.route('**/rest/v1/current_fee_rates**', (r) => pre(r) ?? rest(r, [s.rates]))
  await page.route('**/functions/v1/accept', (r) => {
    const o = pre(r)
    if (o) return o
    const body = r.request().postDataJSON() as Record<string, unknown>
    s.accepts.push(body)
    const a = s.acceptAnswers.shift()
    if (a) return r.fulfill({ status: a.status, headers: cors, json: a.json })
    s.listings = s.listings.map((l) => (l.id === body.listingId ? { ...l, status: 'accepted' as const } : l))
    return r.fulfill({ headers: cors, json: { assignmentId: '6b5e7f80-1c2d-4e3f-a01b-0c9d8e7f6a5b' } })
  })
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
