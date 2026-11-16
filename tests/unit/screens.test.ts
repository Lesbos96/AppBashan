// Komponententests ohne DOM: Die Screens werden mit react-dom/server gerendert (erster Render, ohne Effekte).
// Supabase, Sitzung und Illustrationen (matchMedia) sind gemockt; der Speicher ist ein Map-Ersatz.
// Interaktion prüfen weiter die Playwright-E2E; hier geht es um Inhalt, Zustände und Regeln aus CLAUDE.md, die jeder Screen einhalten muss.
import { createElement as h, type ComponentType, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let currentSession: unknown = undefined
vi.mock('../../src/lib/session', () => ({ useSession: () => currentSession, SessionProvider: ({ children }: { children: ReactNode }) => children }))
vi.mock('../../src/components/Illustration', () => ({ Illustration: ({ name }: { name: string }) => h('svg', { 'data-illustration': name, 'aria-hidden': 'true' }) }))
// `Sheet` liest `window.innerHeight` im Render (reine Client-App); sein Verhalten prüfen die E2E. Hier nur Titel und Inhalt, wenn offen.
vi.mock('../../src/components/Sheet', () => ({ Sheet: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) => (open ? h('dialog', { open: true, 'aria-label': title }, children) : null) }))
const fromCalls: string[] = []
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: (t: string) => {
      fromCalls.push(t)
      throw new Error('kein Netz im Render')
    },
    rpc: () => Promise.reject(new Error('kein Netz')),
    functions: { invoke: () => Promise.reject(new Error('kein Netz')) },
    auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  },
}))

const { Start } = await import('../../src/screens/Start')
const { Profil } = await import('../../src/screens/Profil')
const { Onboarding } = await import('../../src/screens/Onboarding')
const { Anmelden } = await import('../../src/screens/Anmelden')
const { Auftraege } = await import('../../src/screens/Auftraege')
const { Datenschutz, Impressum, Folgt } = await import('../../src/screens/Seiten')
const { Gesendet } = await import('../../src/screens/anfrage/Gesendet')

const store = () => {
  const map = new Map<string, string>()
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k), clear: () => map.clear(), map }
}
let session: ReturnType<typeof store>

beforeEach(() => {
  session = store()
  vi.stubGlobal('sessionStorage', session)
  vi.stubGlobal('localStorage', store())
  currentSession = undefined
  fromCalls.length = 0
})

const render = (element: ReactNode, at = '/') => renderToStaticMarkup(h(MemoryRouter, { initialEntries: [at] }, element))
// Nur normale Leerzeichen zusammenfassen: das geschützte Leerzeichen in Beträgen bleibt erhalten (\s würde es mitnehmen).
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/[ \t\r\n]+/g, ' ').trim()

/** Regeln, die jeder Kunden-Screen einhält (CLAUDE.md „Geld“ und „UI“). */
function expectCustomerRules(html: string) {
  // Keine Gebühr, kein Prototyp-Text: im sichtbaren Text und in vorgelesenen bzw. angezeigten Attributen
  const attributes = [...html.matchAll(/\s(?:aria-label|title|placeholder|alt)="([^"]*)"/g)].map((m) => m[1]).join(' ')
  expect(`${text(html)} ${attributes}`).not.toMatch(/gebühr|provision|15\s?%|plattform|prototyp|konzeptdemo/i)
  // Jeder Betrag kommt aus formatEuro/formatEuroRounded: geschütztes Leerzeichen vor €, damit Zahl und € nie umbrechen (auch ein € ganz am Anfang zählt)
  for (const m of html.matchAll(/(^|[\s\S])€/g)) expect(m[1], `Betrag ohne geschütztes Leerzeichen: …${html.slice(Math.max(0, m.index - 20), m.index + 2)}`).toBe(String.fromCharCode(160))
  // Jedes sichtbare Eingabefeld hat ein Label (umschließend, for= oder aria-label)
  for (const m of html.matchAll(/<input\b[^>]*>/g)) {
    const tag = m[0]
    if (/type="(hidden|file)"/.test(tag) || /\shidden(=""|\s|>)/.test(tag)) continue
    const id = /\sid="([^"]+)"/.exec(tag)?.[1]
    const before = html.slice(0, m.index)
    const wrapped = before.lastIndexOf('<label') > before.lastIndexOf('</label>')
    const labelled = /aria-label(ledby)?="/.test(tag) || (id !== undefined && new RegExp(`<label\\b[^>]*\\sfor="${id}"`).test(html))
    expect(wrapped || labelled, `Feld ohne Label: ${tag}`).toBe(true)
  }
  // Jeder Knopf und jeder Link hat einen zugänglichen Namen
  for (const m of html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const named = /aria-label="[^"]+"/.test(m[2]!) || text(m[3]!).length > 0
    expect(named, `ohne Namen: ${m[0].slice(0, 120)}`).toBe(true)
  }
}

