// outbox-send (S9c-11 K3, mail1): ein Fehler beim Markieren zählt nicht als Versandfehler und bricht den Lauf nicht ab. Adressen mit Testendung
// (.test) werden nie versendet; die Tests nutzen example.com, wenn gesendet werden soll.
import { describe, expect, it } from 'vitest'
import { MailError } from '../../supabase/functions/_shared/jobs/brevo.ts'
import { handleOutbox, type OutboxDeps, type OutboxRow } from '../../supabase/functions/_shared/jobs/handlers.ts'

const rows = (n: number): OutboxRow[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, kind: 'listing_new', recipientKind: 'partner', recipientId: 'p', requestId: null, partnerEmail: `p${i + 1}@example.com` }))
const mk = (kind: string, recipientKind: string, over: Partial<OutboxRow> = {}): OutboxRow => ({ id: 1, kind, recipientKind, recipientId: recipientKind === 'operator' ? null : 'u', requestId: null, partnerEmail: null, ...over })
type Mail = { to: string; subject: string; text: string }
const body = (m: Mail | undefined) => `${m?.subject ?? ''}\n${m?.text ?? ''}`

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
    requestCustomerEmail: async () => 'kunde@example.com',
    enRouteExpired: async () => false,
    completionDays: async () => 7,
    send: async (m) => void sent.push(m.to),
    operatorEmail: 'betreiber@example.com',
    devGuard: true, // wie auf Dev; die Fälle ohne Schalter setzen es ausdrücklich auf false
    appUrl: 'https://app.test',
    log: (e) => void logs.push(e),
    ...over,
  }
}
const call = (d: OutboxDeps) => handleOutbox(new Request('https://x.test/outbox', { method: 'POST', headers: { 'x-outbox-secret': 'o' }, body: '{}' }), d)

describe('outbox-send Zugang vor Konfiguration (u5-1)', () => {
  it('ohne Versand (send null, Brevo fehlt): ohne oder falsches Secret 401, nie 503; mit richtigem Secret 503 ohne claim', async () => {
    let claims = 0
    const d = deps(rows(1), { send: null, claim: async () => (claims++, rows(1)) })
    const call2 = (secret: string | null) => handleOutbox(new Request('https://x.test/outbox', { method: 'POST', headers: secret === null ? {} : { 'x-outbox-secret': secret }, body: '{}' }), d)
    for (const s of [null, 'falsch', '']) {
      const res = await call2(s)
      expect(res.status, `Secret ${s}`).toBe(401)
      expect(await res.json()).toEqual({ error: 'unauthorized' })
    }
    const res = await call2('o')
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'mail_not_configured' })
    expect(claims).toBe(0)
    expect(d.marks).toEqual([])
  })

  it('ohne APP_URL ebenso 503 nach der Prüfung; leeres Secret in der Umgebung: jeder Aufruf 401, auch mit leerem Header', async () => {
    const d = deps(rows(1), { appUrl: '' })
    expect((await call(d)).status).toBe(503)
    const none = deps(rows(1), { secret: '' })
    for (const s of ['', 'o']) {
      const res = await handleOutbox(new Request('https://x.test/outbox', { method: 'POST', headers: { 'x-outbox-secret': s }, body: '{}' }), none)
      expect(res.status, `Header '${s}'`).toBe(401)
    }
    expect(none.sent).toEqual([])
  })
})

describe('outbox-send Markieren (K3)', () => {
  it('Mail ging raus, mark(true) schlägt fehl: kein zweites mark(false), nicht als Versandfehler gezählt, Lauf geht weiter', async () => {
    const d = deps(rows(2), {
      mark: async (id, ok, error) => {
        d.marks.push([id, ok, error])
        if (id === 1) throw new Error('db down')
      },
    })
    const res = await call(d)
    expect(await res.json()).toEqual({ sent: 2, failed: 0, skipped: 0, expired: 0 })
    expect(d.sent).toEqual(['p1@example.com', 'p2@example.com'])
    expect(d.marks).toEqual([[1, true, null], [2, true, null]]) // keine Gegenbuchung (false) für die versendete Mail
    expect(d.logs.map((l) => l.event)).toContain('outbox_mark_failed')
    expect(JSON.stringify(d.logs)).not.toContain('example.com')
  })

  it('Versand scheitert und auch mark(false) scheitert: der Lauf zählt es als Fehler und verarbeitet die nächste Zeile', async () => {
    const d = deps(rows(2), {
      send: async (m) => {
        if (m.to === 'p1@example.com') throw new MailError(true)
        d.sent.push(m.to)
      },
      mark: async (id, ok, error) => {
        d.marks.push([id, ok, error])
        if (!ok) throw new Error('db down')
      },
    })
    const res = await call(d)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: 1, failed: 1, skipped: 0, expired: 0 })
    expect(d.sent).toEqual(['p2@example.com'])
    expect(d.marks).toEqual([[1, false, 'smtp_rejected'], [2, true, null]])
    expect(d.logs.map((l) => l.event)).toEqual(['outbox_failed', 'outbox_mark_failed'])
    expect(JSON.stringify(d.logs)).not.toContain('example.com')
  })
})

