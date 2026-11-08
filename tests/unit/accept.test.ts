// Handler von accept, admin-contact und outbox-send (S9c) mit Fakes. Die Gebühr rechnet allein splitFee; Kundenantworten kommen hier nicht vor.
import { describe, expect, it } from 'vitest'
import { splitFee } from '@pricing'
import { type AcceptDeps, DbError, handleAccept, handleAdminContact, handleOutbox, type OutboxRow } from '../../supabase/functions/_shared/jobs/handlers.ts'

const L = '11111111-1111-4111-8111-111111111111'
const R = '22222222-2222-4222-8222-222222222222'
const BASIS = { revisionId: R, totalCents: 68961, feeRate: 0.15, feeVatRate: 0.2, feeRateVersion: 1, feeVatRateVersion: 1 }
const PAYOUT = splitFee(68961, { feeRate: 0.15, vatRate: 0.2 }).payoutCents

const req = (body: unknown, headers: Record<string, string> = { authorization: 'Bearer t' }) =>
  new Request('https://x.test/accept', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })

function deps(over: Partial<AcceptDeps> = {}): AcceptDeps & { calls: unknown[] } {
  const calls: unknown[] = []
  return {
    calls,
    allowedOrigins: [],
    getUser: async () => ({ id: 'u1', aal: 'aal2' }),
    basis: async () => BASIS,
    accept: async (_u, c) => {
      calls.push(c)
      return 'assign-1'
    },
    log: () => {},
    ...over,
  }
}
const ok = { listingId: L, revisionId: R, shownPayoutCents: PAYOUT }

describe('accept', () => {
  it('Erfolg: rechnet die Gebühr mit splitFee und ruft die Datenbank-Funktion', async () => {
    const d = deps()
    const res = await handleAccept(req(ok), d)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ assignmentId: 'assign-1' })
    const c = d.calls[0] as { split: ReturnType<typeof splitFee> }
    expect(c.split).toEqual(splitFee(68961, { feeRate: 0.15, vatRate: 0.2 }))
  })

  it('ohne JWT 401, ungültiges JWT 401, aal1 403 mfa_required', async () => {
    expect((await handleAccept(req(ok, {}), deps())).status).toBe(401)
    expect((await handleAccept(req(ok), deps({ getUser: async () => null }))).status).toBe(401)
    const res = await handleAccept(req(ok), deps({ getUser: async () => ({ id: 'u1', aal: 'aal1' }) }))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'mfa_required' })
  })

  it('Eingabe: nur eigene IDs und ganze Cent; ein partner_id im Body wird nie benutzt', async () => {
    for (const bad of [{}, { ...ok, listingId: 'x' }, { ...ok, shownPayoutCents: 1.5 }, { ...ok, shownPayoutCents: 0 }, { ...ok, revisionId: 5 }]) {
      expect((await handleAccept(req(bad), deps())).status).toBe(400)
    }
    const d = deps()
    await handleAccept(req({ ...ok, partnerId: 'fremd', partner_id: 'fremd' }), d)
    expect(JSON.stringify(d.calls)).not.toContain('fremd')
  })

  it('Revision oder Auszahlung weichen ab: 409 ohne Aufruf der Datenbank-Funktion', async () => {
    const d = deps()
    const a = await handleAccept(req({ ...ok, revisionId: '33333333-3333-4333-8333-333333333333' }), d)
    expect([a.status, (await a.json()).error]).toEqual([409, 'revision_changed'])
    const b = await handleAccept(req({ ...ok, shownPayoutCents: PAYOUT + 1 }), d)
    expect([b.status, (await b.json()).error]).toEqual([409, 'payout_changed'])
    expect(d.calls).toHaveLength(0)
  })

  it('Datenbank-Codes werden auf Status abgebildet, Unbekanntes ist 500 ohne Details', async () => {
    const cases: [string, number][] = [['already_taken', 409], ['expired', 409], ['partner_job_limit', 409], ['partner_not_active', 403], ['not_found', 404], ['offer_required', 409]]
    for (const [code, status] of cases) {
      const res = await handleAccept(req(ok), deps({ accept: async () => { throw new DbError(code) } }))
      expect([res.status, (await res.json()).error]).toEqual([status, code])
    }
    const res = await handleAccept(req(ok), deps({ accept: async () => { throw new Error('geheim: Detail') } }))
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('geheim')
  })

  it('veralteter Satz: einmal mit frischen Werten, sonst 409 fee_rate_changed', async () => {
    let n = 0
    const retry = deps({ accept: async () => { if (n++ === 0) throw new DbError('rate_mismatch'); return 'assign-2' } })
    expect((await handleAccept(req(ok), retry)).status).toBe(200)
    const stuck = deps({ accept: async () => { throw new DbError('rate_mismatch') } })
    const res = await handleAccept(req(ok), stuck)
    expect([res.status, (await res.json()).error]).toEqual([409, 'fee_rate_changed'])
  })

  it('OPTIONS und falsche Methode', async () => {
    expect((await handleAccept(new Request('https://x.test', { method: 'OPTIONS' }), deps())).status).toBe(204)
    expect((await handleAccept(new Request('https://x.test', { method: 'GET' }), deps())).status).toBe(405)
  })
})

