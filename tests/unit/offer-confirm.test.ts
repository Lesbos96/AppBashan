// Handler von offer-confirm (S9e) mit Fakes. Die Gebühr rechnet allein splitFee; Kundenantworten tragen nie einen fee_/rate_/vat_-Code.
import { describe, expect, it } from 'vitest'
import { splitFee } from '@pricing'
import { DbError, handleConfirmOffer, type OfferDeps } from '../../supabase/functions/_shared/jobs/handlers.ts'

const O = '11111111-1111-4111-8111-111111111111'
const BASIS = { amountCents: 150000, feeRate: 0.15, feeVatRate: 0.2, feeRateVersion: 1, feeVatRateVersion: 1 }

const req = (body: unknown, headers: Record<string, string> = { authorization: 'Bearer t' }) =>
  new Request('https://x.test/offer-confirm', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })

function deps(over: Partial<OfferDeps> = {}): OfferDeps & { calls: unknown[] } {
  const calls: unknown[] = []
  return {
    calls,
    allowedOrigins: [],
    getUser: async () => ({ id: 'cust', aal: 'aal1' }), // Kunden haben kein aal2
    basis: async () => BASIS,
    confirm: async (_u, _o, _b, split) => {
      calls.push(split)
      return 'confirmed'
    },
    log: () => {},
    ...over,
  }
}
const ok = { offerId: O, shownAmountCents: 150000 }

describe('offer-confirm', () => {
  it('Erfolg ohne aal2: Gebühr aus splitFee, Antwort ohne Gebührenangabe', async () => {
    const d = deps()
    const res = await handleConfirmOffer(req(ok), d)
    expect(res.status).toBe(200)
    const text = JSON.stringify(await res.json())
    expect(text).toBe('{"status":"confirmed"}')
    expect(d.calls[0]).toEqual(splitFee(150000, { feeRate: 0.15, vatRate: 0.2 }))
  })

  it('ohne oder mit ungültigem JWT 401; falsche Eingabe 400; abweichender Betrag 409 ohne Aufruf', async () => {
    expect((await handleConfirmOffer(req(ok, {}), deps())).status).toBe(401)
    expect((await handleConfirmOffer(req(ok), deps({ getUser: async () => null }))).status).toBe(401)
    for (const bad of [{}, { ...ok, offerId: 'x' }, { ...ok, shownAmountCents: 1.5 }, { ...ok, shownAmountCents: 0 }]) {
      expect((await handleConfirmOffer(req(bad), deps())).status).toBe(400)
    }
    const d = deps()
    const res = await handleConfirmOffer(req({ ...ok, shownAmountCents: 149999 }), d)
    expect([res.status, (await res.json()).error]).toEqual([409, 'amount_changed'])
    expect(d.calls).toHaveLength(0)
  })

  it('Firma nicht aktiv: 409 partner_not_active; Datenbank-Codes werden abgebildet, Unbekanntes ist 500', async () => {
    const na = await handleConfirmOffer(req(ok), deps({ confirm: async () => 'partner_not_active' }))
    expect([na.status, (await na.json()).error]).toEqual([409, 'partner_not_active'])
    const cases: [string, number, string][] = [['offer_not_valid', 409, 'offer_not_valid'], ['partner_job_limit', 409, 'offer_unavailable'], ['not_found', 404, 'not_found'], ['invalid_transition', 409, 'invalid_transition']]
    for (const [code, status, shown] of cases) {
      const res = await handleConfirmOffer(req(ok), deps({ confirm: async () => { throw new DbError(code) } }))
      expect([res.status, (await res.json()).error]).toEqual([status, shown])
    }
    const bad = await handleConfirmOffer(req(ok), deps({ confirm: async () => { throw new Error('geheim') } }))
    expect([bad.status, JSON.stringify(await bad.json())]).toEqual([500, '{"error":"internal"}'])
  })

  it('Satzwechsel: einmal neu laden, dann neutral `retry`; kein fee_-, rate_- oder vat_-Code an den Kunden', async () => {
    for (const code of ['rate_mismatch', 'amount_mismatch', 'vat_rule_missing', 'setting_missing']) {
      let n = 0
      const ok1 = await handleConfirmOffer(req(ok), deps({ confirm: async () => { if (n++ === 0) throw new DbError(code); return 'confirmed' } }))
      expect(ok1.status, code).toBe(200)
      expect(n).toBe(2)
      const res = await handleConfirmOffer(req(ok), deps({ confirm: async () => { throw new DbError(code) } }))
      const text = JSON.stringify(await res.json())
      expect([res.status, text]).toEqual([409, '{"error":"retry"}'])
      expect(text).not.toMatch(/fee|rate|vat/)
    }
  })
})