describe('Regel-Prüfung selbst (Gegenprobe)', () => {
  // Jede Regel muss bei einem Verstoß rot werden, sonst sagen die grünen Screen-Tests nichts.
  it.each([
    ['Gebühr im Text', '<p>inkl. Plattformgebühr</p>'],
    ['15 %', '<p>15 % gehen an uns</p>'],
    ['Betrag mit normalem Leerzeichen', '<span>12,00 €</span>'],
    ['Feld ohne Label', '<input type="text" value="x"/>'],
    ['Knopf ohne Namen', '<button type="button"><svg aria-hidden="true"></svg></button>'],
    ['Link ohne Namen', '<a href="/x"></a>'],
    ['Gebühr nur im aria-label', '<button aria-label="Plattformgebühr anzeigen">i</button>'],
    ['€ ganz am Anfang', '€ 12'],
    ['for= an einem Nicht-Label', '<input id="n" type="text"/><span for="n">Name</span>'],
  ])('schlägt an: %s', (_, html) => {
    expect(() => expectCustomerRules(html)).toThrow()
  })

  it('lässt korrektes Markup durch', () => {
    const nbsp = String.fromCharCode(160)
    expect(() => expectCustomerRules(`<label>Mail<input type="email"/></label><input id="n" type="text"/><label for="n">Name</label><input type="file" hidden=""/><button aria-label="Schließen"><svg></svg></button><span>12,00${nbsp}€</span>`)).not.toThrow()
  })
})

describe('Ruhige Screens', () => {
  it.each<[string, ComponentType, string]>([
    ['Start', Start, '/'],
    ['Onboarding', Onboarding, '/willkommen'],
    ['Profil (abgemeldet)', Profil, '/profil'],
    ['Profil mit offenem Info-Sheet „Wie rechnet MoveNow?“ (Ladezustand)', Profil, '/profil/preise'],
    ['Datenschutz', Datenschutz, '/profil/datenschutz'],
    ['Impressum', Impressum, '/profil/impressum'],
  ])('%s rendert ohne Netz und hält die Kunden-Regeln ein', (_, Screen, at) => {
    const html = render(h(Screen), at)
    expect(html.length).toBeGreaterThan(200)
    expectCustomerRules(html)
    expect(fromCalls).toEqual([]) // kein Datenbankzugriff im ersten Render
  })

  it('Start bietet die vier Services der Phase 1 an', () => {
    const html = render(h(Start))
    for (const to of ['/transport', '/umzug', '/entruempelung', '/montage']) expect(html).toContain(`href="${to}"`)
  })

  it('Platzhalter „Folgt“ zeigt keinen Inhalt aus Phase 2', () => {
    const html = render(h(Folgt, { title: 'Für Vermieter' }), '/profil/vermieter')
    expectCustomerRules(html)
    expect(text(html)).toContain('Für Vermieter')
  })
})

describe('Anmelden', () => {
  it('ohne Sitzung: Mailfeld mit Label, kein Token in der Seite', () => {
    currentSession = null
    const html = render(h(Anmelden), '/anmelden?next=%2Fauftraege')
    expectCustomerRules(html)
    expect(html).toMatch(/<input[^>]*type="email"/)
    expect(html).not.toMatch(/token_hash|access_token/)
  })

  it('Link aus der Mail (Fragment): Token wird nicht in den Markup geschrieben', () => {
    currentSession = null
    const html = render(h(Anmelden), '/anmelden#token_hash=geheim123&type=email')
    expect(html).not.toContain('geheim123')
    expectCustomerRules(html)
  })
})

