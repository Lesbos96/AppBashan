// Edge Functions change-propose und change-decide (S9f) mit Fakes. Gerechnet wird mit der gebuchten Preisversion; der Kunde sieht nie einen fee_*-Code.
import { computeTransport, parseTransportInput, splitChange, splitFee } from '@pricing'
import { describe, expect, it } from 'vitest'
import { DbError } from '../../supabase/functions/_shared/jobs/handlers.ts'
import {
  type DecideBasis,
  type DecideCall,
  type DecideDeps,
  type ProposeBasis,
  type ProposeCall,
  type ProposeDeps,
  handleDecideChange,
  handleProposeChange,
} from '../../supabase/functions/_shared/change/handlers.ts'
import { buildTariffs } from '../../supabase/functions/_shared/quote/tariffs.ts'
import { moveInputs, seedRows } from '../support/quote.ts'

const REQ = '11111111-1111-4111-8111-111111111111'
const REV = '22222222-2222-4222-8222-222222222222'
const PH = '33333333-3333-4333-8333-333333333333'
const ROUTE = { region: 'vienna', outsideKm: 0, driveHours: 0.4, distanceKm: 3 }
const FACTS = { region: 'vienna' as const, outsideKm: 0, driveHours: 0.4 }
const tariffs = buildTariffs(seedRows)
const OLD = { ...moveInputs, service: 'move' }
const priceOf = (over: Record<string, unknown>) => {
  const r = computeTransport(tariffs, parseTransportInput({ ...OLD, ...over }), FACTS)
  if (r.kind !== 'price') throw new Error('Festpreis erwartet')
  return r.totalCents
}
const BOOKED = priceOf({})
const rates = { tiers: [{ upToCents: null, bp: 1500 }], vatRate: 0.2 }

const post = (body: unknown, headers: Record<string, string> = { authorization: 'Bearer t' }) =>
  new Request('https://x.test/change', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
const json = async (r: Response) => (await r.json()) as Record<string, unknown>

// propose ------------------------------------------------------------------------------------------------------------------
const BASIS: ProposeBasis = { revisionId: REV, source: 'submit', inputs: OLD, priceVersion: 7, totalCents: BOOKED, service: 'move', route: ROUTE }
function pdeps(over: Partial<ProposeDeps> = {}): ProposeDeps & { calls: ProposeCall[]; versions: number[]; replays: unknown[][] } {
  const calls: ProposeCall[] = []
  const versions: number[] = []
  const replays: unknown[][] = []
  return {
    calls,
    versions,
    replays,
    replay: async (...a: unknown[]) => {
      replays.push(a)
      return null
    },
    allowedOrigins: [],
    getUser: async () => ({ id: 'p1', aal: 'aal2' }),
    loadPricing: async (v) => {
      versions.push(v)
      return { rows: seedRows }
    },
    basis: async () => BASIS,
    propose: async (_u, _a, c) => {
      calls.push(c)
      return 'rev-new'
    },
    log: () => {},
    ...over,
  }
}
const NEW7 = priceOf({ hours: 7 }) // gebuchter Preis + Modul(neu) − Modul(alt) mit dem gebuchten Preis BOOKED
const okBody = { requestId: REQ, changes: { hours: 7 }, photoIds: [PH], shownTotalCents: NEW7 }
const previewBody = { requestId: REQ, changes: { hours: 7 }, preview: true }

describe('change-propose: Wiederholung nach Erfolg (n12b)', () => {
  const open = async () => {
    throw new DbError('change_open')
  }
  it('Grundlage meldet change_open und der offene Nachtrag ist derselbe Vorschlag: 200 mit dessen Id, nichts wird angelegt', async () => {
    const d = pdeps({ basis: open, replay: async (...a: unknown[]) => (d.replays.push(a), 'rev-old') })
    const res = await handleProposeChange(post(okBody), d)
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ revisionId: 'rev-old', totalCents: NEW7 })
    expect(d.replays).toEqual([['p1', REQ, { hours: 7 }, NEW7, [PH]]])
    expect(d.calls).toHaveLength(0)
  })
  it('Wettlauf: change_open erst beim Anlegen (der andere Aufruf war schneller): ebenso 200', async () => {
    const d = pdeps({ propose: open, replay: async () => 'rev-old' })
    const res = await handleProposeChange(post(okBody), d)
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ revisionId: 'rev-old', totalCents: NEW7 })
  })
  it('ein anderer Vorschlag (null): der ursprüngliche Fehler 409 change_open', async () => {
    const d = pdeps({ basis: open })
    const res = await handleProposeChange(post(okBody), d)
    expect(res.status).toBe(409)
    expect(await json(res)).toEqual({ error: 'change_open' })
    expect(d.replays).toHaveLength(1)
  })
  it('Vorschau bei offenem Nachtrag bleibt 409 ohne Nachfrage; andere Fehler fragen nie nach', async () => {
    const d = pdeps({ basis: open })
    expect((await handleProposeChange(post(previewBody), d)).status).toBe(409)
    const e = pdeps({ propose: async () => { throw new DbError('receipt_required') } })
    expect((await handleProposeChange(post(okBody), e)).status).toBe(422)
    expect(d.replays).toHaveLength(0)
    expect(e.replays).toHaveLength(0)
  })
})

