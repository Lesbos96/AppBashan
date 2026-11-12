import { beforeEach, describe, expect, it, vi } from 'vitest'
import { finishJob, loadContact, loadJobs, mailHref, startJob, telHref } from '../../src/lib/partnerJobs'

// s9i-6b: Aufträge der Firma (`my_jobs()`), Kontakt (`job_contact`), Start und Abschluss. Der Server entscheidet; hier: strenge Zeilenprüfung, Fehlerzuordnung.
const rpc = vi.fn()
vi.mock('../../src/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }))

const A = '0b8f1c3e-5d2a-4e7b-9a61-3c4d5e6f7a8b'
const R = '2d1a3b4c-7e8f-4a9b-8c7d-6e5f4a3b2c1d'
const row = (over: Record<string, unknown> = {}) => ({
  assignment_id: A,
  request_id: R,
  listing_id: null,
  status: 'accepted',
  termin_at: '2026-12-02T07:00:00+00:00',
  accepted_at: '2026-11-20T10:00:00+00:00',
  ended_at: null,
  ended_reason: null,
  district: 3,
  to_district: 10,
  service: 'move',
  preferred_date: '2026-12-02',
  time_window: 'morning',
  total_cents: 68961,
  payout_cents: 58617,
  can_start: false,
  ...over,
})

beforeEach(() => {
  rpc.mockReset() // in Klammern: der Rückgabewert (der Mock) liefe sonst als Aufräumfunktion und würde nach dem Test aufgerufen
})

describe('loadJobs', () => {
  it('ruft my_jobs ohne Argumente auf und bildet die Zeile ab', async () => {
    rpc.mockResolvedValue({ data: [row()], error: null })
    const [j] = await loadJobs()
    expect(rpc).toHaveBeenCalledWith('my_jobs')
    expect(j).toMatchObject({ id: A, requestId: R, status: 'accepted', ended: false, district: 3, toDistrict: 10, service: 'move', preferredDate: '2026-12-02', timeWindow: 'morning', totalCents: 68961, payoutCents: 58617, canStart: false })
    expect(j!.terminAt.toISOString()).toBe('2026-12-02T07:00:00.000Z')
  })

  it('beendete Zuordnung: ended ist wahr', async () => {
    rpc.mockResolvedValue({ data: [row({ status: 'completed', ended_at: '2026-12-02T12:00:00+00:00', ended_reason: 'completed' })], error: null })
    expect((await loadJobs())[0]).toMatchObject({ status: 'completed', ended: true })
  })

  it.each([
    ['ungültige Zuordnungs-ID', { assignment_id: 'x' }],
    ['ungültige Auftrags-ID', { request_id: 'x' }],
    ['unbekannter Status', { status: 'offered' }],
    ['unbekannte Leistung', { service: 'rental' }],
    ['kein Termin', { termin_at: null }],
    ['Termin kein Datum', { termin_at: 'morgen' }],
    ['can_start kein boolean', { can_start: 'true' }],
    ['Ende kein Datum', { ended_at: 'gestern' }],
  ])('%s: Zeile entfällt', async (_n, over) => {
    rpc.mockResolvedValue({ data: [row(over), row()], error: null })
    expect(await loadJobs()).toHaveLength(1)
  })

  it.each([
    ['null', null],
    ['negativ', -5],
    ['Kommazahl', 100.5],
    ['Text', '68961'],
  ])('Betrag %s: Zeile bleibt, aber ohne Betrag (nie 0 anzeigen)', async (_n, v) => {
    rpc.mockResolvedValue({ data: [row({ total_cents: v, payout_cents: v })], error: null })
    expect((await loadJobs())[0]).toMatchObject({ totalCents: null, payoutCents: null })
  })

  it('0 Cent (nach kostenlosem Storno) ist ein gültiger Betrag', async () => {
    rpc.mockResolvedValue({ data: [row({ status: 'cancelled_by_customer', ended_at: '2026-12-01T10:00:00+00:00', total_cents: 0, payout_cents: 0 })], error: null })
    expect((await loadJobs())[0]).toMatchObject({ totalCents: 0, payoutCents: 0 })
  })

  it('fehlende Bezirke und Zeitangaben sind erlaubt', async () => {
    rpc.mockResolvedValue({ data: [row({ district: null, to_district: 99, preferred_date: null, time_window: null })], error: null })
    expect((await loadJobs())[0]).toMatchObject({ district: null, toDistrict: null, preferredDate: null, timeWindow: null })
  })

  it('Fehler wird weitergereicht, keine Liste statt Daten ist leer', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'mfa_required' } })
    await expect(loadJobs()).rejects.toBeDefined()
    rpc.mockResolvedValue({ data: 'x', error: null })
    expect(await loadJobs()).toEqual([])
  })

  it('Personendaten, die ein Server versehentlich mitschickt, erreichen die Anzeige nicht', async () => {
    rpc.mockResolvedValue({ data: [row({ name: 'Karl Sentinel', phone: '+43 660 1', from_address: 'Sentinelgasse 1' })], error: null })
    expect(JSON.stringify(await loadJobs())).not.toMatch(/Sentinel|\+43/)
  })
})