describe('Aufträge', () => {
  it('Sitzung lädt noch: Ladezustand, keine Abfrage', () => {
    const html = render(h(Auftraege), '/auftraege')
    expect(text(html)).toContain('Aufträge laden')
    expect(fromCalls).toEqual([])
  })

  it('ohne Sitzung: keine Liste und keine Abfrage (die Weiterleitung selbst prüft die E2E)', () => {
    currentSession = null
    const html = render(h(Auftraege), '/auftraege')
    expect(text(html)).not.toContain('Noch keine Aufträge')
    expect(fromCalls).toEqual([])
  })

  it('mit Sitzung: Ladezustand bis die eigene Liste kommt', () => {
    currentSession = { user: { id: 'u1', email: 'a@b.at' }, access_token: 't' }
    const html = render(h(Auftraege), '/auftraege')
    expect(text(html)).toContain('Aufträge laden')
    expectCustomerRules(html)
  })
})

describe('Bestätigung nach dem Senden', () => {
  const nbsp = String.fromCharCode(160)
  const id = '7b0e7a58-6f0c-4c52-9d0c-5a1f3b9d2e11'
  const fixed = { kind: 'price', totalCents: 12345, lowCents: 12345, highCents: 12345, lines: [{ key: 'assembly', cents: 12345 }] }
  const shownPrice = (c: number) => ({ kind: 'price', totalCents: c, lowCents: c, highCents: c })
  const put = (sent: Record<string, unknown>) => session.setItem('movenow.sent', JSON.stringify({ path: 'montage', id, status: 'requested', needsQuote: false, snapshot: fixed, shown: shownPrice(12345), date: '2026-11-20', route: 'Neubaugasse 12', ...sent }))

  it('Festpreis vom Server: Richtpreis mit Cent, Termin, kein Hinweis bei gleichem Preis', () => {
    put({})
    const html = render(h(Gesendet, { path: 'montage' }), '/montage/gesendet')
    expectCustomerRules(html)
    const t = text(html)
    expect(t).toContain('Anfrage gesendet.')
    expect(t).toContain(`Richtpreis 123,45${nbsp}€`)
    expect(t).toMatch(/Fr\.?, 20\. Nov\.?/)
    expect(t).toContain('Angefragt')
    expect(t).not.toContain('Der Preis wurde aktualisiert.')
  })

  it('anderer Serverpreis: Hinweis mit dem vorher angezeigten Betrag', () => {
    put({ shown: shownPrice(10000) })
    const t = text(render(h(Gesendet, { path: 'montage' }), '/montage/gesendet'))
    expect(t).toContain('Der Preis wurde aktualisiert.')
    expect(t).toContain(`Vorher angezeigt: 100,00${nbsp}€`)
    expect(t).toContain(`123,45${nbsp}€`)
  })

  it('Angebot nötig: kein Preis, Hinweis auf das Angebot und auf den vorher gesehenen Richtpreis', () => {
    put({ path: 'umzug', status: 'awaiting_offer', needsQuote: true, snapshot: { kind: 'offer', reasons: ['packing'] } })
    const t = text(render(h(Gesendet, { path: 'umzug' }), '/umzug/gesendet'))
    expect(t).toContain('Preis nach Prüfung')
    expect(t).toContain('Wartet auf Angebot')
    expect(t).toContain('Wir melden uns mit einem Angebot')
    expect(t).toContain('Der Preis wurde aktualisiert.')
    expect(t).not.toContain('Richtpreis')
  })

  it('unlesbarer Snapshot: kein Preis, kein Hinweis (nie ein halber Preis)', () => {
    put({ snapshot: { ...fixed, totalCents: 1 } })
    const t = text(render(h(Gesendet, { path: 'montage' }), '/montage/gesendet'))
    expect(t).toContain('Preis siehe Aufträge')
    expect(t).not.toContain('Der Preis wurde aktualisiert.')
    expect(t).not.toMatch(/\d,\d\d/)
  })

  it('Bestätigung eines anderen Service oder keine Bestätigung: nichts anzeigen (Weiterleitung)', () => {
    put({ path: 'transport' })
    expect(text(render(h(Gesendet, { path: 'montage' }), '/montage/gesendet'))).toBe('')
    session.map.clear()
    expect(text(render(h(Gesendet, { path: 'montage' }), '/montage/gesendet'))).toBe('')
  })
})
