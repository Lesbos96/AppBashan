import { FunctionsHttpError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()
const rpc = vi.fn()
vi.mock('../../src/lib/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) }, rpc: (...a: unknown[]) => rpc(...a) } }))

const { errorText, invalidTarget, invalidText, loadTerms, parseSnapshot, parseTerms, rejectedText, sendQuote, shownFromSnapshot, shownLabel, termsText } = await import('../../src/lib/quote')
const { paths } = await import('../../src/lib/draft')

beforeEach(() => {
  invoke.mockReset()
  rpc.mockReset()
})

const nbsp = String.fromCharCode(160)
const hash = 'a'.repeat(64)
const terms = { termsHash: hash, cancel_free_hours: 48, cancel_late_percent: 30, cancel_full_percent: 100, cancel_full_days_before: 1, call_out_fee_cents: 4900 }

describe('parseTerms und loadTerms (Stornobedingungen)', () => {
  it('nimmt nur vollständige Bedingungen mit sha256-Hash', () => {
    expect(parseTerms(terms)).toEqual(terms)
    expect(parseTerms({ ...terms, termsHash: 'A'.repeat(64) })).toBeNull() // nur Kleinbuchstaben, wie der Server
    expect(parseTerms({ ...terms, termsHash: 'a'.repeat(63) })).toBeNull()
    expect(parseTerms({ ...terms, cancel_late_percent: '30' })).toBeNull()
    expect(parseTerms(Object.fromEntries(Object.entries(terms).filter(([k]) => k !== 'call_out_fee_cents')))).toBeNull()
    expect(parseTerms(null)).toBeNull()
    expect(parseTerms('x')).toBeNull()
  })

  it('loadTerms liefert geprüfte Bedingungen, sonst Fehler (nie Ersatzwerte)', async () => {
    rpc.mockResolvedValueOnce({ data: terms, error: null })
    await expect(loadTerms()).resolves.toEqual(terms)
    expect(rpc).toHaveBeenCalledWith('booking_terms')
    rpc.mockResolvedValueOnce({ data: { ...terms, termsHash: 'x' }, error: null })
    await expect(loadTerms()).rejects.toThrow('Bedingungen unlesbar')
    const dbError = { message: 'boom', code: 'XX000' }
    rpc.mockResolvedValueOnce({ data: null, error: dbError })
    await expect(loadTerms()).rejects.toBe(dbError)
  })

  it('termsText: Tage 0, 1 und mehr in Worten, Anfahrtspauschale in Cent', () => {
    expect(termsText({ ...terms, cancel_full_days_before: 0 }).storno[1]).toBe('Danach werden 30 % des Preises berechnet, ab dem Tag des Termins 100 %.')
    expect(termsText(terms).storno[1]).toContain('ab einem Tag vor dem Termin 100 %')
    expect(termsText({ ...terms, cancel_full_days_before: 3 }).storno[1]).toContain('ab 3 Tagen vor dem Termin')
    expect(termsText(terms).storno[0]).toBe('Kostenlos stornieren kannst du bis 48 Stunden vor dem Termin.')
    expect(termsText(terms).callOutCents).toBe(4900)
  })
})

describe('Anzeige von shown und Serverpreis', () => {
  it('shownLabel: Festpreis mit Cent, Spanne gerundet, Angebot ohne Betrag', () => {
    expect(shownLabel({ kind: 'price', totalCents: 68961, lowCents: 68961, highCents: 68961 })).toBe(`689,61${nbsp}€`)
    expect(shownLabel({ kind: 'price', totalCents: null, lowCents: 95049, highCents: 155050 })).toBe(`950${nbsp}€ bis 1.551${nbsp}€`)
    expect(shownLabel({ kind: 'offer', reasons: ['packing'] })).toBe('Preis nach Prüfung')
  })

  it('shownFromSnapshot übernimmt genau die angezeigten Werte, ohne Zeilen', () => {
    const s = parseSnapshot({ kind: 'price', totalCents: 1000, lowCents: 1000, highCents: 1000, lines: [{ key: 'team', cents: 1000 }] })!
    expect(shownFromSnapshot(s)).toEqual({ kind: 'price', totalCents: 1000, lowCents: 1000, highCents: 1000 })
    expect(shownFromSnapshot({ kind: 'offer', reasons: ['route_missing'] })).toEqual({ kind: 'offer', reasons: ['route_missing'] })
    const range = parseSnapshot({ kind: 'price', lowCents: 900, highCents: 1100, lines: [{ key: 'clearance', cents: 1000 }] })!
    expect(shownFromSnapshot(range)).toEqual({ kind: 'price', totalCents: null, lowCents: 900, highCents: 1100 })
  })
})

describe('Fehlertexte', () => {
  it('400: Feldtext je Präfix, sonst allgemeiner Text; nie die Servermeldung', () => {
    expect(invalidText('preferredDate')).toMatch(/^Das Wunschdatum geht nicht/)
    expect(invalidText('from.label')).toMatch(/^Mit einer Adresse/)
    expect(invalidText('to')).toMatch(/^Mit einer Adresse/)
    expect(invalidText('timeWindow')).toMatch(/^Das Zeitfenster/)
    // ähnliche, aber andere Felder bekommen den allgemeinen Text
    for (const f of ['fromage', 'preferredDates', 'inputs.crew', null]) expect(invalidText(f)).toBe('Eine Angabe passt nicht. Gehe zurück und prüfe deine Eingaben.')
  })

  it('invalidTarget: Termin-Seite nur für Felder, die dort stehen', () => {
    // Transport und Umzug: Adressen stehen im Konfigurator, nur das Datum im Termin
    expect(invalidTarget('transport', 'preferredDate')).toBe('/transport/termin')
    expect(invalidTarget('transport', 'from.label')).toBe('/transport')
    expect(invalidTarget('umzug', 'timeWindow')).toBe('/umzug')
    // Entrümpelung und Montage: Datum, Zeitfenster und Ort im Termin
    expect(invalidTarget('entruempelung', 'from.point')).toBe('/entruempelung/termin')
    expect(invalidTarget('montage', 'timeWindow')).toBe('/montage/termin')
    expect(invalidTarget('entruempelung', 'inputs.area')).toBe('/entruempelung/ergebnis')
    expect(invalidTarget('montage', null)).toBe('/montage')
    expect(invalidTarget('montage', 'fromX')).toBe('/montage')
  })

  it('jede Fehlerart hat einen Text ohne Code, Gebühr oder Fachbegriff', () => {
    const texts = [...Object.values(errorText), ...Object.values(rejectedText)]
    expect(Object.keys(errorText).sort()).toEqual(['offline', 'provider', 'rate_limited', 'unauthorized', 'unavailable'])
    expect(Object.keys(rejectedText).sort()).toEqual(['address_imprecise', 'address_mismatch', 'address_point_required', 'district_required', 'offer_not_bookable', 'pickup_outside_vienna'])
    for (const t of texts) {
      expect(t).toMatch(/^[A-ZÄÖÜ]/)
      expect(t).not.toMatch(/_|\d{3}|gebühr|provision|15 ?%|plattform/i)
    }
  })

  it('jeder Service hat eine Termin- und eine Rücksprung-Route', () => {
    for (const p of paths) {
      expect(invalidTarget(p, 'preferredDate')).toBe(`/${p}/termin`)
      expect(invalidTarget(p, null)).toMatch(/^\//)
    }
  })
})

describe('sendQuote: Fehlerfälle', () => {
  const http = (status: number, body: string) => new FunctionsHttpError(new Response(body, { status }))
  const snapshot = { kind: 'price', totalCents: 2000, lowCents: 2000, highCents: 2000, lines: [{ key: 'team', cents: 2000 }] }

  it('503: Anbieter der Adressprüfung gestört', async () => {
    invoke.mockResolvedValue({ data: null, error: http(503, '{"error":"provider_unavailable"}') })
    await expect(sendQuote({}, 'r', 't')).rejects.toMatchObject({ kind: 'provider' })
  })

  it('409 price_changed: neuer Preis und Version kommen mit, ein kaputter Snapshot wird null', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: http(409, JSON.stringify({ error: 'price_changed', priceVersion: 2, snapshot })) })
    await expect(sendQuote({}, 'r', 't')).rejects.toMatchObject({ kind: 'price_changed', conflict: { priceVersion: 2, snapshot } })
    invoke.mockResolvedValueOnce({ data: null, error: http(409, JSON.stringify({ error: 'price_changed', priceVersion: '2', snapshot: { ...snapshot, totalCents: 1 } })) })
    await expect(sendQuote({}, 'r', 't')).rejects.toMatchObject({ kind: 'price_changed', conflict: { priceVersion: undefined, snapshot: null } })
  })

  it('409 terms_changed: nur geprüfte Bedingungen', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: http(409, JSON.stringify({ error: 'terms_changed', terms })) })
    await expect(sendQuote({}, 'r', 't')).rejects.toMatchObject({ kind: 'terms_changed', conflict: { terms } })
    invoke.mockResolvedValueOnce({ data: null, error: http(409, JSON.stringify({ error: 'terms_changed', terms: { termsHash: 'x' } })) })
    await expect(sendQuote({}, 'r', 't')).rejects.toMatchObject({ kind: 'terms_changed', conflict: { terms: undefined } })
  })

  it('422: too_late wird ein Datumsfehler, andere Codes werden „rejected“ mit Code', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: http(422, '{"error":"too_late"}') })
    await expect(sendQuote({}, 'r', 't')).rejects.toMatchObject({ kind: 'invalid_input', field: 'preferredDate' })
    invoke.mockResolvedValueOnce({ data: null, error: http(422, '{"error":"photo_missing"}') })
    await expect(sendQuote({}, 'r', 't')).rejects.toMatchObject({ kind: 'rejected', code: 'photo_missing' })
    invoke.mockResolvedValueOnce({ data: null, error: http(422, '{"error":42}') })
    await expect(sendQuote({}, 'r', 't')).rejects.toMatchObject({ kind: 'rejected', code: null })
  })

  it('Antwortkörper ohne JSON: Fehlerart bleibt, kein Feld, kein Absturz', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: http(400, 'kein json') })
    await expect(sendQuote({}, 'r', 't')).rejects.toMatchObject({ kind: 'invalid_input', field: null })
    invoke.mockResolvedValueOnce({ data: null, error: http(409, '<html>') })
    await expect(sendQuote({}, 'r', 't')).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('Feld aus der Servermeldung nur als Bezeichner (keine Sonderzeichen, nicht der Text)', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: http(400, JSON.stringify({ message: '<script>: x' })) })
    await expect(sendQuote({}, 'r', 't')).rejects.toMatchObject({ field: null })
    invoke.mockResolvedValueOnce({ data: null, error: http(400, JSON.stringify({ message: 'contact.email: ungültig' })) })
    await expect(sendQuote({}, 'r', 't')).rejects.toMatchObject({ field: 'contact.email' })
  })

  it('anderer Fehler (kein HTTP, kein Netz): unavailable', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error('relay') })
    await expect(sendQuote({}, 'r', 't')).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('Antwort ohne gültigen Status ist ein Fehler, Spanne mit needsQuote ist stimmig', async () => {
    const id = '7b0e7a58-6f0c-4c52-9d0c-5a1f3b9d2e11'
    invoke.mockResolvedValueOnce({ data: { id, status: 'accepted', needsQuote: false, snapshot }, error: null })
    await expect(sendQuote({}, 'r', 't')).rejects.toMatchObject({ kind: 'unavailable' })
    const range = { kind: 'price', lowCents: 900, highCents: 1100, lines: [{ key: 'clearance', cents: 1000 }] }
    invoke.mockResolvedValueOnce({ data: { id, status: 'awaiting_offer', needsQuote: true, snapshot: range }, error: null })
    await expect(sendQuote({}, 'r', 't')).resolves.toMatchObject({ status: 'awaiting_offer', needsQuote: true, snapshot: { totalCents: null } })
    // needsQuote fehlt: Anfrage gespeichert, Preis wird nicht gezeigt
    invoke.mockResolvedValueOnce({ data: { id, status: 'requested', snapshot }, error: null })
    await expect(sendQuote({}, 'r', 't')).resolves.toMatchObject({ needsQuote: false, snapshot: null })
  })
})