describe('change-propose', () => {
  it('Erfolg: gebuchter Preis + Modul(neu) − Modul(alt), mit der gebuchten Preisversion; der Betrag kommt vom Server, der Aufrufer bestätigt ihn nur', async () => {
    const d = pdeps()
    const res = await handleProposeChange(post(okBody), d)
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ revisionId: 'rev-new', totalCents: NEW7 })
    expect(d.versions).toEqual([7])
    expect(d.calls[0]).toMatchObject({ requestId: REQ, baseRevisionId: REV, photoIds: [PH], totalCents: NEW7 })
    expect(d.calls[0]?.inputs).toMatchObject({ hours: 7, crew: 3, service: 'move' })
    // gebuchter Preis zählt, nicht der Modulpreis: abweichender Buchungspreis verschiebt das Ergebnis um genau die Abweichung
    const shifted = BOOKED - 1000 + NEW7 - BOOKED
    const d2 = pdeps({ basis: async () => ({ ...BASIS, totalCents: BOOKED - 1000 }) })
    expect((await json(await handleProposeChange(post({ ...okBody, shownTotalCents: shifted }), d2)))['totalCents']).toBe(shifted)
  })

  it('Vorschau: rechnet und prüft das Tor, legt nichts an; Antwort mit Gesamtpreis und gebuchtem Preis', async () => {
    const d = pdeps()
    const res = await handleProposeChange(post(previewBody), d)
    expect([res.status, await json(res)]).toEqual([200, { totalCents: NEW7, baseCents: BOOKED }])
    expect(d.calls).toHaveLength(0)
    expect(d.versions).toEqual([7])
    // dieselben Sperren wie beim Anlegen: nur erhöhend, Festpreis, Festangebot, Tor
    for (const [body, deps, status, code] of [
      [{ ...previewBody, changes: { hours: 5 } }, pdeps(), 409, 'change_not_increasing'],
      [{ ...previewBody, changes: { goods: 'piano' } }, pdeps(), 409, 'not_fixed_price'],
      [previewBody, pdeps({ basis: async () => ({ ...BASIS, source: 'partner_offer' }) }), 409, 'change_not_allowed'],
      [previewBody, pdeps({ basis: async () => { throw new DbError('partner_not_active') } }), 403, 'partner_not_active'],
      [previewBody, pdeps({ getUser: async () => ({ id: 'p1', aal: 'aal1' }) }), 403, 'mfa_required'],
    ] as const) {
      const res2 = await handleProposeChange(post(body), deps)
      expect([res2.status, (await json(res2))['error']]).toEqual([status, code])
      expect(deps.calls).toHaveLength(0)
    }
  })

  it('anderer gezeigter Betrag: 409 amount_changed ohne Anlegen, auch in der zweiten Runde', async () => {
    for (const shown of [NEW7 - 1, NEW7 + 1]) {
      const d = pdeps()
      const res = await handleProposeChange(post({ ...okBody, shownTotalCents: shown }), d)
      expect([res.status, (await json(res))['error']]).toEqual([409, 'amount_changed'])
      expect(d.calls).toHaveLength(0)
    }
  })

  it('Vorschau und Betrag: preview nur boolean, ohne Belege und ohne gezeigten Betrag; beim Anlegen ist der Betrag Pflicht, eine sichere positive Ganzzahl', async () => {
    const bad: unknown[] = [
      { ...previewBody, preview: 'true' },
      { ...previewBody, preview: 1 },
      { ...previewBody, photoIds: [PH] },
      { ...previewBody, shownTotalCents: NEW7 },
      { ...okBody, preview: false, shownTotalCents: undefined },
      { requestId: REQ, changes: { hours: 7 }, photoIds: [PH] },
      { ...okBody, shownTotalCents: 0 },
      { ...okBody, shownTotalCents: -5 },
      { ...okBody, shownTotalCents: 1.5 },
      { ...okBody, shownTotalCents: String(NEW7) },
      { ...okBody, shownTotalCents: Number.MAX_SAFE_INTEGER + 10 },
    ]
    for (const body of bad) {
      const d = pdeps()
      const res = await handleProposeChange(post(body), d)
      expect([res.status, (await json(res))['error'], JSON.stringify(body)]).toEqual([400, 'invalid_input', JSON.stringify(body)])
      expect(d.calls).toHaveLength(0)
      expect(d.versions).toHaveLength(0)
    }
    // preview: false ist wie ohne Vorschau
    const ok = await handleProposeChange(post({ ...okBody, preview: false }), pdeps())
    expect(ok.status).toBe(200)
  })

  it('401 ohne gültiges JWT, 403 mfa_required bei aal1', async () => {
    expect((await handleProposeChange(post(okBody, {}), pdeps())).status).toBe(401)
    expect((await handleProposeChange(post(okBody), pdeps({ getUser: async () => null }))).status).toBe(401)
    const res = await handleProposeChange(post(okBody), pdeps({ getUser: async () => ({ id: 'p1', aal: 'aal1' }) }))
    expect([res.status, (await json(res))['error']]).toEqual([403, 'mfa_required'])
  })

  it('Eingabe: nur bekannte Felder; Adresse und Route sind gesperrt; Belege 1 bis 8', async () => {
    const bad: [unknown, number, string][] = [
      [{}, 400, 'invalid_input'],
      [{ ...okBody, requestId: 'x' }, 400, 'invalid_input'],
      [{ ...okBody, changes: [] }, 400, 'invalid_input'],
      [{ ...okBody, changes: { hours: 7, unbekannt: 1 } }, 400, 'invalid_input'],
      [{ ...okBody, changes: { service: 'transport' } }, 400, 'invalid_input'],
      [{ ...okBody, changes: { from: { label: 'x' } } }, 422, 'route_locked'],
      [{ ...okBody, changes: { to: { label: 'x' } } }, 422, 'route_locked'],
      [{ ...okBody, changes: { returnTrip: true } }, 422, 'route_locked'],
      [{ ...okBody, changes: { hours: 99999 } }, 422, 'invalid_input'],
      [{ ...okBody, photoIds: [] }, 400, 'invalid_input'],
      [{ ...okBody, photoIds: Array(9).fill(PH) }, 400, 'invalid_input'],
      [{ ...okBody, photoIds: ['x'] }, 400, 'invalid_input'],
      [{ ...okBody, totalCents: 1 }, 400, 'invalid_input'],
      [{ ...okBody, partnerId: 'fremd' }, 400, 'invalid_input'],
    ]
    for (const [body, status, code] of bad) {
      const d = pdeps()
      const res = await handleProposeChange(post(body), d)
      expect([res.status, (await json(res))['error'], JSON.stringify(body)]).toEqual([status, code, JSON.stringify(body)])
      expect(d.calls).toHaveLength(0)
    }
  })

  it('nur erhöhend und nur Festpreis, sonst keine Datenbank-Funktion', async () => {
    for (const [changes, status, code] of [
      [{ hours: 5 }, 409, 'change_not_increasing'],
      [{ hours: 3 }, 409, 'change_not_increasing'],
      [{ goods: 'piano' }, 409, 'not_fixed_price'],
    ] as const) {
      const d = pdeps()
      const res = await handleProposeChange(post({ ...okBody, changes }), d)
      expect([res.status, (await json(res))['error']]).toEqual([status, code])
      expect(d.calls).toHaveLength(0)
    }
  })

  it('fehlende Route bei Transport: kein Festpreis; unvollständiger Tarif: 500 tariff_incomplete', async () => {
    const d = pdeps({ basis: async () => ({ ...BASIS, route: null }) })
    expect((await json(await handleProposeChange(post(okBody), d)))['error']).toBe('not_fixed_price')
    const res = await handleProposeChange(post(okBody), pdeps({ loadPricing: async () => ({ rows: seedRows.slice(1) }) }))
    expect([res.status, (await json(res))['error']]).toEqual([500, 'tariff_incomplete'])
  })

  it('Festangebot: change_not_allowed vor jeder Rechnung; Hash der gebuchten Version geprüft: Abweichung bricht ab, ohne Code in der Antwort', async () => {
    const d = pdeps({ basis: async () => ({ ...BASIS, source: 'partner_offer' }) })
    const res = await handleProposeChange(post(okBody), d)
    expect([res.status, (await json(res))['error']]).toEqual([409, 'change_not_allowed'])
    expect(d.versions).toEqual([])
    const bad = pdeps({ loadPricing: async () => { throw new DbError('version_hash_mismatch') } })
    const r2 = await handleProposeChange(post(okBody), bad)
    expect([r2.status, bad.calls.length]).toEqual([500, 0])
    expect(await r2.text()).not.toContain('hash')
  })

  it('Datenbank-Codes werden abgebildet, Unbekanntes ist 500 ohne Details', async () => {
    const cases: [string, number][] = [
      ['change_not_allowed', 409], ['change_open', 409], ['revision_changed', 409], ['receipt_required', 422], ['partner_not_active', 403],
      ['not_found', 404], ['invalid_transition', 409], ['mfa_required', 403], ['not_fixed_price', 409], ['change_not_increasing', 409],
    ]
    for (const [code, status] of cases) {
      const res = await handleProposeChange(post(okBody), pdeps({ propose: async () => { throw new DbError(code) } }))
      expect([res.status, (await json(res))['error']]).toEqual([status, code])
    }
    const res = await handleProposeChange(post(okBody), pdeps({ propose: async () => { throw new Error('geheim: Detail') } }))
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('geheim')
  })
})

