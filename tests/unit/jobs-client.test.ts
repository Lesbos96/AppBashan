import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { snapshotStorno } from '../../src/lib/cancel'
import { JobError, completeJob, confirmOffer, decideChange, jobErrorText, loadChange, loadOffers, loadReceipts, loadReportInfo, reportNotDone, stale, terminStarted, withdrawRequest } from '../../src/lib/jobs'

const invoke = vi.fn()
const rpc = vi.fn()
const maybeSingle = vi.fn()
const eqs: [string, unknown][] = []
const select = vi.fn()
const chain: Record<string, unknown> = {
  select: (...a: unknown[]) => (select(...a), chain),
  eq: (k: string, v: unknown) => (eqs.push([k, v]), chain),
  maybeSingle: () => maybeSingle(),
}
vi.mock('../../src/lib/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) }, rpc: (...a: unknown[]) => rpc(...a), from: () => chain } }))

const ID = '0b8f1c3e-5d2a-4e7b-9a61-3c4d5e6f7a8b'
const REV = '1c9f2d4e-6e3b-4f8c-8b72-4d5e6f7a8b9c'
const http = (status: number, json: unknown) => new FunctionsHttpError(new Response(JSON.stringify(json), { status }))

beforeEach(() => {
  invoke.mockReset()
  rpc.mockReset()
  maybeSingle.mockReset()
  select.mockReset()
  eqs.length = 0
})

describe('Angebot', () => {
  it('sendet genau den gezeigten Betrag', async () => {
    invoke.mockResolvedValue({ data: { status: 'confirmed' }, error: null })
    await confirmOffer(REV, 68961)
    expect(invoke).toHaveBeenCalledWith('offer-confirm', { body: { offerId: REV, shownAmountCents: 68961 } })
  })

  it.each([
    [409, 'amount_changed', 'changed'],
    [409, 'offer_not_valid', 'closed'],
    [409, 'invalid_transition', 'closed'],
    [404, 'not_found', 'closed'],
    [409, 'offer_unavailable', 'gone'],
    [409, 'partner_not_active', 'gone'],
    [403, 'partner_not_active', 'gone'],
    [409, 'retry', 'retry'],
    [401, 'unauthorized', 'unauthorized'],
    [500, 'internal', 'unavailable'],
    [409, 'rate_mismatch', 'unavailable'],
  ])('%i %s wird %s', async (status, error, kind) => {
    invoke.mockResolvedValue({ data: null, error: http(status, { error }) })
    await expect(confirmOffer(REV, 1)).rejects.toMatchObject({ kind })
  })

  it('Netzfehler ist offline', async () => {
    invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError(new Error('x')) })
    await expect(confirmOffer(REV, 1)).rejects.toMatchObject({ kind: 'offline' })
  })

  it('Liste: nur gültige Zeilen mit Status sent, Betrag als ganze Cent', async () => {
    const row = { offer_id: REV, amount_cents: 68961, valid_until: '2026-12-01T10:00:00Z', status: 'sent', company_name: 'Muster Transporte' }
    rpc.mockResolvedValue({
      data: [row, { ...row, status: 'confirmed' }, { ...row, amount_cents: 0 }, { ...row, amount_cents: 1.5 }, { ...row, valid_until: 'x' }, { ...row, offer_id: 'nope' }, { ...row, company_name: null }],
      error: null,
    })
    const offers = await loadOffers(ID)
    expect(rpc).toHaveBeenCalledWith('my_request_offers', { p_request: ID })
    expect(offers).toEqual([{ id: REV, amountCents: 68961, validUntil: new Date('2026-12-01T10:00:00Z'), company: 'Muster Transporte' }])
  })

  it('Fehler der Liste wird geworfen', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('x') })
    await expect(loadOffers(ID)).rejects.toThrow()
  })
})