describe('outbox-send Fehlercodes des Anbieters (mail1)', () => {
  it('abgelehnt (4xx) → smtp_rejected, vorübergehend (5xx, 429, Netz) → smtp_temp, alles andere → smtp_error; nie ein Text des Anbieters', async () => {
    const d = deps([mk('listing_new', 'partner', { id: 1, partnerEmail: 'a@example.com' }), mk('listing_new', 'partner', { id: 2, partnerEmail: 'b@example.com' }), mk('listing_new', 'partner', { id: 3, partnerEmail: 'c@example.com' })], {
      send: async (m) => {
        if (m.to.startsWith('a')) throw new MailError(true)
        if (m.to.startsWith('b')) throw new MailError(false)
        throw new Error('Brevo: Adresse c@example.com ungültig')
      },
    })
    expect(await (await call(d)).json()).toEqual({ sent: 0, failed: 3, skipped: 0, expired: 0 })
    expect(d.marks).toEqual([[1, false, 'smtp_rejected'], [2, false, 'smtp_temp'], [3, false, 'smtp_error']])
    expect(JSON.stringify(d.logs)).not.toContain('example.com')
  })
})

describe('outbox-send Testadressen (mail1)', () => {
  it('Endungen .test, .invalid, .example, .localhost (auch groß, mit Subdomain) werden nicht gesendet, gelten als erledigt, ohne Adresse im Log', async () => {
    const mails = ['a@movenow.test', 'b@MoveNow.TEST', 'c@mail.movenow.test', 'd@x.invalid', 'e@x.example', 'f@host.localhost']
    const d = deps(mails.map((m, i) => mk('listing_new', 'partner', { id: i + 1, partnerEmail: m })))
    expect(await (await call(d)).json()).toEqual({ sent: 0, failed: 0, skipped: 6, expired: 0 })
    expect(d.sent).toEqual([])
    expect(d.marks.map(([id, ok, error]) => [id, ok, error])).toEqual(mails.map((_, i) => [i + 1, true, null]))
    expect(d.logs.map((l) => l.event)).toEqual(Array(6).fill('outbox_skipped'))
    expect(JSON.stringify(d.logs)).not.toMatch(/movenow|invalid|localhost|@/i)
  })

  it('nur die letzte Domain-Endung zählt: test.example.com und example.com werden gesendet; Kundenzeile mit .test wird übersprungen', async () => {
    const d = deps(
      [mk('listing_new', 'partner', { id: 1, partnerEmail: 'a@test.example.com' }), mk('listing_new', 'partner', { id: 2, partnerEmail: 'b@example.com' }), mk('request_accepted', 'customer', { id: 3 })],
      { customerEmail: async () => 'k@movenow.test' },
    )
    expect(await (await call(d)).json()).toEqual({ sent: 2, failed: 0, skipped: 1, expired: 0 })
    expect(d.sent).toEqual(['a@test.example.com', 'b@example.com'])
  })
})

describe('outbox-send ohne Dev-Schalter (Produktion, mail1)', () => {
  it('Adressen mit Testendung und Meldungen zu Testkonten werden normal versendet, der Kunde der Anfrage wird nicht einmal gefragt', async () => {
    const mails = ['a@movenow.test', 'd@x.invalid', 'f@host.localhost']
    const d = deps(
      [...mails.map((m, i) => mk('listing_new', 'partner', { id: i + 1, partnerEmail: m })), mk('report_new', 'operator', { id: 4, requestId: 'r1' })],
      { devGuard: false, requestCustomerEmail: async () => { throw new Error('darf ohne Schalter nicht gefragt werden') } },
    )
    expect(await (await call(d)).json()).toEqual({ sent: 4, failed: 0, skipped: 0, expired: 0 })
    expect(d.sent).toEqual([...mails, 'betreiber@example.com'])
    expect(d.logs).toEqual([])
  })
})

