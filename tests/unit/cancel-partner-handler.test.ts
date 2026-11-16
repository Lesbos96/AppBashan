// cancel-partner (S9h-2): Handler der Edge Function mit Fakes. Partner brauchen aal2; die Pauschale (call_out_fee_cents, höchstens der Gesamtpreis)
// rechnet splitFee mit dem eingefrorenen Satz der Buchung, sie fällt nur mit Belegfotos an. Die Datenbank prüft Grund, Nachtrag und Belege.
import { describe, expect, it } from 'vitest'
import { handleCancelPartner, type PartnerBasis, type PartnerCall, type PartnerDeps } from '../../supabase/functions/_shared/cancel/partner.ts'
import { DbError } from '../../supabase/functions/_shared/jobs/handlers.ts'
import { splitFee } from '@pricing'

const REQ = '0b9f6e0e-6d52-4b7e-9d5c-3f0c2f9a1b11'
const PHOTO = '5d0c1a2e-8f3b-4c4d-9e6f-7a8b9c0d1e2f'
const basis = (over: Partial<PartnerBasis> = {}): PartnerBasis => ({
  status: 'accepted', totalCents: 68961, callOutCents: 6900, feeTiers: [{ upToCents: null, bp: 1500 }], feeVatRate: 0.2, feeScheduleVersion: 1, feeVatRateVersion: 1, ...over,
})

type Fake = PartnerDeps & { calls: PartnerCall[]; basisCalls: number; aals: string[]; reasons: string[]; logs: Record<string, unknown>[]; replays: unknown[][] }
function deps(over: Partial<PartnerDeps> = {}, aal = 'aal2'): Fake {
  const d: Fake = {
    replays: [] as unknown[][],
    replay: async (...a: unknown[]) => {
      d.replays.push(a)
      return null
    },
    calls: [] as PartnerCall[],
    basisCalls: 0,
    aals: [] as string[],
    reasons: [] as string[],
    logs: [] as Record<string, unknown>[],
    allowedOrigins: [],
    getUser: async (jwt: string) => (jwt === 'ok' ? { id: 'u1', aal } : null),
    basis: async (_u: string, a: string, _r: string, reason: string) => {
      d.basisCalls++
      d.aals.push(a)
      d.reasons.push(reason)
      return basis()
    },
    cancel: async (_u: string, _a: string, c: PartnerCall) => {
      d.calls.push(c)
      return 'cancelled_by_partner'
    },
    log: (e: Record<string, unknown>) => void d.logs.push(e),
    ...over,
  }
  return d
}
const call = (d: PartnerDeps, body: unknown = { requestId: REQ, reason: 'unavailable', shownCallOutCents: 0 }, jwt = 'ok') =>
  handleCancelPartner(new Request('https://x.test/cancel', { method: 'POST', headers: jwt ? { authorization: `Bearer ${jwt}` } : {}, body: JSON.stringify(body) }), d)

describe('handleCancelPartner: Wiederholung nach Erfolg (n12b)', () => {
  const ended = async () => {
    throw new DbError('not_found')
  }
  const body = { requestId: REQ, reason: 'scope_impossible', photoIds: [PHOTO], shownCallOutCents: 6900 }
  it('Grundlage meldet not_found (Zuordnung beendet) und die Firma hat selbst abgesagt: 200 mit dem ersten Ergebnis, nichts wird gebucht', async () => {
    const d = deps({ basis: ended, replay: async (...a: unknown[]) => (d.replays.push(a), 'cancelled_by_partner') })
    const res = await call(d, body)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'cancelled_by_partner', callOutCents: 6900 })
    expect(d.replays).toEqual([['u1', REQ, 'scope_impossible', [PHOTO], 6900]])
    expect(d.calls).toHaveLength(0)
  })
  it('ohne Belege: Betrag 0 und leere Belegmenge gehen an die Nachfrage', async () => {
    const d = deps({ basis: ended, replay: async (...a: unknown[]) => (d.replays.push(a), 'cancelled_by_partner') })
    const res = await call(d)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'cancelled_by_partner', callOutCents: 0 })
    expect(d.replays).toEqual([['u1', REQ, 'unavailable', [], 0]])
  })
  it('Wettlauf: not_found erst beim Absagen (der andere Aufruf war schneller): ebenso 200', async () => {
    const d = deps({ cancel: ended, replay: async () => 'cancelled_by_partner' })
    const res = await call(d, body)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'cancelled_by_partner', callOutCents: 6900 })
  })
  it('keine Wiederholung der eigenen Partei (null): der ursprüngliche Fehler, 404 not_found', async () => {
    const d = deps({ basis: ended })
    const res = await call(d, body)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
    expect(d.replays).toHaveLength(1)
  })
  it('Fehler der Nachfrage: 500 internal, kein Ergebnis', async () => {
    const d = deps({ basis: ended, replay: async () => { throw new Error('boom') } })
    const res = await call(d, body)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'internal' })
  })
  it('Vorschau und andere Fehler (invalid_transition, under_review) fragen nie nach', async () => {
    const d = deps({ basis: ended })
    expect((await call(d, { requestId: REQ, reason: 'scope_impossible', preview: true })).status).toBe(404)
    const e = deps({ basis: async () => { throw new DbError('invalid_transition') } })
    expect((await call(e, body)).status).toBe(409)
    expect(d.replays).toHaveLength(0)
    expect(e.replays).toHaveLength(0)
  })
})

