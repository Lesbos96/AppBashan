import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()
vi.mock('../../src/lib/supabase', () => ({ supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } } }))

const { attemptKey, draftKeys, purgeHandover, readSent, readShownFull, rememberShown, restoreDraft, stashDraft, finishDraft, viennaToday } = await import('../../src/lib/draft')
const { QuoteError, buildBody, parseSnapshot, priceLabel, refBody, refFor, sendQuote, shownLabel, termsText } = await import('../../src/lib/quote')

const store = () => {
  const map = new Map<string, string>()
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k), map }
}
let session: ReturnType<typeof store>
let local: ReturnType<typeof store>

beforeEach(() => {
  session = store()
  local = store()
  vi.stubGlobal('sessionStorage', session)
  vi.stubGlobal('localStorage', local)
  vi.useRealTimers()
  invoke.mockReset()
})

const montageDraft = () => {
  session.setItem('movenow.flow.montage', JSON.stringify({ draft: { kind: 'standard', lm: 2, upper: 0, tall: 0 } }))
  session.setItem('movenow.termin.montage', JSON.stringify({ date: '2026-11-15', window: 'morning', place: 'Neubaugasse 12, 1070 Wien', point: { lat: 48.2, lon: 16.35 }, consent: true }))
}

describe('Übergabe über die Anmeldung', () => {
  it('sichert nur den Entwurf des Service und schreibt ihn in einem neuen Tab einmalig zurück', () => {
    montageDraft()
    session.setItem('movenow.flow.clearance', '{"x":1}')
    stashDraft('montage')
    const saved = JSON.parse(local.getItem('movenow.handover')!)
    expect(Object.keys(saved.items).sort()).toEqual(['movenow.flow.montage', 'movenow.termin.montage'])

    const tab = store()
    vi.stubGlobal('sessionStorage', tab)
    restoreDraft()
    expect(tab.map.get('movenow.termin.montage')).toBe(session.map.get('movenow.termin.montage'))
    expect(local.getItem('movenow.handover')).toBeNull()
    tab.map.clear()
    restoreDraft()
    expect(tab.map.size).toBe(0)
  })

  it('überschreibt nie einen neueren Stand des Tabs', () => {
    montageDraft()
    stashDraft('montage')
    session.setItem('movenow.termin.montage', 'NEUER STAND')
    restoreDraft()
    expect(session.getItem('movenow.termin.montage')).toBe('NEUER STAND')
    expect(local.getItem('movenow.handover')).toBeNull()
  })

  it('verwirft abgelaufene Übergaben beim Lesen und beim App-Start', () => {
    vi.useFakeTimers()
    montageDraft()
    stashDraft('montage')
    vi.advanceTimersByTime(15 * 60 * 1000 + 1)
    purgeHandover()
    expect(local.getItem('movenow.handover')).toBeNull()

    vi.setSystemTime(0)
    stashDraft('montage')
    vi.advanceTimersByTime(15 * 60 * 1000 + 1)
    const tab = store()
    vi.stubGlobal('sessionStorage', tab)
    restoreDraft()
    expect(tab.map.size).toBe(0)
  })

  it('übernimmt nur bekannte Schlüssel, nie fremde', () => {
    local.setItem('movenow.handover', JSON.stringify({ until: Date.now() + 60_000, items: { 'movenow.flow.montage': '{}', 'evil.key': 'x' } }))
    restoreDraft()
    expect([...session.map.keys()]).toEqual(['movenow.flow.montage'])
  })

  it('kaputter Eintrag stört nicht', () => {
    local.setItem('movenow.handover', '{kaputt')
    expect(() => restoreDraft()).not.toThrow()
    local.setItem('movenow.handover', '{kaputt')
    expect(() => purgeHandover()).not.toThrow()
    expect(local.getItem('movenow.handover')).toBeNull()
  })

  it('Nach dem Senden verschwindet der Entwurf, die Bestätigung bleibt', () => {
    montageDraft()
    const shown = { kind: 'price' as const, totalCents: 77040, lowCents: 77040, highCents: 77040 }
    finishDraft('montage', { path: 'montage', id: 'x', status: 'requested', needsQuote: false, snapshot: null, shown, date: '2026-11-15', route: 'Neubaugasse 12' })
    for (const key of draftKeys('montage')) expect(session.getItem(key)).toBeNull()
    expect(readSent()?.id).toBe('x')
    expect(readSent()?.shown).toEqual(shown)
  })

  it('Die zuletzt angezeigte Vorschau wird vollständig gemerkt (auch Spanne und Angebot), Ungültiges ist null', () => {
    rememberShown('montage', { kind: 'price', totalCents: 77040, lowCents: 77040, highCents: 77040 })
    expect(readShownFull('montage')).toEqual({ kind: 'price', totalCents: 77040, lowCents: 77040, highCents: 77040 })
    rememberShown('entruempelung', { kind: 'price', totalCents: null, lowCents: 95000, highCents: 155000 })
    expect(readShownFull('entruempelung')).toEqual({ kind: 'price', totalCents: null, lowCents: 95000, highCents: 155000 })
    rememberShown('montage', { kind: 'offer', reasons: ['special_case'] })
    expect(readShownFull('montage')).toEqual({ kind: 'offer', reasons: ['special_case'] })
    session.setItem('movenow.shownfull.montage', 'abc')
    expect(readShownFull('montage')).toBeNull()
    session.setItem('movenow.shownfull.montage', JSON.stringify({ kind: 'price', totalCents: -5, lowCents: 0, highCents: 0 }))
    expect(readShownFull('montage')).toBeNull()
  })
})

