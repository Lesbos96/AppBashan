// Bestätigungsseite: Hinweis „Der Preis wurde aktualisiert“ nur, wenn der Serverpreis anders angezeigt wird als die Vorschau
// (OPEN_ISSUES Plan-M-1: vorher verglich die Seite bei Spannen den Mittelwert mit „X bis Y“ und zeigte den Hinweis immer).
// Server-Rendering ohne DOM; Supabase wird nicht gebraucht.
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/lib/supabase', () => ({ supabase: {} }))
const { Gesendet } = await import('../../src/screens/anfrage/Gesendet')
const { finishDraft, readSent, readShownFull, rememberShown } = await import('../../src/lib/draft')
type Shown = NonNullable<ReturnType<typeof readShownFull>>
type P = 'entruempelung' | 'montage'

const store = () => {
  const map = new Map<string, string>()
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k), map }
}
beforeEach(() => vi.stubGlobal('sessionStorage', store()))

const nbsp = String.fromCharCode(160)
const id = '7b0e7a58-6f0c-4c52-9d0c-5a1f3b9d2e11'
const range = { kind: 'price', lowCents: 95000, highCents: 155000, lines: [{ key: 'clearance', cents: 125000 }] }
const fixed = (c: number) => ({ kind: 'price', totalCents: c, lowCents: c, highCents: c, lines: [{ key: 'assembly', cents: c }] })

/** Wie die App: Vorschau merken (Ergebnis bzw. Montage), nach dem Senden die Bestätigung mit `readShownFull` schreiben (Zusammenfassung). */
function send(path: P, shown: Shown, snapshot: unknown, needsQuote: boolean) {
  rememberShown(path, shown)
  finishDraft(path, { path, id, status: needsQuote ? 'awaiting_offer' : 'requested', needsQuote, snapshot, shown: readShownFull(path), date: '2026-11-20', route: '' })
}
const text = (path: P) =>
  renderToStaticMarkup(h(MemoryRouter, { initialEntries: [`/${path}/gesendet`] }, h(Gesendet, { path })))
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\r\n]+/g, ' ')

describe('Hinweis „Vorher angezeigt“', () => {
  it('Spanne der Entrümpelung, Server liefert dieselbe Spanne: kein Hinweis', () => {
    send('entruempelung', { kind: 'price', totalCents: null, lowCents: 95000, highCents: 155000 }, range, true)
    const t = text('entruempelung')
    expect(t).toContain(`950${nbsp}€ bis 1.550${nbsp}€`)
    expect(t).not.toContain('Der Preis wurde aktualisiert.')
  })

  it('Spanne, Server liefert eine andere Spanne: Hinweis mit der vorher gezeigten Spanne', () => {
    send('entruempelung', { kind: 'price', totalCents: null, lowCents: 90000, highCents: 150000 }, range, true)
    const t = text('entruempelung')
    expect(t).toContain('Der Preis wurde aktualisiert.')
    expect(t).toContain(`Vorher angezeigt: 900${nbsp}€ bis 1.500${nbsp}€`)
  })

  it('Spanne, Server verlangt ein Angebot: Hinweis bleibt (nie still)', () => {
    send('entruempelung', { kind: 'price', totalCents: null, lowCents: 90000, highCents: 150000 }, { kind: 'offer', reasons: ['heavily_loaded'] }, true)
    expect(text('entruempelung')).toContain('Der Preis wurde aktualisiert.')
  })

  it('Festpreis gleich: kein Hinweis; Festpreis anders: Hinweis mit Cent', () => {
    send('montage', { kind: 'price', totalCents: 12345, lowCents: 12345, highCents: 12345 }, fixed(12345), false)
    expect(text('montage')).not.toContain('Der Preis wurde aktualisiert.')
    send('montage', { kind: 'price', totalCents: 10000, lowCents: 10000, highCents: 10000 }, fixed(12345), false)
    expect(text('montage')).toContain(`Vorher angezeigt: 100,00${nbsp}€`)
  })

  it('Vorschau war ein Angebot: kein Hinweis „Vorher angezeigt“', () => {
    send('entruempelung', { kind: 'offer', reasons: ['commercial'] }, { kind: 'offer', reasons: ['commercial'] }, true)
    expect(text('entruempelung')).not.toContain('Vorher angezeigt')
  })

  it('gemerkter Preis wird streng geprüft (kein halber Wert, keine Bestätigung alter Form)', () => {
    sessionStorage.setItem('movenow.sent', JSON.stringify({ path: 'montage', id, status: 'requested', needsQuote: false, snapshot: fixed(1), shown: { kind: 'price', totalCents: 1.5, lowCents: 1, highCents: 2 }, date: null, route: '' }))
    expect(readSent()?.shown).toBeNull()
    // Bestätigung aus der Version vor diesem Fix (nur `shownCents`): kein Hinweis statt eines falschen
    sessionStorage.setItem('movenow.sent', JSON.stringify({ path: 'montage', id, status: 'requested', needsQuote: false, snapshot: fixed(1), shownCents: 99, date: null, route: '' }))
    expect(readSent()?.shown).toBeNull()
    expect(text('montage')).not.toContain('Der Preis wurde aktualisiert.')
  })
})
