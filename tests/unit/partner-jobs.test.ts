import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JobError } from '../../src/lib/jobs'
import { acceptListing, loadListings, loadMyOffers, parseEuro, payoutPreview, scopeLines, sendOffer, withdrawOffer } from '../../src/lib/partnerJobs'

const invoke = vi.fn()
const rpc = vi.fn()
const selects: string[] = []
let result: { data: unknown; error: unknown } = { data: [], error: null }
const chain: Record<string, unknown> = {
  select: (cols: string) => (selects.push(cols), chain),
  order: () => chain,
  limit: () => chain,
  single: () => Promise.resolve(result),
  then: (f: (v: unknown) => unknown) => Promise.resolve(result).then(f),
}
vi.mock('../../src/lib/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) }, rpc: (...a: unknown[]) => rpc(...a), from: () => chain } }))

const ID = '0b8f1c3e-5d2a-4e7b-9a61-3c4d5e6f7a8b'
const REV = '1c9f2d4e-6e3b-4f8c-8b72-4d5e6f7a8b9c'
const http = (status: number, json: unknown) => new FunctionsHttpError(new Response(JSON.stringify(json), { status }))

beforeEach(() => {
  invoke.mockReset()
  rpc.mockReset()
  selects.length = 0
  result = { data: [], error: null }
})

describe('parseEuro (Eingabe in Euro, höchstens zwei Nachkommastellen, ganze Cent)', () => {
  it.each([
    ['689,61', 68961],
    ['689.61', 68961],
    ['  120 ', 12000],
    ['0,5', 50],
    ['0,05', 5],
    ['1234,5', 123450],
    ['9999999,99', 999999999],
  ])('%s → %i', (s, cents) => expect(parseEuro(s)).toBe(cents))

  it.each(['', ' ', '0', '0,00', '-5', '-0,50', '1,005', '1.005', '1.234,50', 'abc', '1e3', 'NaN', 'Infinity', '12,', ',5', '10 000', '99999999', '1,2,3', '١٢٣'])('%j ist ungültig', (s) => expect(parseEuro(s)).toBeNull())
})

describe('payoutPreview (Auszahlung aus payout_preview, Fehler und ungültige Antworten → null)', () => {
  it('liefert den Wert der Datenbank und fragt mit dem Gesamtpreis', async () => {
    rpc.mockResolvedValue({ data: 1234, error: null })
    expect(await payoutPreview(5000)).toBe(1234)
    expect(rpc).toHaveBeenCalledWith('payout_preview', { p_total: 5000 })
  })
  it('Fehler ergeben null', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } })
    expect(await payoutPreview(5000)).toBeNull()
  })
  it('Netzfehler (rpc wirft) ergibt null', async () => {
    rpc.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await payoutPreview(5000)).toBeNull()
  })
  it.each([
    ['über dem Gesamtpreis', 6000],
    ['negativ', -1],
    ['Nachkommastellen', 1.5],
    ['Text', 'abc'],
    ['null ohne Fehler', null],
    ['leerer Text', ''],
  ])('ungültige Antwort (%s) ergibt null', async (_n, data) => {
    rpc.mockResolvedValue({ data, error: null })
    expect(await payoutPreview(5000)).toBeNull()
  })
})

describe('scopeLines (nur Umfang, keine fremden Felder)', () => {
  it('Transport: bekannte Felder in Worten, unbekannte Schlüssel entfallen', () => {
    const lines = scopeLines('transport', { goods: 'piano', crew: 2, vehicles: 1, vehicleType: 'van', hours: 3, fromFloor: 2, toFloor: 0, fromLift: false, toLift: true, boxes: 10, parking: 0, packing: false, assembly: null, address: 'Teststraße 1', phone: '0660 1234567' })
    const text = lines.join(' | ')
    expect(text).toContain('Klavier')
    expect(text).not.toContain('Teststraße')
    expect(text).not.toContain('0660')
  })
  it('Entrümpelung und Montage', () => {
    expect(scopeLines('clearance', { object: 'cellar', area: 30, fill: 'full', lift: false, floor: -1, special: false, assembly: null }).join(' ')).toContain('Keller')
    expect(scopeLines('assembly', { kind: 'standard', lm: 4 }).join(' ')).toContain('4')
  })
  it('unlesbare Eingaben ergeben eine leere Liste statt eines Fehlers', () => {
    expect(scopeLines('transport', null)).toEqual([])
    expect(scopeLines('transport', 'x')).toEqual([])
  })
})

