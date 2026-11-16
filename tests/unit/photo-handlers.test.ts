// Handler der Foto-Functions (S9d) mit Fakes: Zugang (Secret, JWT, aal), Eingabe, Fehlerabbildung, kein Pfad in Antworten und Logs.
import { describe, expect, it } from 'vitest'
import { AuthServiceError } from '../../supabase/functions/_shared/auth.ts'
import { DbError, handleOutbox } from '../../supabase/functions/_shared/jobs/handlers.ts'
import {
  handleAdminPhoto,
  handleJobPhoto,
  handlePublish,
  handleReceipt,
  type AdminPhotoDeps,
  type JobPhotoDeps,
  type PublishDeps,
  type ReceiptDeps,
} from '../../supabase/functions/_shared/photo/handlers.ts'
import { PhotoError } from '../../supabase/functions/_shared/photo/process.ts'

const J = '11111111-1111-4111-8111-111111111111'
const R = '22222222-2222-4222-8222-222222222222'
const SOURCE = 'cust-uid/client-ref/original.jpg'
const COPY = '33333333-3333-4333-8333-333333333333.jpg'
const OUT = { bytes: new Uint8Array([1, 2, 3]), sha256: 'a'.repeat(64), width: 10, height: 10 }
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])

const post = (url: string, body: BodyInit | null, headers: Record<string, string> = {}) => new Request(url, { method: 'POST', headers, body })
const json = (url: string, body: unknown, headers: Record<string, string> = { authorization: 'Bearer t' }) =>
  post(url, JSON.stringify(body), { 'content-type': 'application/json', ...headers })

// photo-publish -------------------------------------------------------------------------------------------------------------
function publishDeps(over: Partial<PublishDeps> = {}): PublishDeps & { marks: unknown[]; logs: unknown[]; calls: string[] } {
  const marks: unknown[] = []
  const logs: unknown[] = []
  const calls: string[] = []
  return {
    marks,
    logs,
    calls,
    secret: 's3cret',
    begin: async () => (calls.push('begin'), SOURCE),
    download: async () => (calls.push('download'), JPEG),
    process: async () => (calls.push('process'), OUT),
    upload: async () => (calls.push('upload'), COPY),
    mark: async (_id, _n, r) => void (calls.push('mark'), marks.push(r)),
    log: (e) => void logs.push(e),
    ...over,
  }
}
const pub = (body: unknown, secret = 's3cret') => json('https://x.test/photo-publish', body, { 'x-publish-secret': secret })

