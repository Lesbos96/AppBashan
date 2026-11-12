import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildChanges, canPropose, changeFields, loadChanges, previewChange, proposeChange, startDraft, uploadReceipt, withdrawChange, type JobChange } from '../../src/lib/partnerChange'
import { JobError } from '../../src/lib/jobs'

// s9i-7a: Nachtrag der Firma. Der Server rechnet; hier: strenge Zeilenprüfung, nur sinnvolle Felder, Aufrufkörper, Fehlerzuordnung.
const rpc = vi.fn()
const invoke = vi.fn()
vi.mock('../../src/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), functions: { invoke: (...a: unknown[]) => invoke(...a) }, auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }) } } }))
vi.mock('../../src/lib/photos', () => ({ preparePhoto: () => Promise.resolve(new Blob(['x'], { type: 'image/jpeg' })), PhotoError: class extends Error {} }))

const R = '2d1a3b4c-7e8f-4a9b-8c7d-6e5f4a3b2c1d'
const C = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const P = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'
const INPUTS = { service: 'move', goods: 'normal', crew: 2, vehicles: 1, vehicleType: 'van', hours: 3, fromFloor: 2, toFloor: 0, fromLift: false, toLift: true, boxes: 10, parking: 0, packing: false, assembly: null }
const row = (over: Record<string, unknown> = {}) => ({
  request_id: R, service: 'move', source: 'submit', inputs: INPUTS, total_cents: 68961,
  change_id: null, change_status: null, change_total_cents: null, change_valid_until: null, change_decided_at: null, receipt_ids: [], ...over,
})
const job = (over: Partial<JobChange> = {}): JobChange => ({ requestId: R, service: 'move', source: 'submit', inputs: INPUTS, totalCents: 68961, change: null, receiptIds: [], ...over })

beforeEach(() => {
  rpc.mockReset() // in Klammern: der Rückgabewert (der Mock) liefe sonst als Aufräumfunktion
  invoke.mockReset()
  vi.unstubAllGlobals()
})

describe('loadChanges', () => {
  it('ruft my_job_changes ohne Argumente auf und bildet die Zeile ab', async () => {
    rpc.mockResolvedValue({ data: [row({ change_id: C, change_status: 'proposed', change_total_cents: 81000, change_valid_until: '2026-12-01T10:00:00+00:00', receipt_ids: [P] })], error: null })
    const m = await loadChanges()
    expect(rpc).toHaveBeenCalledWith('my_job_changes')
    expect(m.get(R)).toMatchObject({ requestId: R, service: 'move', source: 'submit', totalCents: 68961, receiptIds: [P], change: { id: C, status: 'proposed', totalCents: 81000 } })
    expect(m.get(R)?.change?.validUntil?.toISOString()).toBe('2026-12-01T10:00:00.000Z')
  })

  it.each([
    ['ungültige Auftrags-ID', { request_id: 'x' }],
    ['unbekannte Leistung', { service: 'rental' }],
    ['Eingaben kein Objekt', { inputs: [] }],
    ['Preis 0', { total_cents: 0 }],
    ['Preis mit Nachkommastellen', { total_cents: 1.5 }],
  ])('%s: Zeile entfällt', async (_n, over) => {
    rpc.mockResolvedValue({ data: [row(over), row({ request_id: C })], error: null })
    expect([...(await loadChanges()).keys()]).toEqual([C])
  })

  it('ein unlesbarer Nachtrag (Status, Betrag, ID) wird nicht gezeigt, die Grundlage bleibt', async () => {
    for (const bad of [{ change_status: 'open' }, { change_total_cents: 0 }, { change_id: 'x' }]) {
      rpc.mockResolvedValue({ data: [row({ change_id: C, change_status: 'proposed', change_total_cents: 81000, ...bad })], error: null })
      expect((await loadChanges()).get(R)?.change).toBeNull()
    }
  })

  it('Spanne (kein Gesamtpreis) bleibt ohne Preis; Fehler des Servers werden weitergegeben', async () => {
    rpc.mockResolvedValue({ data: [row({ total_cents: null })], error: null })
    expect((await loadChanges()).get(R)?.totalCents).toBeNull()
    rpc.mockResolvedValue({ data: null, error: { message: 'partner_not_active' } })
    await expect(loadChanges()).rejects.toMatchObject({ message: 'partner_not_active' })
  })
})

describe('Felder und Entwurf', () => {
  it('Umzug: nur Schlüssel mit passendem Typ; Adresse, Einpacken, Sonderware und Montage sind nie dabei', () => {
    expect(changeFields('move', INPUTS).map((f) => f.key)).toEqual(['crew', 'vehicles', 'vehicleType', 'hours', 'fromFloor', 'fromLift', 'toFloor', 'toLift', 'boxes'])
    // fehlender Schlüssel, falscher Typ, Wert außerhalb der Grenze, Fahrzeugart „large“
    expect(changeFields('move', { crew: '2', hours: 500, vehicleType: 'large', fromLift: 1 })).toEqual([])
  })
  it('Montage: Laufmeter, Küche mit oben und hoch; Entrümpelung hat keine Felder (Spanne, Festangebot)', () => {
    expect(changeFields('assembly', { kind: 'standard', lm: 4 }).map((f) => f.key)).toEqual(['lm'])
    expect(changeFields('assembly', { kind: 'kitchen', lm: 4, upper: 2, tall: 1 }).map((f) => f.key)).toEqual(['lm', 'upper', 'tall'])
    expect(changeFields('clearance', { object: 'flat', area: 30, fill: 'normal', lift: false, floor: 1, special: false })).toEqual([])
  })
  it('canPropose: nicht bei Festangebot, Spanne, offenem Nachtrag oder ohne Felder', () => {
    expect(canPropose(job())).toBe(true)
    expect(canPropose(undefined)).toBe(false)
    expect(canPropose(job({ source: 'partner_offer' }))).toBe(false)
    expect(canPropose(job({ totalCents: null }))).toBe(false)
    expect(canPropose(job({ change: { id: C, status: 'proposed', totalCents: 81000, validUntil: null, decidedAt: null } }))).toBe(false)
    expect(canPropose(job({ change: { id: C, status: 'declined', totalCents: 81000, validUntil: null, decidedAt: null } }))).toBe(true)
    expect(canPropose(job({ service: 'clearance' }))).toBe(false)
  })
  it('startDraft zeigt die gebuchten Werte mit Dezimalkomma', () => {
    const d = startDraft(changeFields('move', { ...INPUTS, hours: 2.5 }), { ...INPUTS, hours: 2.5 })
    expect(d).toMatchObject({ crew: '2', hours: '2,5', vehicleType: 'van', fromLift: false, toLift: true })
  })
})

describe('buildChanges', () => {
  const fields = changeFields('move', INPUTS)
  const draft = (over: Record<string, string | boolean> = {}) => ({ ...startDraft(fields, INPUTS), ...over })
  it('sendet nur Abweichungen, Zahlen als Zahl, Dezimalkomma wird zum Punkt', () => {
    expect(buildChanges(fields, INPUTS, draft({ hours: '5,5', fromLift: true, vehicleType: 'truck', boxes: ' 12 ' }))).toEqual({ changes: { hours: 5.5, fromLift: true, vehicleType: 'truck', boxes: 12 } })
  })
  it('ohne Änderung, ungültige Zahl, Nachkommastellen bei ganzer Zahl, Grenzen: Text statt Aufruf', () => {
    expect(buildChanges(fields, INPUTS, draft())).toEqual({ error: 'Ändere mindestens einen Wert.' })
    expect(buildChanges(fields, INPUTS, draft({ hours: '' }))).toEqual({ error: 'Stunden: Gib eine Zahl ein.' })
    expect(buildChanges(fields, INPUTS, draft({ hours: 'abc' }))).toEqual({ error: 'Stunden: Gib eine Zahl ein.' })
    expect(buildChanges(fields, INPUTS, draft({ crew: '2,5' }))).toEqual({ error: 'Personen: Gib eine ganze Zahl ein.' })
    expect(buildChanges(fields, INPUTS, draft({ crew: '9' }))).toEqual({ error: 'Personen: Erlaubt sind 1 bis 8.' })
    expect(buildChanges(fields, INPUTS, draft({ hours: '0,2' }))).toEqual({ error: 'Stunden: Erlaubt sind 0,5 bis 100.' })
    expect(buildChanges(fields, INPUTS, draft({ hours: '-1' }))).toEqual({ error: 'Stunden: Erlaubt sind 0,5 bis 100.' })
  })
})

describe('Aufrufe', () => {
  it('Vorschau sendet nur requestId, changes und preview; Antwort mit sicheren positiven Ganzzahlen', async () => {
    invoke.mockResolvedValue({ data: { totalCents: 81000, baseCents: 68961 }, error: null })
    expect(await previewChange(R, { hours: 5 })).toEqual({ totalCents: 81000, baseCents: 68961 })
    expect(invoke).toHaveBeenCalledWith('change-propose', { body: { requestId: R, changes: { hours: 5 }, preview: true } })
    for (const bad of [{}, { totalCents: 0, baseCents: 1 }, { totalCents: 1.5, baseCents: 1 }, { totalCents: '1', baseCents: 1 }]) {
      invoke.mockResolvedValue({ data: bad, error: null })
      await expect(previewChange(R, { hours: 5 })).rejects.toMatchObject({ kind: 'unavailable' })
    }
  })
  it('Anlegen sendet den gezeigten Betrag und die Beleg-IDs, kein anderes Feld; ohne revisionId ist es ein Fehler', async () => {
    invoke.mockResolvedValue({ data: { revisionId: C, totalCents: 81000 }, error: null })
    await proposeChange(R, { hours: 5 }, [P], 81000)
    expect(invoke).toHaveBeenCalledWith('change-propose', { body: { requestId: R, changes: { hours: 5 }, photoIds: [P], shownTotalCents: 81000 } })
    invoke.mockResolvedValue({ data: {}, error: null })
    await expect(proposeChange(R, { hours: 5 }, [P], 81000)).rejects.toMatchObject({ kind: 'unavailable' })
  })
  it('Rückzug ruft withdraw_change mit der Revision auf; Fehlercodes werden zugeordnet, Netz ist offline', async () => {
    rpc.mockResolvedValue({ error: null })
    await withdrawChange(C)
    expect(rpc).toHaveBeenCalledWith('withdraw_change', { p_revision: C })
    rpc.mockResolvedValue({ error: { message: 'invalid_transition' } })
    await expect(withdrawChange(C)).rejects.toMatchObject({ kind: 'closed' })
    rpc.mockResolvedValue({ error: { message: 'constructor' } })
    await expect(withdrawChange(C)).rejects.toMatchObject({ kind: 'unavailable' })
    rpc.mockRejectedValue(new Error('network'))
    await expect(withdrawChange(C)).rejects.toMatchObject({ kind: 'offline' })
  })
  it('Beleg: JPEG an photo-receipt mit Anfrage, Token und Schlüssel; Antwort ohne gültige ID, Fehlercodes und Netz sind Fehler', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: P }) })
    vi.stubGlobal('fetch', fetchMock)
    expect(await uploadReceipt(R, new File(['x'], 'a.png', { type: 'image/png' }))).toBe(P)
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }]
    expect(url).toMatch(new RegExp(`/functions/v1/photo-receipt\\?request=${R}$`))
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ authorization: 'Bearer tok', 'content-type': 'image/jpeg' })
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'x' }) })
    await expect(uploadReceipt(R, new File(['x'], 'a.png'))).rejects.toMatchObject({ kind: 'unavailable' })
    for (const [code, kind] of [['not_jpeg', 'bad_photo'], ['receipt_limit', 'receipt_limit'], ['request_closed', 'closed'], ['partner_not_active', 'gone'], ['unbekannt', 'unavailable']] as const) {
      fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: code }) })
      await expect(uploadReceipt(R, new File(['x'], 'a.png'))).rejects.toMatchObject({ kind })
    }
    fetchMock.mockRejectedValue(new Error('network'))
    await expect(uploadReceipt(R, new File(['x'], 'a.png'))).rejects.toBeInstanceOf(JobError)
  })
})

describe('Fehlerzuordnung der Edge Function', () => {
  it('409 amount_changed, change_open, change_not_increasing und 422 invalid_input ergeben eigene Arten', async () => {
    const { FunctionsHttpError } = await import('@supabase/supabase-js')
    const http = (code: string) => new FunctionsHttpError({ json: () => Promise.resolve({ error: code }) } as unknown as Response)
    for (const [code, kind] of [['amount_changed', 'changed'], ['change_open', 'change_open'], ['change_not_increasing', 'not_increasing'], ['invalid_input', 'bad_input'], ['not_fixed_price', 'no_change'], ['receipt_required', 'bad_photo'], ['revision_changed', 'closed']] as const) {
      invoke.mockResolvedValue({ data: null, error: http(code) })
      await expect(previewChange(R, { hours: 5 })).rejects.toMatchObject({ kind })
    }
  })
})
