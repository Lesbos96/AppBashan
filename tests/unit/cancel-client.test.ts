import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CancelError, cancelErrorText, cancelRequest, feeText, previewCancel, timeline } from '../../src/lib/cancel'

const invoke = vi.fn()
vi.mock('../../src/lib/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }))

const ID = '0b8f1c3e-5d2a-4e7b-9a61-3c4d5e6f7a8b'
const http = (status: number, json: unknown) => new FunctionsHttpError(new Response(JSON.stringify(json), { status }))

beforeEach(() => invoke.mockReset())

describe('previewCancel / cancelRequest', () => {
  it('Vorschau sendet nur requestId und preview, liefert den Betrag des Servers', async () => {
    invoke.mockResolvedValue({ data: { cancelFeeCents: 34481 }, error: null })
    expect(await previewCancel(ID)).toBe(34481)
    expect(invoke).toHaveBeenCalledWith('cancel-customer', { body: { requestId: ID, preview: true } })
  })

  it('Storno sendet genau den gezeigten Betrag', async () => {
    invoke.mockResolvedValue({ data: { status: 'cancelled_by_customer', cancelFeeCents: 0 }, error: null })
    await cancelRequest(ID, 0)
    expect(invoke).toHaveBeenCalledWith('cancel-customer', { body: { requestId: ID, shownFeeCents: 0 } })
  })

  it('unlesbarer Betrag der Vorschau ist ein Fehler, nie 0', async () => {
    for (const data of [{}, { cancelFeeCents: -1 }, { cancelFeeCents: 1.5 }, { cancelFeeCents: '0' }, null]) {
      invoke.mockResolvedValue({ data, error: null })
      await expect(previewCancel(ID)).rejects.toMatchObject({ kind: 'unavailable' })
    }
  })

  it('409 cancel_fee_changed trägt den neuen Betrag', async () => {
    invoke.mockResolvedValue({ data: null, error: http(409, { error: 'cancel_fee_changed', cancelFeeCents: 68961 }) })
    await expect(cancelRequest(ID, 34481)).rejects.toMatchObject({ kind: 'fee_changed', cancelFeeCents: 68961 })
  })

  it.each([
    [409, 'too_late_use_report_not_done', 'too_late'],
    [409, 'under_review', 'under_review'],
    [409, 'invalid_transition', 'closed'],
    [409, 'retry', 'retry'],
    [404, 'not_found', 'closed'],
    [401, 'unauthorized', 'unauthorized'],
    [500, 'internal', 'unavailable'],
  ])('%i %s wird %s', async (status, error, kind) => {
    invoke.mockResolvedValue({ data: null, error: http(status, { error }) })
    await expect(cancelRequest(ID, 0)).rejects.toMatchObject({ kind })
  })

  it('Netzfehler ist offline', async () => {
    invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError(new Error('x')) })
    await expect(cancelRequest(ID, 0)).rejects.toBeInstanceOf(CancelError)
    await expect(cancelRequest(ID, 0)).rejects.toMatchObject({ kind: 'offline' })
  })

  it('jede Art hat einen Text ohne Gebührenwort', () => {
    for (const text of Object.values(cancelErrorText)) expect(text).not.toMatch(/Provision|Plattform|15 ?%/)
    expect(Object.keys(cancelErrorText).sort()).toEqual(['closed', 'fee_changed', 'offline', 'retry', 'too_late', 'unauthorized', 'unavailable', 'under_review'])
  })
})

describe('feeText', () => {
  it('0 ist kostenlos, sonst formatEuro', () => {
    expect(feeText(0)).toBe('Kostenlos')
    expect(feeText(34481)).toMatch(/^344,81.€$/)
  })
})

describe('timeline', () => {
  it('laufende Aufträge zeigen vier Schritte mit dem aktuellen', () => {
    expect(timeline('requested')).toEqual({ steps: ['Angefragt', 'Bestätigt', 'Läuft', 'Erledigt'], current: 0 })
    expect(timeline('awaiting_offer')).toEqual({ steps: ['Angefragt', 'Bestätigt', 'Läuft', 'Erledigt'], current: 0 })
    expect(timeline('offered')).toEqual({ steps: ['Angefragt', 'Bestätigt', 'Läuft', 'Erledigt'], current: 0 })
    expect(timeline('accepted')).toEqual({ steps: ['Angefragt', 'Bestätigt', 'Läuft', 'Erledigt'], current: 1 })
    expect(timeline('in_progress')).toEqual({ steps: ['Angefragt', 'Bestätigt', 'Läuft', 'Erledigt'], current: 2 })
    expect(timeline('completed')).toEqual({ steps: ['Angefragt', 'Bestätigt', 'Läuft', 'Erledigt'], current: 3 })
  })

  it('Endzustände ohne Fortschritt: nur ein Text', () => {
    expect(timeline('cancelled_by_customer')).toEqual({ end: 'Du hast den Auftrag storniert.' })
    expect(timeline('cancelled_by_partner')).toEqual({ end: 'Der Partner hat den Auftrag storniert.' })
    expect(timeline('withdrawn')).toEqual({ end: 'Du hast die Anfrage zurückgezogen.' })
    expect(timeline('expired')).toEqual({ end: 'Die Anfrage ist abgelaufen.' })
    expect(timeline('declined')).toEqual({ end: 'Die Anfrage wurde abgelehnt.' })
    expect(timeline('unmatched')).toEqual({ end: 'Wir haben keinen passenden Partner gefunden.' })
  })

  it('unbekannter Status: nur ein neutraler Text', () => {
    expect(timeline('xyz')).toEqual({ end: 'Der Auftrag wird geprüft.' })
  })
})