describe('outbox-send „Unterwegs“ verfällt (mail1)', () => {
  it('nach der Ankunftszeit nicht mehr senden: die Zeile wird endgültig als expired markiert, die übrigen laufen weiter; vorher wird gesendet', async () => {
    const asked: string[] = []
    const d = deps(
      [mk('en_route', 'customer', { id: 1, requestId: 'alt' }), mk('en_route', 'customer', { id: 2, requestId: 'neu' }), mk('request_accepted', 'customer', { id: 3, requestId: 'alt' })],
      { customerEmail: async () => 'kunde@example.com', enRouteExpired: async (r) => (asked.push(r), r === 'alt') },
    )
    expect(await (await call(d)).json()).toEqual({ sent: 2, failed: 0, skipped: 0, expired: 1 })
    expect(d.marks).toEqual([[1, false, 'expired'], [2, true, null], [3, true, null]])
    expect(asked).toEqual(['alt', 'neu']) // nur en_route fragt, andere Arten nie
    expect(d.sent).toEqual(['kunde@example.com', 'kunde@example.com'])
    expect(d.logs.map((l) => l.event)).toEqual(['outbox_expired'])
  })

  it('der Verfall gilt auch ohne Dev-Schalter; ein Lesefehler zählt als Versuch (smtp_error), nicht als Verfall', async () => {
    const d = deps([mk('en_route', 'customer', { id: 1, requestId: 'r' })], { devGuard: false, customerEmail: async () => 'k@example.com', enRouteExpired: async () => true })
    expect(await (await call(d)).json()).toEqual({ sent: 0, failed: 0, skipped: 0, expired: 1 })
    const err = deps([mk('en_route', 'customer', { id: 1, requestId: 'r' })], { customerEmail: async () => 'k@example.com', enRouteExpired: async () => { throw new Error('db down') } })
    expect(await (await call(err)).json()).toEqual({ sent: 0, failed: 1, skipped: 0, expired: 0 })
    expect(err.marks).toEqual([[1, false, 'smtp_error']])
  })
})

describe('outbox-send Betreiber (mail1, Nr. 175)', () => {
  const mails = async (claimed: OutboxRow[], over: Partial<OutboxDeps> = {}) => {
    const out: Mail[] = []
    const d = deps(claimed, { send: async (m) => void out.push(m), ...over })
    const res = await (await call(d)).json()
    return { out, res, d }
  }

  it('report_new geht an MAIL_BETREIBER, ohne Auftrag, Namen, Beträge oder Link', async () => {
    const { out, res } = await mails([mk('report_new', 'operator', { requestId: 'r1' })])
    expect(res).toEqual({ sent: 1, failed: 0, skipped: 0, expired: 0 })
    expect(out).toHaveLength(1)
    expect(out[0]?.to).toBe('betreiber@example.com')
    expect(body(out[0])).toContain('reported_jobs')
    expect(body(out[0])).not.toMatch(/https?:|r1|€|Gebühr|Provision/i)
  })

  it('Meldung zu einem Testkonto oder einem Konto ohne Adresse wird übersprungen, eine Zeile ohne Anfrage (Probe) gesendet', async () => {
    const test = await mails([mk('report_new', 'operator', { requestId: 'r1' })], { requestCustomerEmail: async () => 'k@movenow.test' })
    expect(test.res).toEqual({ sent: 0, failed: 0, skipped: 1, expired: 0 })
    expect(test.out).toEqual([])
    const none = await mails([mk('report_new', 'operator', { requestId: 'r1' })], { requestCustomerEmail: async () => null })
    expect(none.res).toEqual({ sent: 0, failed: 0, skipped: 1, expired: 0 })
    const probe = await mails([mk('report_new', 'operator', { requestId: null })], { requestCustomerEmail: async () => { throw new Error('darf nicht gefragt werden') } })
    expect(probe.res).toEqual({ sent: 1, failed: 0, skipped: 0, expired: 0 })
  })

  it('ohne MAIL_BETREIBER: no_recipient statt Versand an eine leere Adresse', async () => {
    const { res, d, out } = await mails([mk('report_new', 'operator')], { operatorEmail: '' })
    expect(res).toEqual({ sent: 0, failed: 1, skipped: 0, expired: 0 })
    expect(out).toEqual([])
    expect(d.marks).toEqual([[1, false, 'no_recipient']])
  })

  it('en_route geht an den Kunden, ohne Uhrzeit, Betrag, Kontakt oder Gebührenwort', async () => {
    const { out } = await mails([mk('en_route', 'customer')], { customerEmail: async () => 'kunde@example.com' })
    expect(out[0]?.to).toBe('kunde@example.com')
    expect(out[0]?.subject).toBe('Dein Partner ist unterwegs')
    expect(out[0]?.text).toContain('https://app.test')
    expect(body(out[0])).not.toMatch(/\d{1,2}[:.]\d{2}|€|Gebühr|Provision|Telefon|@/i)
  })
})