describe('Listings lesen', () => {
  const row = { id: ID, revision_id: REV, status: 'open', district: 3, to_district: 10, service: 'transport', inputs: { goods: 'normal' }, volume_m3: 4, preferred_date: '2026-12-02', time_window: 'morning', total_cents: 68961, low_cents: 68961, high_cents: 68961, accept_deadline: '2026-12-01T10:00:00Z' }

  it('fragt nur die freigegebenen Spalten ab (nie request_id, Adresse, Kunde)', async () => {
    result = { data: [row], error: null }
    const l = await loadListings()
    expect(selects[0]).not.toMatch(/request_id|address|customer|\*/)
    expect(l).toHaveLength(1)
    expect(l[0]).toMatchObject({ id: ID, revisionId: REV, status: 'open', district: 3, toDistrict: 10, totalCents: 68961, preferredDate: '2026-12-02', timeWindow: 'morning' })
    expect(l[0]!.deadline).toEqual(new Date('2026-12-01T10:00:00Z'))
  })

  it('Spanne ohne Gesamtpreis bleibt ohne Gesamtpreis (Angebotsweg)', async () => {
    result = { data: [{ ...row, total_cents: null, low_cents: 50000, high_cents: 90000 }], error: null }
    const [l] = await loadListings()
    expect(l!.totalCents).toBeNull()
    expect(l!.lowCents).toBe(50000)
    expect(l!.highCents).toBe(90000)
  })

  it('unlesbare Zeilen entfallen, nie ein halber Betrag', async () => {
    result = { data: [row, { ...row, id: 'x' }, { ...row, total_cents: 12.5 }, { ...row, accept_deadline: 'kaputt' }, { ...row, status: 'closed' }], error: null }
    expect(await loadListings()).toHaveLength(1)
  })

  it('Lesefehler wird geworfen', async () => {
    result = { data: null, error: { message: 'x' } }
    await expect(loadListings()).rejects.toBeTruthy()
  })
})

describe('Annahme', () => {
  it('sendet Listing, Revision und die gezeigte Auszahlung', async () => {
    invoke.mockResolvedValue({ data: { assignmentId: ID }, error: null })
    await acceptListing({ id: ID, revisionId: REV }, 58617)
    expect(invoke).toHaveBeenCalledWith('accept', { body: { listingId: ID, revisionId: REV, shownPayoutCents: 58617 } })
  })

  it.each([
    [409, 'already_taken', 'taken'],
    [409, 'request_closed', 'taken'],
    [409, 'listing_declined', 'taken'],
    [409, 'expired', 'taken'],
    [409, 'invalid_transition', 'taken'],
    [409, 'offer_required', 'taken'],
    [404, 'not_found', 'taken'],
    [403, 'not_responsible', 'taken'],
    [409, 'payout_changed', 'payout'],
    [409, 'revision_changed', 'changed'],
    [409, 'fee_rate_changed', 'payout'],
    [409, 'partner_job_limit', 'job_limit'],
    [403, 'partner_not_active', 'gone'],
    [403, 'mfa_required', 'unauthorized'],
    [401, 'unauthorized', 'unauthorized'],
    [500, 'internal', 'unavailable'],
  ])('%i %s wird %s', async (status, error, kind) => {
    invoke.mockResolvedValue({ data: null, error: http(status, { error }) })
    await expect(acceptListing({ id: ID, revisionId: REV }, 1)).rejects.toMatchObject({ kind })
  })

  it('Netzfehler ist offline', async () => {
    invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError(new Error('x')) })
    await expect(acceptListing({ id: ID, revisionId: REV }, 1)).rejects.toMatchObject({ kind: 'offline' })
  })

  it('payout_changed und fee_rate_changed sind „Auszahlung geändert“, revision_changed „Preis geändert“', async () => {
    invoke.mockResolvedValue({ data: null, error: http(409, { error: 'fee_rate_changed' }) })
    await expect(acceptListing({ id: ID, revisionId: REV }, 1)).rejects.toMatchObject({ kind: 'payout' })
  })

  it('already_taken bleibt „taken“, die App liest die Liste nicht mehr nach (die Wiederholung entscheidet der Server, 0067)', async () => {
    invoke.mockResolvedValue({ data: null, error: http(409, { error: 'already_taken' }) })
    await expect(acceptListing({ id: ID, revisionId: REV }, 1)).rejects.toMatchObject({ kind: 'taken' })
    expect(selects).toEqual([])
  })
})