describe('clientRef', () => {
  it('bleibt bei gleichem Inhalt, ändert sich bei anderem Inhalt', () => {
    const a = refFor('montage', { service: 'assembly', preferredDate: '2026-11-15' })
    expect(refFor('montage', { service: 'assembly', preferredDate: '2026-11-15' })).toBe(a)
    const b = refFor('montage', { service: 'assembly', preferredDate: '2026-11-16' })
    expect(b).not.toBe(a)
    expect(refFor('montage', { service: 'assembly', preferredDate: '2026-11-16' })).toBe(b)
  })

  it('hängt am Fotosatz: gleiche IDs in anderer Reihenfolge = gleiche Ref, ein Foto weniger = neue Ref, Bestätigtes zählt nicht', () => {
    const P1 = 'a0b1c2d3-0000-4000-8000-000000000001'
    const P2 = 'a0b1c2d3-0000-4000-8000-000000000002'
    const body = { service: 'clearance', preferredDate: '2026-11-15' }
    const a = refFor('entruempelung', refBody(body, [P1, P2]))
    expect(refFor('entruempelung', refBody(body, [P2, P1]))).toBe(a)
    expect(refFor('entruempelung', refBody({ ...body, priceVersion: 7, termsHash: 'x', shown: { kind: 'offer' } }, [P1, P2]))).toBe(a)
    expect(refFor('entruempelung', refBody(body, [P2]))).not.toBe(a)
  })

  it('ersetzt eine gespeicherte Ref, die keine UUID ist', () => {
    const body = { a: 1 }
    sessionStorage.setItem(attemptKey('montage'), JSON.stringify({ ref: 'kaputt', body: JSON.stringify(body) }))
    expect(refFor('montage', body)).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('ist je Service getrennt', () => {
    expect(refFor('montage', { a: 1 })).not.toBe(refFor('umzug', { a: 1 }))
  })
})

describe('buildBody', () => {
  const tariffs = { 'min_hours.transport': 2, 'min_hours.move': 3 }
  const confirmed = { priceVersion: 1, termsHash: 'a'.repeat(64), shown: { kind: 'price' as const, totalCents: 1, lowCents: 1, highCents: 1 }, contact: { name: 'Anna', phone: '+43 660 1234567', email: 'a@b.at', stairsDoor: '' } }

  it('Montage: nur Kundenwahl, kein Preis, kein Status, keine Strecke', () => {
    montageDraft()
    const body = buildBody('montage', tariffs, confirmed)!
    expect(Object.keys(body).sort()).toEqual(['contact', 'from', 'inputs', 'preferredDate', 'priceVersion', 'service', 'shown', 'termsHash', 'timeWindow'])
    expect(body).toMatchObject({ service: 'assembly', inputs: { kind: 'standard', lm: 2 }, from: { label: 'Neubaugasse 12, 1070 Wien', point: { lat: 48.2, lon: 16.35 } }, priceVersion: 1, shown: confirmed.shown, contact: { name: 'Anna' }, timeWindow: 'morning' })
  })

  it('ohne Termin oder Ort kein Aufruf', () => {
    expect(buildBody('montage', tariffs, confirmed)).toBeNull()
    montageDraft()
    session.setItem('movenow.termin.montage', JSON.stringify({ date: null, window: 'morning', place: 'x y z', point: null, consent: false }))
    expect(buildBody('montage', tariffs, confirmed)).toBeNull()
  })

  it('ohne gemerkten Preis kein Aufruf: shown wird nie beim Senden neu gerechnet', () => {
    montageDraft()
    expect(buildBody('montage', tariffs, { ...confirmed, shown: undefined })).toBeNull()
  })

  it('ohne bestätigten Preis geht der gemerkte Preis als shown mit', () => {
    montageDraft()
    const stored = { kind: 'price' as const, totalCents: 77040, lowCents: 77040, highCents: 77040 }
    rememberShown('montage', stored)
    expect(buildBody('montage', tariffs, { ...confirmed, shown: undefined })).toMatchObject({ shown: stored })
  })

  it('Anzeige: Festpreis mit Cent, Spanne in ganzen Euro, Angebot als „Preis nach Prüfung“', () => {
    expect(shownLabel({ kind: 'price', totalCents: 68961, lowCents: 68961, highCents: 68961 })).toBe('689,61 €')
    expect(shownLabel({ kind: 'price', totalCents: null, lowCents: 95000, highCents: 155000 })).toBe('950 € bis 1.550 €')
    expect(shownLabel({ kind: 'offer', reasons: ['special_case'] })).toBe('Preis nach Prüfung')
  })

  it('Bedingungen in Worten aus den Werten des Hashes', () => {
    const terms = { cancel_free_hours: 48, cancel_late_percent: 50, cancel_full_percent: 100, cancel_full_days_before: 0, call_out_fee_cents: 2500, termsHash: 'a'.repeat(64) }
    expect(termsText(terms)).toEqual({
      storno: ['Kostenlos stornieren kannst du bis 48 Stunden vor dem Termin.', 'Danach werden 50 % des Preises berechnet, ab dem Tag des Termins 100 %.'],
      callOutCents: 2500,
    })
    expect(termsText({ ...terms, cancel_full_days_before: 2, call_out_fee_cents: 0 })).toMatchObject({ storno: [expect.any(String), 'Danach werden 50 % des Preises berechnet, ab 2 Tagen vor dem Termin 100 %.'], callOutCents: 0 })
  })

  it('Umzug: Koordinaten nur wenn bestätigt, die gespeicherte Route geht nie mit', () => {
    session.setItem(
      'movenow.flow.move',
      JSON.stringify({
        goods: 'normal', description: '  ', volume: 12, crew: 2, vehicles: 1, vehicleType: 'van', fromFloor: 0, toFloor: 1, fromLift: false, toLift: true,
        from: { label: 'A 1, 1010 Wien', point: { lat: 48.2, lon: 16.37 } }, to: { label: 'B 2, 1020 Wien', point: null }, routeConsent: true, returnTrip: true,
        route: null, hours: null, assembly: false, assemblyLm: 2, boxes: 0, parking: 0, packing: false,
      }),
    )
    session.setItem('movenow.termin.umzug', JSON.stringify({ date: '2026-11-15', window: 'flexible', place: '', point: null, consent: false }))
    const body = buildBody('umzug', tariffs, confirmed)!
    expect(body).toMatchObject({ service: 'move', from: { label: 'A 1, 1010 Wien', point: { lat: 48.2, lon: 16.37 } }, to: { label: 'B 2, 1020 Wien' }, returnTrip: true, volume: 12 })
    expect((body['to'] as object) && 'point' in (body['to'] as object)).toBe(false)
    expect(body['description']).toBeUndefined()
    expect(body['timeWindow']).toBeUndefined()
    expect(body['inputs']).toMatchObject({ hours: 3 })
    expect(JSON.stringify(body)).not.toMatch(/driveHours|outsideKm|region|cents/)
  })
})

describe('Antwort von quote', () => {
  const ok = { kind: 'price' as const, totalCents: 1000, lowCents: 1000, highCents: 1000, lines: [{ key: 'a', cents: 1000 }] }
  it('akzeptiert einen stimmigen Preis', () => expect(parseSnapshot(ok)).toEqual(ok))
  it.each([
    ['Summe falsch', { ...ok, lines: [{ key: 'a', cents: 999 }] }],
    ['low > total', { ...ok, lowCents: 1001 }],
    ['total > high', { ...ok, highCents: 999 }],
    ['Bruchteil', { ...ok, totalCents: 10.5 }],
    ['negativ', { ...ok, totalCents: -1, lowCents: -1, highCents: -1, lines: [{ key: 'a', cents: -1 }] }],
    ['Zeile ohne key', { ...ok, lines: [{ cents: 1000 }] }],
    ['Angebot ohne Grund', { kind: 'offer', reasons: [] }],
    ['unbekannter Grund', { kind: 'offer', reasons: ['x'] }],
    ['null', null],
  ])('lehnt ab: %s', (_name, raw) => expect(parseSnapshot(raw)).toBeNull())

  it('Anzeige: Schätzpreis in ganzen Euro (auch ohne Spanne), Richtpreis mit Cent', () => {
    const nbsp = ' '
    expect(priceLabel({ ...ok, totalCents: null, lowCents: 95000, highCents: 155000, lines: [] })).toEqual({ main: `950${nbsp}€ bis 1.550${nbsp}€`, range: null })
    expect(priceLabel({ ...ok, totalCents: 18000, lowCents: 18000, highCents: 18000, lines: [] })).toEqual({ main: `180,00${nbsp}€`, range: null }) // Mindestpreis: Festpreis centgenau (R2-N11)
    expect(priceLabel({ ...ok, totalCents: null, lowCents: 117410, highCents: 117420, lines: [] })).toEqual({ main: `ca. 1.174${nbsp}€`, range: null })
    // Spanne ohne verbindlichen Gesamtpreis ist gültig, wenn low < high und die Zeilensumme dazwischen liegt
    expect(parseSnapshot({ kind: 'price', lowCents: 900, highCents: 1100, lines: [{ key: 'a', cents: 1000 }] })).toMatchObject({ totalCents: null })
    expect(parseSnapshot({ kind: 'price', lowCents: 1000, highCents: 1000, lines: [{ key: 'a', cents: 1000 }] })).toBeNull()
    expect(parseSnapshot({ kind: 'price', lowCents: 900, highCents: 1100, lines: [{ key: 'a', cents: 1200 }] })).toBeNull()
    expect(priceLabel({ ...ok, totalCents: 68961, lowCents: 68961, highCents: 68961, lines: [] })).toEqual({ main: `689,61${nbsp}€`, range: null })
  })

  it('Übergabe über 20 000 Zeichen wird verworfen', () => {
    local.setItem('movenow.handover', JSON.stringify({ until: Date.now() + 60_000, items: { 'movenow.flow.montage': 'x'.repeat(20_001) } }))
    restoreDraft()
    expect(session.map.size).toBe(0)
    expect(local.getItem('movenow.handover')).toBeNull()
  })

  const response = { id: '7b0e7a58-6f0c-4c52-9d0c-5a1f3b9d2e11', status: 'requested', needsQuote: false, priceVersion: 1, snapshot: ok }
  it('sendet Token und clientRef und liefert die geprüfte Antwort', async () => {
    invoke.mockResolvedValue({ data: response, error: null })
    const quote = await sendQuote({ service: 'assembly' }, 'ref-1', 'tok')
    expect(invoke).toHaveBeenCalledWith('quote', { body: { service: 'assembly', clientRef: 'ref-1' }, headers: { Authorization: 'Bearer tok' } })
    expect(quote).toMatchObject({ id: response.id, needsQuote: false, snapshot: ok })
  })

  it('needsQuote passt nicht zur Art: kein Preis, aber die Anfrage ist gespeichert', async () => {
    invoke.mockResolvedValue({ data: { ...response, needsQuote: true }, error: null })
    expect(await sendQuote({}, 'r', 't')).toMatchObject({ id: response.id, snapshot: null })
  })

  it('ungültige id: Fehler', async () => {
    invoke.mockResolvedValue({ data: { ...response, id: 'x' }, error: null })
    await expect(sendQuote({}, 'r', 't')).rejects.toMatchObject({ kind: 'unavailable' })
  })

  const http = (status: number, json: unknown) => new FunctionsHttpError(new Response(JSON.stringify(json), { status }))
  it.each([
    [401, { error: 'unauthorized' }, 'unauthorized', null],
    [429, { error: 'rate_limited' }, 'rate_limited', null],
    [409, { error: 'not_editable' }, 'unavailable', null],
    [400, { error: 'invalid_input', message: 'preferredDate: heute bis höchstens 365 Tage voraus' }, 'invalid_input', 'preferredDate'],
    [400, { error: 'invalid_input', message: 'from.label: 1–200 Zeichen' }, 'invalid_input', 'from.label'],
    [400, { error: 'invalid_input', message: 'Rückgabe muss nach der Abholung liegen' }, 'invalid_input', null],
    [500, { error: 'internal' }, 'unavailable', null],
    [404, { error: 'not_found' }, 'unavailable', null],
    [413, { error: 'body_too_large' }, 'unavailable', null],
  ])('Status %i wird zu %s', async (status, json, kind, field) => {
    invoke.mockResolvedValue({ data: null, error: http(status, json) })
    await expect(sendQuote({}, 'r', 't')).rejects.toMatchObject({ kind, field })
  })

  it('kein Netz wird offline', async () => {
    invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError(new TypeError('Failed to fetch')) })
    await expect(sendQuote({}, 'r', 't')).rejects.toBeInstanceOf(QuoteError)
    await expect(sendQuote({}, 'r', 't')).rejects.toMatchObject({ kind: 'offline' })
  })
})

describe('Wiener Datum', () => {
  it('rechnet in Wien, nicht in der Zeitzone des Geräts', () => {
    // 23:30 UTC am 30.10. ist 00:30 MEZ am 31.10.
    expect(viennaToday(new Date('2026-10-30T23:30:00Z'))).toBe('2026-10-31')
    expect(viennaToday(new Date('2026-10-30T21:30:00Z'))).toBe('2026-10-30')
  })
})
