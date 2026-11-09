// outbox-send (S9c-11 K3): ein Fehler beim Markieren zählt nicht als SMTP-Fehler und bricht den Lauf nicht ab.
import { describe, expect, it } from 'vitest'
import { handleOutbox, type OutboxDeps, type OutboxRow } from '../../supabase/functions/_shared/jobs/handlers.ts'

const rows = (n: number): OutboxRow[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, kind: 'listing_new', recipientKind: 'partner', recipientId: 'p', partnerEmail: `p${i + 1}@example.test` }))

function deps(claimed: OutboxRow[], over: Partial<OutboxDeps> = {}): OutboxDeps & { marks: [number, boolean, string | null][]; logs: Record<string, unknown>[]; sent: string[] } {
  const marks: [number, boolean, string | null][] = []
  const logs: Record<string, unknown>[] = []
  const sent: string[] = []
  return {
    marks,
    logs,
    sent,
    secret: 'o',
    claim: async () => claimed,
    mark: async (id, ok, error) => void marks.push([id, ok, error]),
    customerEmail: async () => null,
    completionDays: async () => 7,
    send: async (m) => void sent.push(m.to),
    appUrl: 'https://app.test',
    log: (e) => void logs.push(e),
    ...over,
  }
}
const call = (d: OutboxDeps) => handleOutbox(new Request('https://x.test/outbox', { method: 'POST', headers: { 'x-outbox-secret': 'o' }, body: '{}' }), d)

describe('outbox-send Markieren (K3)', () => {
  it('Mail ging raus, mark(true) schlägt fehl: kein zweites mark(false), nicht als SMTP-Fehler gezählt, Lauf geht weiter', async () => {
    const d = deps(rows(2), {
      mark: async (id, ok, error) => {
        d.marks.push([id, ok, error])
        if (id === 1) throw new Error('db down')
      },
    })
    const res = await call(d)
    expect(await res.json()).toEqual({ sent: 2, failed: 0 })
    expect(d.sent).toEqual(['p1@example.test', 'p2@example.test'])
    expect(d.marks).toEqual([[1, true, null], [2, true, null]]) // keine Gegenbuchung (false) für die versendete Mail
    expect(d.logs.map((l) => l.event)).toContain('outbox_mark_failed')
    expect(JSON.stringify(d.logs)).not.toContain('example.test')
  })

  it('Versand scheitert und auch mark(false) scheitert: der Lauf zählt es als Fehler und verarbeitet die nächste Zeile', async () => {
    const d = deps(rows(2), {
      send: async (m) => {
        if (m.to === 'p1@example.test') throw Object.assign(new Error('550 5.1.1 p1@example.test unknown'), { responseCode: 550 })
        d.sent.push(m.to)
      },
      mark: async (id, ok, error) => {
        d.marks.push([id, ok, error])
        if (!ok) throw new Error('db down')
      },
    })
    const res = await call(d)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: 1, failed: 1 })
    expect(d.sent).toEqual(['p2@example.test'])
    expect(d.marks).toEqual([[1, false, 'smtp_rejected'], [2, true, null]])
    expect(d.logs.map((l) => l.event)).toEqual(['outbox_failed', 'outbox_mark_failed'])
    expect(JSON.stringify(d.logs)).not.toContain('example.test')
  })
})

describe('outbox-send Abschluss (S9g)', () => {
  it('completion_ask und completion_auto gehen an den Kunden, ohne Gebühr oder Provision im Text', async () => {
    const mails: { to: string; subject: string; text: string }[] = []
    const claimed: OutboxRow[] = ['completion_ask', 'completion_auto'].map((kind, i) => ({ id: i + 1, kind, recipientKind: 'customer', recipientId: 'u', partnerEmail: null }))
    const d = deps(claimed, { customerEmail: async () => 'kunde@example.test', send: async (m) => void mails.push(m) })
    expect(await (await call(d)).json()).toEqual({ sent: 2, failed: 0 })
    expect(mails.map((m) => m.subject)).toEqual(['Hat dein Auftrag stattgefunden?', 'Dein Auftrag gilt als durchgeführt'])
    for (const m of mails) expect(m.subject + m.text).not.toMatch(/Gebühr|Provision|15 ?%/i)
  })

  it('S9g-N2: fehlt completion_days, steht im Log setting_missing statt smtp_error', async () => {
    const d = deps([{ id: 1, kind: 'completion_ask', recipientKind: 'customer', recipientId: 'u', partnerEmail: null }], {
      customerEmail: async () => 'k@example.test',
      completionDays: async () => { throw Object.assign(new Error('setting_missing'), { code: 'setting_missing' }) },
    })
    await call(d)
    expect(d.marks).toEqual([[1, false, 'setting_missing']])
  })

  it('S9g-7: completion_ask nennt die Tageszahl aus completion_days, nicht eine feste 7; request_cancelled geht an die Firma ohne Gebühr', async () => {
    const mails: { to: string; subject: string; text: string }[] = []
    const claimed: OutboxRow[] = [
      { id: 1, kind: 'completion_ask', recipientKind: 'customer', recipientId: 'u', partnerEmail: null },
      { id: 2, kind: 'request_cancelled', recipientKind: 'partner', recipientId: 'p', partnerEmail: 'p@example.test' },
    ]
    const d = deps(claimed, { customerEmail: async () => 'kunde@example.test', completionDays: async () => 3, send: async (m) => void mails.push(m) })
    expect(await (await call(d)).json()).toEqual({ sent: 2, failed: 0 })
    expect(mails[0]?.text).toContain('3 Tage nach dem Termin')
    expect(mails[0]?.text).not.toContain('7 Tage')
    expect(mails[1]?.to).toBe('p@example.test')
    for (const m of mails) expect(m.subject + m.text).not.toMatch(/Gebühr|Provision|15 ?%/i)
    const one = deps([{ id: 1, kind: 'completion_ask', recipientKind: 'customer', recipientId: 'u', partnerEmail: null }], { customerEmail: async () => 'k@example.test', completionDays: async () => 1, send: async (m) => void mails.push(m) })
    await call(one)
    expect(mails[2]?.text).toContain('1 Tag nach dem Termin')
  })
})