describe('photo-publish', () => {
  it('Erfolg: begin, Download, Verarbeitung, Upload, mark ready; Antwort und Log ohne Pfad', async () => {
    const d = publishDeps()
    const res = await handlePublish(pub({ job_photo_id: J, attempt: 1 }), d)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ready' })
    expect(d.calls).toEqual(['begin', 'download', 'process', 'upload', 'mark'])
    expect(d.marks).toEqual([{ ok: true, path: COPY, sha256: OUT.sha256 }])
    expect(JSON.stringify(d.logs)).not.toContain(SOURCE)
    expect(JSON.stringify(d.logs)).not.toContain(COPY)
  })

  it('Zugang: nur POST, ohne Secret in der Umgebung 401 (u5-1, fail closed, auch mit leerem Header), falsches oder fehlendes Secret 401, ohne dass etwas läuft', async () => {
    const d = publishDeps()
    expect((await handlePublish(new Request('https://x.test/', { method: 'GET' }), d)).status).toBe(405)
    const none = publishDeps({ secret: '' })
    for (const secret of ['s3cret', '']) {
      const res = await handlePublish(pub({ job_photo_id: J, attempt: 1 }, secret), none)
      expect(res.status, `Header '${secret}'`).toBe(401)
      expect(await res.json()).toEqual({ error: 'unauthorized' })
    }
    expect((await handlePublish(json('https://x.test/', { job_photo_id: J, attempt: 1 }, {}), none)).status).toBe(401)
    expect(none.calls).toEqual([])
    expect((await handlePublish(pub({ job_photo_id: J, attempt: 1 }, 'falsch'), d)).status).toBe(401)
    expect((await handlePublish(json('https://x.test/', { job_photo_id: J, attempt: 1 }, {}), d)).status).toBe(401)
    expect(d.calls).toEqual([])
  })

  it('Eingabe: nur UUID und Versuch 1 bis 3', async () => {
    for (const bad of [{}, { job_photo_id: 'x', attempt: 1 }, { job_photo_id: J, attempt: 0 }, { job_photo_id: J, attempt: 4 }, { job_photo_id: J, attempt: 1.5 }, { job_photo_id: J }]) {
      expect((await handlePublish(pub(bad), publishDeps())).status).toBe(400)
    }
  })

  it('dauerhafte Fehler markieren failed mit festem Code: Datei fehlt, kein gültiges JPEG', async () => {
    const missing = publishDeps({ download: async () => null })
    expect(await (await handlePublish(pub({ job_photo_id: J, attempt: 2 }), missing)).json()).toEqual({ status: 'failed' })
    expect(missing.marks).toEqual([{ ok: false, error: 'source_missing' }])
    expect(missing.calls).not.toContain('upload')

    const bad = publishDeps({ process: async () => Promise.reject(new PhotoError('not_jpeg')) })
    expect((await handlePublish(pub({ job_photo_id: J, attempt: 1 }), bad)).status).toBe(200)
    expect(bad.marks).toEqual([{ ok: false, error: 'not_jpeg' }])
  })

  it('vorübergehende Fehler markieren nichts (die Lease läuft ab), Antwort 500 ohne Meldung', async () => {
    for (const over of [{ download: async () => Promise.reject(new Error('Geheim SQL pfad/xyz')) }, { upload: async () => Promise.reject(new Error('upload_failed')) }, { process: async () => Promise.reject(new Error('Speicher')) }]) {
      const d = publishDeps(over)
      const res = await handlePublish(pub({ job_photo_id: J, attempt: 1 }), d)
      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: 'internal' })
      expect(d.marks).toEqual([])
      // Abnahme N6: ins Log gehören nur feste Codes, nie der Text des Fehlers (Pfade, Adressen)
      expect(JSON.stringify(d.logs)).not.toMatch(/Geheim|pfad|xyz|Speicher/)
    }
  })

  it('überholter Claim: 409 stale_claim, nichts wird heruntergeladen oder hochgeladen', async () => {
    const d = publishDeps({ begin: async () => Promise.reject(new DbError('stale_claim')) })
    const res = await handlePublish(pub({ job_photo_id: J, attempt: 1 }), d)
    expect(res.status).toBe(409)
    expect(d.calls).toEqual([])
  })
})

// photo-receipt -------------------------------------------------------------------------------------------------------------
function receiptDeps(over: Partial<ReceiptDeps> = {}): ReceiptDeps & { calls: string[]; seen: unknown[] } {
  const calls: string[] = []
  const seen: unknown[] = []
  return {
    calls,
    seen,
    allowedOrigins: [],
    getUser: async () => ({ id: 'u1', aal: 'aal2' }),
    check: async (...a) => void (calls.push('check'), seen.push(a)),
    process: async () => (calls.push('process'), OUT),
    upload: async () => (calls.push('upload'), COPY),
    add: async (...a) => (calls.push('add'), seen.push(a), 'photo-1'),
    log: () => {},
    ...over,
  }
}
const rec = (query = `?request=${R}`, body: BodyInit | null = JPEG, headers: Record<string, string> = { authorization: 'Bearer t' }) =>
  post(`https://x.test/photo-receipt${query}`, body, headers)