describe('outbox-send Abschluss (S9g)', () => {
  it('completion_ask und completion_auto gehen an den Kunden, ohne Gebühr oder Provision im Text', async () => {
    const mails: Mail[] = []
    const claimed: OutboxRow[] = ['completion_ask', 'completion_auto'].map((kind, i) => mk(kind, 'customer', { id: i + 1 }))
    const d = deps(claimed, { customerEmail: async () => 'kunde@example.com', send: async (m) => void mails.push(m) })
    expect(await (await call(d)).json()).toEqual({ sent: 2, failed: 0, skipped: 0, expired: 0 })
    expect(mails.map((m) => m.subject)).toEqual(['Hat dein Auftrag stattgefunden?', 'Dein Auftrag gilt als durchgeführt'])
    for (const m of mails) expect(m.subject + m.text).not.toMatch(/Gebühr|Provision|15 ?%/i)
  })

  it('S9g-N2: fehlt completion_days, steht im Log setting_missing statt smtp_error', async () => {
    const d = deps([mk('completion_ask', 'customer')], {
      customerEmail: async () => 'k@example.com',
      completionDays: async () => { throw Object.assign(new Error('setting_missing'), { code: 'setting_missing' }) },
    })
    await call(d)
    expect(d.marks).toEqual([[1, false, 'setting_missing']])
  })

  it('S9g-7: completion_ask nennt die Tageszahl aus completion_days, nicht eine feste 7; request_cancelled geht an die Firma ohne Gebühr', async () => {
    const mails: Mail[] = []
    const claimed: OutboxRow[] = [mk('completion_ask', 'customer', { id: 1 }), mk('request_cancelled', 'partner', { id: 2, recipientId: 'p', partnerEmail: 'p@example.com' })]
    const d = deps(claimed, { customerEmail: async () => 'kunde@example.com', completionDays: async () => 3, send: async (m) => void mails.push(m) })
    expect(await (await call(d)).json()).toEqual({ sent: 2, failed: 0, skipped: 0, expired: 0 })
    expect(mails[0]?.text).toContain('3 Tage nach dem Termin')
    expect(mails[0]?.text).not.toContain('7 Tage')
    expect(mails[1]?.to).toBe('p@example.com')
    for (const m of mails) expect(m.subject + m.text).not.toMatch(/Gebühr|Provision|15 ?%/i)
    const one = deps([mk('completion_ask', 'customer')], { customerEmail: async () => 'k@example.com', completionDays: async () => 1, send: async (m) => void mails.push(m) })
    await call(one)
    expect(mails[2]?.text).toContain('1 Tag nach dem Termin')
  })

  it('S9h-2: partner_cancelled und request_reissued gehen an den Kunden, ohne Beträge, Gebühr oder Provision', async () => {
    const mails: Mail[] = []
    const claimed: OutboxRow[] = ['partner_cancelled', 'request_reissued', 'partner_cancelled_fee'].map((kind, i) => mk(kind, 'customer', { id: i + 1 }))
    const d = deps(claimed, { customerEmail: async () => 'kunde@example.com', send: async (m) => void mails.push(m) })
    expect(await (await call(d)).json()).toEqual({ sent: 3, failed: 0, skipped: 0, expired: 0 })
    expect(mails.map((m) => m.to)).toEqual(Array(3).fill('kunde@example.com'))
    expect(mails[2]?.text).toContain('Anfahrtspauschale')
    expect(mails[1]?.text).toContain('kostenlos')
    for (const m of mails) expect(m.subject + m.text).not.toMatch(/Gebühr|Provision|15 ?%|€|\d{2,} Cent/i)
  })
})