describe('Härtung (Abnahme N1, N2)', () => {
  it('Schlüssel der Prototypkette sind keine Treffer', async () => {
    expect(scopeLines('transport', { goods: 'constructor', vehicleType: 'toString', crew: 1, vehicles: 1 })).toEqual([])
    expect(scopeLines('clearance', { object: '__proto__', fill: 'hasOwnProperty' })).toEqual([])
    rpc.mockResolvedValue({ data: null, error: { message: 'constructor' } })
    await expect(sendOffer(ID, 100)).rejects.toMatchObject({ kind: 'unavailable' })
  })
})

describe('Angebot senden und zurückziehen', () => {
  it('send_offer bekommt Listing und ganze Cent', async () => {
    rpc.mockResolvedValue({ data: ID, error: null })
    await sendOffer(ID, 68961)
    expect(rpc).toHaveBeenCalledWith('send_offer', { p_listing: ID, p_amount: 68961 })
  })

  it('sendet nie einen ungültigen Betrag (Client-Sperre vor dem Aufruf)', async () => {
    for (const bad of [0, -1, 1.5, Number.NaN, 2 ** 31, Number.POSITIVE_INFINITY]) await expect(sendOffer(ID, bad)).rejects.toBeInstanceOf(JobError)
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([
    ['offer_exists', 'have_offer'],
    ['offer_limit', 'offer_limit'],
    ['amount_out_of_range', 'amount'],
    ['vat_rule_missing', 'vat_rule'],
    ['expired', 'taken'],
    ['listing_declined', 'taken'],
    ['invalid_transition', 'taken'],
    ['not_found', 'taken'],
    ['not_responsible', 'taken'],
    ['partner_not_active', 'gone'],
    ['mfa_required', 'unauthorized'],
    ['irgendwas', 'unavailable'],
  ])('send_offer %s wird %s', async (message, kind) => {
    rpc.mockResolvedValue({ data: null, error: { message } })
    await expect(sendOffer(ID, 100)).rejects.toMatchObject({ kind })
  })

  it('Netzfehler (rpc wirft) ist offline', async () => {
    rpc.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(sendOffer(ID, 100)).rejects.toMatchObject({ kind: 'offline' })
  })

  it('withdraw_offer', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await withdrawOffer(ID)
    expect(rpc).toHaveBeenCalledWith('withdraw_offer', { p_offer: ID })
    rpc.mockResolvedValue({ data: null, error: { message: 'invalid_transition' } })
    await expect(withdrawOffer(ID)).rejects.toMatchObject({ kind: 'taken' })
  })
})

describe('eigene Angebote', () => {
  it('nur gültige Zeilen, Betrag als ganze Cent', async () => {
    const row = { id: ID, base_revision_id: REV, amount_cents: 68961, status: 'sent', valid_until: '2026-12-01T10:00:00Z' }
    result = { data: [row, { ...row, id: 'x' }, { ...row, amount_cents: 1.5 }], error: null }
    const o = await loadMyOffers()
    expect(o).toHaveLength(1)
    expect(o[0]).toMatchObject({ id: ID, revisionId: REV, amountCents: 68961, status: 'sent' })
    expect(selects[0]).not.toMatch(/request_id|\*/)
  })
})