describe('photo-receipt', () => {
  it('Erfolg: Torprüfung vor dem Lesen, Akteur und aal aus dem geprüften Token, Antwort nur mit der Foto-ID', async () => {
    const d = receiptDeps()
    const res = await handleReceipt(rec(), d)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'photo-1' })
    expect(d.calls).toEqual(['check', 'process', 'upload', 'add'])
    expect(d.seen[0]).toEqual(['u1', 'aal2', R])
    expect(d.seen[1]).toEqual(['u1', 'aal2', R, COPY, OUT.sha256])
  })

  it('ohne JWT 401, ungültiges JWT 401, aal1 403 mfa_required; nichts läuft', async () => {
    const d = receiptDeps()
    expect((await handleReceipt(rec(`?request=${R}`, JPEG, {}), d)).status).toBe(401)
    expect((await handleReceipt(rec(), receiptDeps({ getUser: async () => null }))).status).toBe(401)
    const res = await handleReceipt(rec(), receiptDeps({ getUser: async () => ({ id: 'u1', aal: 'aal1' }) }))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'mfa_required' })
    expect(d.calls).toEqual([])
  })

  it('Eingabe: Anfrage-ID Pflicht und UUID', async () => {
    for (const q of ['', '?request=x', '?req=' + R]) expect((await handleReceipt(rec(q), receiptDeps())).status).toBe(400)
  })

  it('Tor verweigert (fremde Anfrage, Limit, geschlossen): Fehlercode, der Body wird nicht verarbeitet', async () => {
    for (const [code, status] of [['not_found', 404], ['receipt_limit', 409], ['request_closed', 409], ['partner_not_active', 403]] as const) {
      const d = receiptDeps({ check: async () => Promise.reject(new DbError(code)) })
      const res = await handleReceipt(rec(), d)
      expect(res.status, code).toBe(status)
      expect(d.calls).toEqual([])
    }
  })

  it('kein gültiges Foto: 422 mit festem Code, kein Upload; zu großer Body: 413', async () => {
    const d = receiptDeps({ process: async () => Promise.reject(new PhotoError('dimensions')) })
    const res = await handleReceipt(rec(), d)
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'dimensions' })
    expect(d.calls).not.toContain('upload')
    const big = await handleReceipt(rec(`?request=${R}`, JPEG, { authorization: 'Bearer t', 'content-length': String(11 * 1024 * 1024) }), receiptDeps())
    expect(big.status).toBe(413)
  })
})

// job-photo -----------------------------------------------------------------------------------------------------------------
function jobDeps(over: Partial<JobPhotoDeps> = {}): JobPhotoDeps & { seen: unknown[] } {
  const seen: unknown[] = []
  return {
    seen,
    allowedOrigins: [],
    getUser: async () => ({ id: 'u1', aal: 'aal2' }),
    photos: async (...a) => (seen.push(a), [{ id: 'p1', kind: 'request', url: 'https://signed.test/a?token=1' }]),
    log: () => {},
    ...over,
  }
}
const jp = (body: unknown, headers?: Record<string, string>) => json('https://x.test/job-photo', body, headers)

describe('job-photo', () => {
  it('Partner (Listing) und Kunde (Anfrage): genau eines von beiden, Antwort ist die Liste ohne Pfad', async () => {
    const d = jobDeps()
    const a = await handleJobPhoto(jp({ listingId: J }), d)
    expect(await a.json()).toEqual([{ id: 'p1', kind: 'request', url: 'https://signed.test/a?token=1' }])
    await handleJobPhoto(jp({ requestId: R }), d)
    expect(d.seen).toEqual([['u1', 'aal2', { listingId: J }], ['u1', 'aal2', { requestId: R }]])
  })

  it('Eingabe: beide, keines, keine UUID oder ein Fremdfeld allein sind 400', async () => {
    for (const bad of [{}, { listingId: J, requestId: R }, { listingId: 'x' }, { requestId: 5 }, { partnerId: J }]) {
      expect((await handleJobPhoto(jp(bad), jobDeps())).status, JSON.stringify(bad)).toBe(400)
    }
  })

  it('ohne JWT 401; der aal-Wert des Tokens geht unverändert an die Datenbank, aal1 für Partner dort 403', async () => {
    expect((await handleJobPhoto(jp({ listingId: J }, {}), jobDeps())).status).toBe(401)
    const d = jobDeps({ getUser: async () => ({ id: 'u1', aal: 'aal1' }), photos: async () => Promise.reject(new DbError('mfa_required')) })
    const res = await handleJobPhoto(jp({ listingId: J }), d)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'mfa_required' })
  })

  it('fremdes Listing: 404 not_found ohne Hinweis, ob es existiert', async () => {
    const res = await handleJobPhoto(jp({ listingId: J }), jobDeps({ photos: async () => Promise.reject(new DbError('not_found')) }))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })
})