describe('Nachtrag', () => {
  const snap = (total: number, lines: { key: string; cents: number }[]) => ({ kind: 'price', totalCents: total, lowCents: total, highCents: total, lines })
  const rev = (over: Record<string, unknown> = {}) => ({ id: REV, total_cents: 80000, valid_until: '2026-12-01T10:00:00Z', snapshot: snap(80000, [{ key: 'booked', cents: 68961 }, { key: 'change_order', cents: 11039 }]), photos: [ID], ...over })

  it('liest nur den offenen Nachtrag dieses Auftrags mit fester Spaltenliste', async () => {
    maybeSingle.mockResolvedValue({ data: rev(), error: null })
    const c = await loadChange(ID)
    expect(select).toHaveBeenCalledWith('id, total_cents, valid_until, snapshot, photos')
    expect(eqs).toEqual([['request_id', ID], ['source', 'change_order'], ['status', 'proposed']])
    expect(c).toEqual({ id: REV, totalCents: 80000, validUntil: new Date('2026-12-01T10:00:00Z'), extraCents: 11039, photoIds: [ID] })
  })

  it('kein Nachtrag: null', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await loadChange(ID)).toBeNull()
  })

  it('Snapshot passt nicht zum Gesamtpreis: nur der neue Gesamtpreis, keine Differenz', async () => {
    maybeSingle.mockResolvedValue({ data: rev({ snapshot: snap(79999, [{ key: 'change_order', cents: 11039 }]) }), error: null })
    expect((await loadChange(ID))!.extraCents).toBeNull()
    maybeSingle.mockResolvedValue({ data: rev({ snapshot: null }), error: null })
    expect((await loadChange(ID))!.extraCents).toBeNull()
  })

  it('unlesbarer Gesamtpreis ist ein Fehler', async () => {
    for (const total_cents of [0, -5, 1.5, null]) {
      maybeSingle.mockResolvedValue({ data: rev({ total_cents }), error: null })
      await expect(loadChange(ID)).rejects.toThrow()
    }
  })

  it('Zustimmen sendet exakt den gezeigten Gesamtpreis, Ablehnen keinen Betrag', async () => {
    invoke.mockResolvedValue({ data: { status: 'accepted' }, error: null })
    await decideChange(REV, true, 80000)
    expect(invoke).toHaveBeenLastCalledWith('change-decide', { body: { revisionId: REV, decision: 'accept', shownTotalCents: 80000 } })
    await decideChange(REV, false)
    expect(invoke).toHaveBeenLastCalledWith('change-decide', { body: { revisionId: REV, decision: 'decline' } })
  })

  it.each([
    [409, 'amount_changed', 'changed'],
    [409, 'revision_changed', 'closed'],
    [409, 'change_not_valid', 'closed'],
    [409, 'invalid_transition', 'closed'],
    [409, 'partner_not_active', 'gone'],
    [409, 'retry', 'retry'],
  ])('%i %s wird %s', async (status, error, kind) => {
    invoke.mockResolvedValue({ data: null, error: http(status, { error }) })
    await expect(decideChange(REV, true, 1)).rejects.toMatchObject({ kind })
  })

  it('Belege: nur Fotos dieses Nachtrags, nur https', async () => {
    invoke.mockResolvedValue({
      data: [
        { id: ID, kind: 'receipt', url: 'https://x.test/a.jpg' },
        { id: REV, kind: 'receipt', url: 'https://x.test/b.jpg' },
        { id: ID, kind: 'receipt', url: 'http://x.test/c.jpg' },
        { id: ID, kind: 'job', url: 'https://x.test/d.jpg' },
      ],
      error: null,
    })
    expect(await loadReceipts(ID, [ID])).toEqual(['https://x.test/a.jpg'])
    expect(invoke).toHaveBeenCalledWith('job-photo', { body: { requestId: ID } })
  })
})