// decide -------------------------------------------------------------------------------------------------------------------
const NEW_TOTAL = 80000
const PRIOR = splitFee(BOOKED, rates)
const DB: DecideBasis = {
  status: 'proposed', totalCents: NEW_TOTAL, feeTiers: [{ upToCents: null, bp: 1500 }], feeVatRate: 0.2, feeScheduleVersion: 1, feeVatRateVersion: 1,
  priorTotal: PRIOR.totalCents, priorFee: PRIOR.feeCents, priorNet: PRIOR.feeNetCents, priorVat: PRIOR.feeVatCents, priorPayout: PRIOR.payoutCents,
}
function ddeps(over: Partial<DecideDeps> = {}): DecideDeps & { calls: DecideCall[] } {
  const calls: DecideCall[] = []
  return {
    calls,
    allowedOrigins: [],
    getUser: async () => ({ id: 'c1', aal: 'aal1' }),
    basis: async () => DB,
    decide: async (_u, c) => {
      calls.push(c)
      return c.accept ? 'accepted' : 'declined'
    },
    log: () => {},
    ...over,
  }
}
const dBody = { revisionId: REV, decision: 'accept', shownTotalCents: NEW_TOTAL }

describe('change-decide', () => {
  it('Annahme: Journalzeile = splitFee(neu) minus bisherige Zeilen; Kunde braucht kein aal2', async () => {
    const d = ddeps()
    const res = await handleDecideChange(post(dBody), d)
    expect([res.status, await json(res)]).toEqual([200, { status: 'accepted' }])
    expect(d.calls[0]?.split).toEqual(splitChange(NEW_TOTAL, rates, PRIOR))
    expect(d.calls[0]).toMatchObject({ revisionId: REV, accept: true, shownTotalCents: NEW_TOTAL })
  })

  it('Ablehnung ruft die Funktion ohne Gebührenrechnung; gleiche Entscheidung nach Abschluss ist idempotent', async () => {
    const d = ddeps()
    const res = await handleDecideChange(post({ revisionId: REV, decision: 'decline' }), d)
    expect([res.status, await json(res)]).toEqual([200, { status: 'declined' }])
    expect(d.calls[0]).toMatchObject({ accept: false })
    const done = ddeps({ basis: async () => ({ ...DB, status: 'accepted' }) })
    expect([(await handleDecideChange(post(dBody), done)).status, done.calls.length]).toEqual([200, 0])
  })

  it('Eingabe und Betrag: 400, 401, anderer gezeigter Betrag 409 amount_changed ohne Aufruf', async () => {
    expect((await handleDecideChange(post(dBody, {}), ddeps())).status).toBe(401)
    for (const bad of [{}, { ...dBody, revisionId: 'x' }, { ...dBody, decision: 'maybe' }, { ...dBody, shownTotalCents: 1.5 }, { revisionId: REV, decision: 'accept' }, { ...dBody, partnerId: 'x' }]) {
      expect((await handleDecideChange(post(bad), ddeps())).status).toBe(400)
    }
    const d = ddeps()
    const res = await handleDecideChange(post({ ...dBody, shownTotalCents: NEW_TOTAL + 1 }), d)
    expect([res.status, (await json(res))['error']]).toEqual([409, 'amount_changed'])
    expect(d.calls).toHaveLength(0)
  })

  it('veralteter Satz: einmal neu laden, dann neutral retry; nie ein fee_*-Code oder eine Gebühr in der Antwort', async () => {
    for (const code of ['rate_mismatch', 'amount_mismatch', 'fee_basis_changed', 'shown_total_mismatch']) {
      let n = 0
      const once = ddeps({ decide: async () => { if (n++ === 0) throw new DbError(code); return 'accepted' } })
      expect((await handleDecideChange(post(dBody), once)).status).toBe(200)
      const always = ddeps({ decide: async () => { throw new DbError(code) } })
      const res = await handleDecideChange(post(dBody), always)
      const text = await res.text()
      expect([res.status, JSON.parse(text)]).toEqual([409, { error: 'retry' }])
      expect(text).not.toMatch(/fee|rate|commission|payout/i)
    }
  })

  it('Nachtrag nicht mehr offen: 409 invalid_transition bzw. change_not_valid statt 500, keine Rechnung', async () => {
    for (const [status, code] of [['declined', 'invalid_transition'], ['withdrawn', 'invalid_transition'], ['expired', 'change_not_valid']] as const) {
      const d = ddeps({ basis: async () => ({ ...DB, status, priorTotal: NEW_TOTAL + 5000 }) })
      const res = await handleDecideChange(post(dBody), d)
      expect([res.status, (await json(res))['error'], d.calls.length]).toEqual([409, code, 0])
    }
  })

  it('Datenbank-Codes: partner_not_active 409, nicht gültig 409, fremder Kunde 404, Unbekanntes 500 ohne Details', async () => {
    const pna = await handleDecideChange(post(dBody), ddeps({ decide: async () => 'partner_not_active' }))
    expect([pna.status, (await json(pna))['error']]).toEqual([409, 'partner_not_active'])
    for (const [code, status] of [['change_not_valid', 409], ['invalid_transition', 409], ['not_found', 404]] as const) {
      const res = await handleDecideChange(post(dBody), ddeps({ decide: async () => { throw new DbError(code) } }))
      expect([res.status, (await json(res))['error']]).toEqual([status, code])
    }
    const nf = await handleDecideChange(post(dBody), ddeps({ basis: async () => { throw new DbError('not_found') } }))
    expect(nf.status).toBe(404)
    const res = await handleDecideChange(post(dBody), ddeps({ decide: async () => { throw new Error('geheim: Detail') } }))
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('geheim')
  })
})