describe('handleCancelPartner', () => {
  it('ohne Belege: keine Pauschale, Aufteilung 0', async () => {
    const d = deps()
    const res = await call(d)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'cancelled_by_partner', callOutCents: 0 })
    expect(d.calls[0]).toMatchObject({ requestId: REQ, reason: 'unavailable', photoIds: [], feeBaseCents: 0 })
    expect(d.calls[0]?.split).toEqual({ totalCents: 0, feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 })
    expect(d.aals).toEqual(['aal2'])
  })

  it('mit Belegen: Pauschale aus der Grundlage, Aufteilung mit dem Satz der Buchung', async () => {
    const d = deps()
    const res = await call(d, { requestId: REQ, reason: 'scope_impossible', photoIds: [PHOTO], shownCallOutCents: 6900 })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'cancelled_by_partner', callOutCents: 6900 })
    expect(d.calls[0]?.feeBaseCents).toBe(6900)
    expect(d.calls[0]?.split).toEqual(splitFee(6900, { tiers: [{ upToCents: null, bp: 1500 }], vatRate: 0.2 }))
    expect(d.calls[0]?.photoIds).toEqual([PHOTO])
    expect(d.reasons).toEqual(['scope_impossible'])
  })

  it('Vorschau: Betrag und Auszahlung der Pauschale für die Firma, nichts wird geschrieben', async () => {
    const d = deps()
    const res = await call(d, { requestId: REQ, reason: 'scope_impossible', preview: true })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ callOutCents: 6900, payoutCents: splitFee(6900, { tiers: [{ upToCents: null, bp: 1500 }], vatRate: 0.2 }).payoutCents })
    expect(d.calls).toEqual([])
    expect(d.basisCalls).toBe(1)
    const none = deps({ basis: async () => basis({ callOutCents: 0 }) })
    expect(await (await call(none, { requestId: REQ, reason: 'other', preview: true })).json()).toEqual({ callOutCents: 0, payoutCents: 0 })
  })

  it('Vorschau: aal1 403, Fehler der Datenbank wie beim Storno, keine fremden Felder', async () => {
    expect((await call(deps({}, 'aal1'), { requestId: REQ, reason: 'other', preview: true })).status).toBe(403)
    const d = deps({ basis: async () => { throw new DbError('under_review') } })
    expect((await call(d, { requestId: REQ, reason: 'other', preview: true })).status).toBe(409)
    for (const bad of [
      { requestId: REQ, reason: 'other', preview: true, photoIds: [] },
      { requestId: REQ, reason: 'other', preview: true, shownCallOutCents: 0 },
      { requestId: REQ, reason: 'other', preview: 'yes' },
      { requestId: REQ, reason: 'other', preview: true, amount: 5 },
    ]) {
      expect((await call(deps(), bad)).status, JSON.stringify(bad)).toBe(400)
    }
  })

  it('gezeigter Betrag weicht ab: 409 amount_changed, nichts wird gebucht (Belege oder nicht)', async () => {
    const d = deps({ basis: async () => basis({ callOutCents: 7000 }) })
    const res = await call(d, { requestId: REQ, reason: 'scope_impossible', photoIds: [PHOTO], shownCallOutCents: 6900 })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'amount_changed' })
    expect(d.calls).toEqual([])
    const e = deps({ basis: async () => basis({ callOutCents: 0 }) })
    expect((await call(e, { requestId: REQ, reason: 'scope_impossible', photoIds: [PHOTO], shownCallOutCents: 6900 })).status).toBe(409)
    expect(e.calls).toEqual([])
  })

  it('zweiter Durchlauf nach Satzwechsel vergleicht erneut: neuer Betrag, nie ein ungezeigter', async () => {
    let n = 0
    let sent = 0
    const d = deps({
      basis: async () => basis({ callOutCents: ++n === 1 ? 6900 : 7000 }),
      cancel: async () => {
        sent++
        throw new DbError('fee_basis_changed')
      },
    })
    const res = await call(d, { requestId: REQ, reason: 'scope_impossible', photoIds: [PHOTO], shownCallOutCents: 6900 })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'amount_changed' })
    expect(n).toBe(2)
    expect(sent).toBe(1)
  })

  it('Belege und gezeigte Pauschale gehören zusammen: sonst 400', async () => {
    for (const bad of [
      { requestId: REQ, reason: 'scope_impossible', photoIds: [PHOTO], shownCallOutCents: 0 },
      { requestId: REQ, reason: 'scope_impossible', shownCallOutCents: 6900 },
      { requestId: REQ, reason: 'scope_impossible', photoIds: [], shownCallOutCents: 6900 },
      { requestId: REQ, reason: 'other' },
      { requestId: REQ, reason: 'other', shownCallOutCents: -1 },
      { requestId: REQ, reason: 'other', shownCallOutCents: 1.5 },
      { requestId: REQ, reason: 'other', shownCallOutCents: '0' },
      { requestId: REQ, reason: 'other', shownCallOutCents: Number.MAX_SAFE_INTEGER + 2 },
    ]) {
      const d = deps()
      expect((await call(d, bad)).status, JSON.stringify(bad)).toBe(400)
      expect(d.basisCalls).toBe(0)
    }
  })

  it('aal1: 403 mfa_required, nichts wird geladen', async () => {
    const d = deps({}, 'aal1')
    const res = await call(d)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'mfa_required' })
    expect(d.basisCalls).toBe(0)
  })

  it('Satzcodes: einmal neu laden, danach neutral `retry` (409)', async () => {
    let n = 0
    const d = deps({
      cancel: async (_u, _a, c) => {
        n++
        if (n === 1) throw new DbError('fee_basis_changed')
        d.calls.push(c)
        return 'cancelled_by_partner'
      },
    })
    expect((await call(d)).status).toBe(200)
    expect(d.basisCalls).toBe(2)
    for (const code of ['fee_basis_changed', 'rate_mismatch', 'amount_mismatch']) {
      const e = deps({ cancel: async () => { throw new DbError(code) } })
      const res = await call(e)
      expect(res.status).toBe(409)
      expect(JSON.stringify(await res.json())).toBe('{"error":"retry"}')
      expect(e.basisCalls).toBe(2)
    }
  })

  it('Fehlercodes der Datenbank: Status; unbekannter Fehler 500 ohne Details', async () => {
    for (const [code, status] of [
      ['not_found', 404], ['invalid_transition', 409], ['partner_not_active', 403], ['reason_required', 422],
      ['call_out_not_allowed', 409], ['receipt_required', 422], ['too_late_for_reason', 409], ['terms_missing', 500],
    ] as const) {
      const d = deps({ cancel: async () => { throw new DbError(code) } })
      const res = await call(d)
      expect(res.status, code).toBe(status)
      if (status !== 500) expect(await res.json()).toEqual({ error: code })
    }
    const d = deps({ cancel: async () => { throw new Error('boom secret') } })
    const res = await call(d)
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('boom')
    expect(JSON.stringify(d.logs)).toContain('cancel_partner_failed')
  })

  it('Eingabe: 401, 400 (Grund, Belege, Felder), 405', async () => {
    expect((await call(deps(), { requestId: REQ, reason: 'other', shownCallOutCents: 0 }, '')).status).toBe(401)
    for (const bad of [
      { requestId: 'x', reason: 'other', shownCallOutCents: 0 },
      { requestId: REQ, shownCallOutCents: 0 },
      { requestId: REQ, reason: 'bogus', shownCallOutCents: 0 },
      { requestId: REQ, reason: 'other', photoIds: 'x', shownCallOutCents: 0 },
      { requestId: REQ, reason: 'other', photoIds: ['x'], shownCallOutCents: 6900 },
      { requestId: REQ, reason: 'other', photoIds: Array(9).fill(PHOTO), shownCallOutCents: 6900 },
      { requestId: REQ, reason: 'other', shownCallOutCents: 0, amount: 5 },
    ]) {
      expect((await call(deps(), bad)).status).toBe(400)
    }
    expect((await handleCancelPartner(new Request('https://x.test/c', { method: 'GET' }), deps())).status).toBe(405)
  })
})