describe('startJob und finishJob', () => {
  it('senden nur die Auftrags-ID', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await startJob(R)
    await finishJob(R)
    expect(rpc).toHaveBeenNthCalledWith(1, 'start_job', { p_request: R })
    expect(rpc).toHaveBeenNthCalledWith(2, 'complete_job', { p_request: R })
  })

  it.each([
    ['too_early', 'too_early'],
    ['invalid_transition', 'closed'],
    ['not_found', 'closed'],
    ['not_assigned', 'gone'],
    ['partner_not_active', 'gone'],
    ['mfa_required', 'unauthorized'],
    ['irgendwas', 'unavailable'],
    ['constructor', 'unavailable'],
    ['toString', 'unavailable'],
  ])('%s wird %s', async (message, kind) => {
    rpc.mockResolvedValue({ data: null, error: { message } })
    await expect(startJob(R)).rejects.toMatchObject({ kind })
    await expect(finishJob(R)).rejects.toMatchObject({ kind })
  })

  it('ein Netzfehler (rpc wirft) ist offline', async () => {
    rpc.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(startJob(R)).rejects.toMatchObject({ kind: 'offline' })
    await expect(finishJob(R)).rejects.toMatchObject({ kind: 'offline' })
    await expect(loadContact(R)).rejects.toMatchObject({ kind: 'offline' })
  })
})

describe('loadContact', () => {
  const c = (over: Record<string, unknown> = {}) => ({ name: 'Karl Kunde', phone: '+43 660 1234567', email: 'karl@movenow.test', stairs_door: '3. Stock, Tür 4', from_address: 'Teststraße 1, 1070 Wien', to_address: null, preferred_date: '2026-12-02', time_window: 'morning', ...over })

  it('ruft job_contact mit der Auftrags-ID auf und bildet die Zeile ab', async () => {
    rpc.mockResolvedValue({ data: [c()], error: null })
    expect(await loadContact(R)).toEqual({ name: 'Karl Kunde', phone: '+43 660 1234567', email: 'karl@movenow.test', stairsDoor: '3. Stock, Tür 4', fromAddress: 'Teststraße 1, 1070 Wien', toAddress: null })
    expect(rpc).toHaveBeenCalledWith('job_contact', { p_request: R })
  })

  it.each([
    ['keine Zeile', []],
    ['zwei Zeilen', [c(), c()]],
    ['Name fehlt', [c({ name: null })]],
    ['Telefon leer', [c({ phone: '' })]],
    ['keine Liste', 'x'],
  ])('%s: Fehler, kein halber Kontakt', async (_n, data) => {
    rpc.mockResolvedValue({ data, error: null })
    await expect(loadContact(R)).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('Zugriffsfenster abgelaufen (not_assigned) ist „nicht mehr verfügbar“', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'not_assigned' } })
    await expect(loadContact(R)).rejects.toMatchObject({ kind: 'gone' })
  })
})

describe('Links', () => {
  it.each([
    ['+43 660 1234567', 'tel:+436601234567'],
    ['0660 123 45 67', 'tel:06601234567'],
    ['(01) 234-567', 'tel:01234567'],
  ])('telHref %s', (p, href) => expect(telHref(p)).toBe(href))
  it.each(['abc', '+', 'javascript:alert(1)', '12', '+43 660 123456789012345678'])('telHref %j ist kein Link', (p) => expect(telHref(p)).toBeNull())
  it('mailHref nur bei einfacher Adresse', () => {
    expect(mailHref('karl@movenow.test')).toBe('mailto:karl@movenow.test')
    for (const e of ['a b@x.at', 'a@b', 'x@y@z.at', '<a@b.at>', 'javascript:alert(1)']) expect(mailHref(e), e).toBeNull()
  })
  it('mailHref: kein Link bei Zeichen, die im Mailprogramm Betreff, Text oder Empfänger setzen (Abnahme M1)', () => {
    for (const e of ['a@b.at?subject=x', 'a@b.at?bcc=c%40d.at', 'a@b.at&body=x', 'a%40b@c.at', 'a@b.at#x', 'a,b@c.at', 'a@b.at;c@d.at']) expect(mailHref(e), e).toBeNull()
  })
  it('telHref: „(0)“ nach der Ländervorwahl entfällt', () => {
    expect(telHref('+43 (0) 660 1234567')).toBe('tel:+436601234567')
    expect(telHref('+43 (660) 1234567')).toBe('tel:+436601234567')
  })
})