// admin-photo ---------------------------------------------------------------------------------------------------------------
describe('admin-photo', () => {
  const deps = (over: Partial<AdminPhotoDeps> = {}): AdminPhotoDeps => ({
    allowedOrigins: [],
    getUser: async () => ({ id: 'adm', aal: 'aal2' }),
    photos: async () => [{ bucket: 'job-photos', url: 'https://signed.test/b' }],
    log: () => {},
    ...over,
  })
  const ap = (body: unknown, headers?: Record<string, string>) => json('https://x.test/admin-photo', body, headers)

  it('Erfolg nur mit aal2; aal1 403, ohne JWT 401, Eingabe 400', async () => {
    expect(await (await handleAdminPhoto(ap({ requestId: R, reason: 'Support-Fall 4711' }), deps())).json()).toEqual([{ bucket: 'job-photos', url: 'https://signed.test/b' }])
    expect((await handleAdminPhoto(ap({ requestId: R, reason: 'x' }), deps({ getUser: async () => ({ id: 'adm', aal: 'aal1' }) }))).status).toBe(403)
    expect((await handleAdminPhoto(ap({ requestId: R, reason: 'x' }, {}), deps())).status).toBe(401)
    expect((await handleAdminPhoto(ap({ requestId: 'x', reason: 'x' }), deps())).status).toBe(400)
    expect((await handleAdminPhoto(ap({ requestId: R }), deps())).status).toBe(400)
  })

  it('kein admin: 403, zu kurze Begründung: 422', async () => {
    expect((await handleAdminPhoto(ap({ requestId: R, reason: 'Support-Fall 4711' }), deps({ photos: async () => Promise.reject(new DbError('not_admin')) }))).status).toBe(403)
    expect((await handleAdminPhoto(ap({ requestId: R, reason: 'kurz' }), deps({ photos: async () => Promise.reject(new DbError('reason_required')) }))).status).toBe(422)
  })
})

// n12b-1: Störung des Auth-Dienstes ----------------------------------------------------------------------------------------------
describe('Foto-Functions: Störung des Auth-Dienstes (n12b-1)', () => {
  const TOKEN = 'abc.def.ghi'
  const auth = (token = TOKEN) => ({ authorization: `Bearer ${token}` })
  const fault = async () => {
    throw new AuthServiceError(500, 'unexpected_failure')
  }
  const EXPECT = { event: 'X', code: 'auth_service_error status=500 code=unexpected_failure' }
  const check = async (event: string, run: (log: (e: Record<string, unknown>) => void) => Promise<Response>) => {
    const logs: Record<string, unknown>[] = []
    const res = await run((e) => void logs.push(e))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'internal' })
    expect(logs).toEqual([{ ...EXPECT, event }])
    expect(JSON.stringify(logs)).not.toContain(TOKEN)
  }

  it('photo-receipt, job-photo und admin-photo loggen den festen Text mit Status und Code, nie das Token; Antwort 500', async () => {
    await check('photo_receipt_failed', (log) => handleReceipt(rec(`?request=${R}`, JPEG, auth()), receiptDeps({ getUser: fault, log })))
    await check('job_photo_failed', (log) => handleJobPhoto(jp({ listingId: J }, auth()), jobDeps({ getUser: fault, log })))
    await check('admin_photo_failed', (log) =>
      handleAdminPhoto(json('https://x.test/admin-photo', { requestId: R, reason: 'Support-Fall 4711' }, auth()), {
        allowedOrigins: [],
        getUser: fault,
        photos: async () => [],
        log,
      }),
    )
  })
})

// outbox-send: neuer Text -----------------------------------------------------------------------------------------------------
describe('outbox-send photo_failed', () => {
  it('versendet den Hinweis an den Kunden, ohne Gebühr, Pfade oder Namen', async () => {
    const sent: { to: string; subject: string; text: string }[] = []
    const res = await handleOutbox(post('https://x.test/outbox', '{}', { 'x-outbox-secret': 'o' }), {
      secret: 'o',
      claim: async () => [{ id: 1, kind: 'photo_failed', recipientKind: 'customer', recipientId: 'u', partnerEmail: null }],
      mark: async () => {},
      customerEmail: async () => 'kunde@example.test',
      completionDays: async () => 7,
      send: async (m) => void sent.push(m),
      appUrl: 'https://app.test',
      log: () => {},
    })
    expect(await res.json()).toEqual({ sent: 1, failed: 0 })
    expect(sent[0]?.to).toBe('kunde@example.test')
    expect(sent[0]?.text).toContain('https://app.test')
    expect(`${sent[0]?.subject} ${sent[0]?.text}`).not.toMatch(/15|Gebühr|Provision/)
  })
})