describe('Termin', () => {
  it('complete_job und report_not_done senden nur die Anfrage', async () => {
    rpc.mockResolvedValue({ error: null })
    await completeJob(ID)
    expect(rpc).toHaveBeenLastCalledWith('complete_job', { p_request: ID })
    await reportNotDone(ID)
    expect(rpc).toHaveBeenLastCalledWith('report_not_done', { p_request: ID })
  })

  it.each([
    ['invalid_transition', 'closed'],
    ['not_found', 'closed'],
    ['too_early', 'too_early'],
    ['report_window_closed', 'window_closed'],
    ['under_review', 'under_review'],
    ['irgendwas', 'unavailable'],
  ])('Datenbankfehler %s wird %s', async (message, kind) => {
    rpc.mockResolvedValue({ error: { message } })
    await expect(reportNotDone(ID)).rejects.toMatchObject({ kind })
  })

  it('withdraw sendet nur die Anfrage; ein geschlossener Auftrag ist veraltet', async () => {
    rpc.mockResolvedValue({ error: null })
    await withdrawRequest(ID)
    expect(rpc).toHaveBeenLastCalledWith('withdraw', { p_request: ID })
    rpc.mockResolvedValue({ error: { message: 'invalid_transition' } })
    await expect(withdrawRequest(ID)).rejects.toMatchObject({ kind: 'closed' })
  })

  it('under_review ist veraltet (die Anzeige lädt neu)', () => {
    expect(stale('under_review')).toBe(true)
  })

  it('loadReportInfo: Server-Signal und Frist; unlesbar ist ein Fehler, nie ein Rückfall', async () => {
    rpc.mockResolvedValue({ data: [{ can_report: true, report_until: '2026-12-09T07:00:00+00:00' }], error: null })
    await expect(loadReportInfo(ID)).resolves.toEqual({ canReport: true, reportUntil: new Date('2026-12-09T07:00:00Z') })
    expect(rpc).toHaveBeenLastCalledWith('my_report_info', { p_request: ID })
    rpc.mockResolvedValue({ data: [{ can_report: false, report_until: null }], error: null })
    await expect(loadReportInfo(ID)).resolves.toEqual({ canReport: false, reportUntil: null })
    rpc.mockResolvedValue({ data: [{ can_report: 'ja', report_until: null }], error: null })
    await expect(loadReportInfo(ID)).rejects.toThrow()
    rpc.mockResolvedValue({ data: [], error: null })
    await expect(loadReportInfo(ID)).rejects.toThrow()
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } })
    await expect(loadReportInfo(ID)).rejects.toEqual({ message: 'x' })
  })

  it('geworfener Netzfehler ist offline', async () => {
    rpc.mockRejectedValue(new TypeError('fetch failed'))
    await expect(completeJob(ID)).rejects.toBeInstanceOf(JobError)
    await expect(completeJob(ID)).rejects.toMatchObject({ kind: 'offline' })
  })

  it('terminStarted: ab dem Termin, ungültig ist nie gestartet', () => {
    const t = '2026-12-15T07:00:00Z'
    expect(terminStarted(t, Date.parse(t) - 1)).toBe(false)
    expect(terminStarted(t, Date.parse(t))).toBe(true)
    expect(terminStarted(null)).toBe(false)
    expect(terminStarted('x')).toBe(false)
  })
})

describe('Texte', () => {
  it('jede Fehlerart hat einen Text ohne Gebühren- oder Firmenstatuswort', () => {
    expect(Object.keys(jobErrorText).sort()).toEqual([
      'amount', 'bad_input', 'bad_photo', 'change_open', 'changed', 'closed', 'gone', 'have_offer', 'job_limit', 'late_reason', 'no_call_out', 'no_change', 'not_increasing', 'offer_limit', 'offer_open', 'offline', 'payout', 'period', 'receipt_limit', 'receipt_missing', 'retry', 'taken', 'too_early', 'unauthorized', 'unavailable', 'under_review', 'vat_rule', 'window_closed',
    ])
    for (const text of Object.values(jobErrorText)) expect(text).not.toMatch(/Provision|Plattform|15 ?%|gesperrt|suspended/)
  })
})

describe('snapshotStorno (Stufen aus dem Snapshot)', () => {
  const terms = { cancel_free_hours: 48, cancel_late_percent: 50, cancel_full_percent: 100, cancel_full_days_before: 0 }

  it('nennt die Stufen aus den Werten im Snapshot', () => {
    expect(snapshotStorno({ terms })).toEqual(['Kostenlos stornieren kannst du bis 48 Stunden vor dem Termin.', 'Danach werden 50 % des Preises berechnet, ab dem Tag des Termins 100 %.'])
  })

  it.each([
    ['ohne terms', {}],
    ['kein Objekt', null],
    ['Wert fehlt', { terms: { ...terms, cancel_late_percent: undefined } }],
    ['Prozent über 100', { terms: { ...terms, cancel_full_percent: 101 } }],
    ['negativ', { terms: { ...terms, cancel_free_hours: -1 } }],
    ['Text statt Zahl', { terms: { ...terms, cancel_free_hours: '48' } }],
    ['Bruch', { terms: { ...terms, cancel_full_days_before: 0.5 } }],
  ])('%s: kein Text', (_name, snapshot) => {
    expect(snapshotStorno(snapshot)).toEqual([])
  })
})