describe('admin-contact', () => {
  const base = { allowedOrigins: [], getUser: async () => ({ id: 'adm', aal: 'aal2' }), contact: async () => ({ name: 'K' }), log: () => {} }
  const call = { requestId: L, reason: 'Supportfall 4711 laut Kunde' }
  it('aal2 nötig, Eingabe geprüft, Fehlercodes abgebildet', async () => {
    expect((await handleAdminContact(req(call), base)).status).toBe(200)
    expect((await handleAdminContact(req(call), { ...base, getUser: async () => ({ id: 'adm', aal: 'aal1' }) })).status).toBe(403)
    expect((await handleAdminContact(req({ requestId: 'x', reason: 'abc' }), base)).status).toBe(400)
    expect((await handleAdminContact(req(call), { ...base, contact: async () => { throw new DbError('not_admin') } })).status).toBe(403)
    expect((await handleAdminContact(req(call), { ...base, contact: async () => null })).status).toBe(404)
  })
})

describe('outbox-send', () => {
  const rows: OutboxRow[] = [
    { id: 1, kind: 'request_accepted', recipientKind: 'customer', recipientId: 'c1', partnerEmail: null },
    { id: 2, kind: 'listing_new', recipientKind: 'partner', recipientId: 'p1', partnerEmail: 'firma@movenow.test' },
    { id: 3, kind: 'listing_new', recipientKind: 'partner', recipientId: 'p2', partnerEmail: null },
  ]
  const mk = () => {
    const marks: [number, boolean][] = []
    const sent: { to: string; subject: string; text: string }[] = []
    return {
      marks,
      sent,
      d: {
        secret: 'geheim',
        claim: async () => rows,
        mark: async (id: number, ok: boolean) => { marks.push([id, ok]) },
        customerEmail: async () => 'kunde@movenow.test',
        send: async (m: { to: string; subject: string; text: string }) => { sent.push(m) },
        appUrl: 'https://app.movenow.test',
        log: () => {},
      },
    }
  }
  it('Secret nötig; sendet, markiert, zählt Fehler ohne Empfänger', async () => {
    const { d, marks, sent } = mk()
    expect((await handleOutbox(new Request('https://x.test', { method: 'POST' }), d)).status).toBe(401)
    expect((await handleOutbox(new Request('https://x.test', { method: 'POST', headers: { 'x-outbox-secret': 'falsch!' } }), d)).status).toBe(401)
    const res = await handleOutbox(new Request('https://x.test', { method: 'POST', headers: { 'x-outbox-secret': 'geheim' } }), d)
    expect(await res.json()).toEqual({ sent: 2, failed: 1 })
    expect(marks).toEqual([[1, true], [2, true], [3, false]])
    expect(sent.map((m) => m.to)).toEqual(['kunde@movenow.test', 'firma@movenow.test'])
    expect(sent.every((m) => !/gebühr|provision|15 ?%/i.test(m.subject + m.text))).toBe(true)
  })

  it('SMTP-Fehler: nur feste Codes in Log und Outbox, nie die Adresse aus der Fehlermeldung', async () => {
    const { d, marks } = mk()
    const logs: Record<string, unknown>[] = []
    const errs: string[] = []
    const reject = Object.assign(new Error('550 <kunde@movenow.test> Recipient address rejected'), { responseCode: 550 })
    const res = await handleOutbox(new Request('https://x.test', { method: 'POST', headers: { 'x-outbox-secret': 'geheim' } }), {
      ...d,
      send: async () => { throw reject },
      log: (e) => logs.push(e),
      mark: async (id, ok, error) => { marks.push([id, ok]); if (error) errs.push(error) },
    })
    expect(await res.json()).toEqual({ sent: 0, failed: 3 })
    expect(errs).toEqual(['smtp_rejected', 'smtp_rejected', 'no_recipient'])
    expect(JSON.stringify(logs) + errs.join()).not.toContain('@')
  })
})
