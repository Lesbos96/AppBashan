import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSent, contactKey, readContact, readSent, readShownFull, readTermin, rememberShown, shownFullKey, terminKey, writeContact } from '../../src/lib/draft'

// Gespeicherte Entwurfsteile (sessionStorage): nur Gültiges wird gelesen, kaputter oder gesperrter Speicher führt nie zu einem Absturz.

const store = () => {
  const map = new Map<string, string>()
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k), map }
}
let session: ReturnType<typeof store>
const locked = () => {
  const boom = () => {
    throw new Error('SecurityError')
  }
  vi.stubGlobal('sessionStorage', { getItem: boom, setItem: boom, removeItem: boom })
}

beforeEach(() => {
  session = store()
  vi.stubGlobal('sessionStorage', session)
})

describe('Kontakt', () => {
  const c = { name: 'Alex Muster', phone: '+43 660 1234567', email: 'a@b.at', stairsDoor: '2/14' }

  it('schreibt und liest je Service getrennt', () => {
    writeContact('umzug', c)
    expect(readContact('umzug')).toEqual(c)
    expect(readContact('montage')).toEqual({ name: '', phone: '', email: '', stairsDoor: '' })
  })

  it('unvollständiger oder falsch typisierter Kontakt ergibt leere Felder', () => {
    session.setItem(contactKey('umzug'), JSON.stringify({ ...c, phone: 6601234567 }))
    expect(readContact('umzug').phone).toBe('')
    session.setItem(contactKey('umzug'), JSON.stringify({ name: 'x' }))
    expect(readContact('umzug')).toEqual({ name: '', phone: '', email: '', stairsDoor: '' })
    session.setItem(contactKey('umzug'), '{')
    expect(readContact('umzug').name).toBe('')
  })

  it('gesperrter Speicher: Schreiben und Lesen ohne Fehler', () => {
    locked()
    expect(() => writeContact('umzug', c)).not.toThrow()
    expect(readContact('umzug').email).toBe('')
  })
})

describe('Termin', () => {
  const t = { date: '2026-11-20', window: 'morning', place: 'Neubaugasse 12, 1070 Wien', point: { lat: 48.2, lon: 16.35 }, consent: true }
  const initial = { date: null, window: 'flexible', place: '', point: null, consent: false }

  it('gültiger Termin wird gelesen', () => {
    session.setItem(terminKey('montage'), JSON.stringify(t))
    expect(readTermin('montage')).toEqual(t)
  })

  it.each([
    ['Datum mit Uhrzeit', { ...t, date: '2026-11-20T10:00' }],
    ['Datum in anderem Format', { ...t, date: '20.11.2026' }],
    ['unbekanntes Zeitfenster', { ...t, window: 'night' }],
    ['Ort über 200 Zeichen', { ...t, place: 'x'.repeat(201) }],
    ['Einwilligung als Text', { ...t, consent: 'ja' }],
    ['Punkt mit Text', { ...t, point: { lat: '48.2', lon: 16.35 } }],
    ['Punkt ohne lon', { ...t, point: { lat: 48.2 } }],
  ])('verwirft %s', (_, value) => {
    session.setItem(terminKey('montage'), JSON.stringify(value))
    expect(readTermin('montage')).toEqual(initial)
  })

  it('Ort mit genau 200 Zeichen und Datum null sind gültig', () => {
    session.setItem(terminKey('montage'), JSON.stringify({ ...t, date: null, place: 'x'.repeat(200) }))
    expect(readTermin('montage')).toMatchObject({ date: null, place: 'x'.repeat(200) })
  })
})

describe('Gemerkte Vorschau (shown)', () => {
  it('Festpreis, Spanne und Angebot werden vollständig gelesen', () => {
    rememberShown('transport', 68961, { kind: 'price', totalCents: 68961, lowCents: 68961, highCents: 68961 })
    expect(readShownFull('transport')).toEqual({ kind: 'price', totalCents: 68961, lowCents: 68961, highCents: 68961 })
    rememberShown('entruempelung', null, { kind: 'price', totalCents: null, lowCents: 95000, highCents: 155000 })
    expect(readShownFull('entruempelung')).toEqual({ kind: 'price', totalCents: null, lowCents: 95000, highCents: 155000 })
    rememberShown('umzug', null, { kind: 'offer', reasons: ['packing'] })
    expect(readShownFull('umzug')).toEqual({ kind: 'offer', reasons: ['packing'] })
  })

  it.each([
    ['Bruchteil-Cent', { kind: 'price', totalCents: 10.5, lowCents: 10, highCents: 11 }],
    ['negativ', { kind: 'price', totalCents: null, lowCents: -1, highCents: 5 }],
    ['Angebot ohne Grund', { kind: 'offer', reasons: [] }],
    ['Angebot mit Zahl als Grund', { kind: 'offer', reasons: [1] }],
    ['unbekannte Art', { kind: 'rabatt', totalCents: 1 }],
    ['Text', 'x'],
  ])('verwirft %s', (_, value) => {
    session.setItem(shownFullKey('transport'), JSON.stringify(value))
    expect(readShownFull('transport')).toBeNull()
  })

  it('übernimmt keine Zusatzfelder aus dem Speicher', () => {
    session.setItem(shownFullKey('transport'), JSON.stringify({ kind: 'price', totalCents: 100, lowCents: 100, highCents: 100, feeCents: 15 }))
    expect(readShownFull('transport')).toEqual({ kind: 'price', totalCents: 100, lowCents: 100, highCents: 100 })
  })
})

describe('Bestätigung (sent)', () => {
  const sent = { path: 'montage', id: '7b0e7a58-6f0c-4c52-9d0c-5a1f3b9d2e11', status: 'requested', needsQuote: false, snapshot: null, shownCents: 12000, date: '2026-11-20', route: 'Neubaugasse' }

  it('liest die Bestätigung und verwirft unbekannte Pfade oder fehlende id', () => {
    session.setItem('movenow.sent', JSON.stringify(sent))
    expect(readSent()).toMatchObject({ path: 'montage', shownCents: 12000 })
    session.setItem('movenow.sent', JSON.stringify({ ...sent, path: 'miete' }))
    expect(readSent()).toBeNull()
    session.setItem('movenow.sent', JSON.stringify({ ...sent, id: 7 }))
    expect(readSent()).toBeNull()
  })

  it.each([0, -5, 1.5, '12000', null])('ungültiger Vorschaupreis %j wird null (kein Hinweis)', (shownCents) => {
    session.setItem('movenow.sent', JSON.stringify({ ...sent, shownCents }))
    expect(readSent()?.shownCents).toBeNull()
  })

  it('clearSent löscht die Bestätigung; gesperrter Speicher wirft nicht', () => {
    session.setItem('movenow.sent', JSON.stringify(sent))
    clearSent()
    expect(readSent()).toBeNull()
    locked()
    expect(() => clearSent()).not.toThrow()
    expect(readSent()).toBeNull()
  })
})
