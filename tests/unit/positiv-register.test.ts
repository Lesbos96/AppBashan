// Positivzeilen-Register (u3): jede Funktion aus `database.types.ts` steht im Register oder in der Ausnahmeliste, nie in beiden, keine Karteileichen.
// Ohne Eintrag ist `check` rot (Typbindung in tests/support/positiv.ts fängt es schon beim Typecheck, dieser Test beim Abgleich mit der erzeugten Datei).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AUSNAHMEN, REGISTER } from '../support/positiv.ts'

const text = (pfad: string) => readFileSync(new URL(pfad, import.meta.url), 'utf8')

/** Namen aus dem Abschnitt `Functions: {` bis `Enums: {` der erzeugten Typdatei (Einzug 6). */
export function funktionsnamen(typen: string): string[] {
  const von = typen.indexOf('    Functions: {')
  const bis = typen.indexOf('    Enums: {', von)
  if (von < 0 || bis < 0) throw new Error('database.types.ts: Abschnitt Functions nicht gefunden')
  const namen = [...typen.slice(von, bis).matchAll(/^ {6}([a-z_0-9]+): /gm)].map((m) => m[1]!)
  if (namen.length < 50) throw new Error(`database.types.ts: nur ${namen.length} Funktionen gelesen`)
  return namen
}

describe('Register gegen database.types.ts', () => {
  const namen = funktionsnamen(text('../../supabase/functions/_shared/database.types.ts'))
  const register = Object.keys(REGISTER)
  const ausnahmen = Object.keys(AUSNAHMEN)

  it('jede Funktion hat genau einen Eintrag: Register oder Ausnahmeliste', () => {
    expect(namen.filter((n) => !register.includes(n) && !ausnahmen.includes(n)), 'Funktion ohne Registereintrag').toEqual([])
    expect([...register, ...ausnahmen].filter((n) => !namen.includes(n)), 'Eintrag ohne Funktion').toEqual([])
    expect(register.filter((n) => ausnahmen.includes(n)), 'in beiden').toEqual([])
  })

  it('der Parser findet die Namen (Gegenprobe: ein entfernter Name fehlt im Abgleich)', () => {
    expect(namen).toContain('partner_accept_basis')
    expect(funktionsnamen('    Functions: {\n' + namen.slice(1).map((n) => `      ${n}: { Args: never }\n`).join('') + '    Enums: {')).not.toContain(namen[0])
  })

  it('Ausnahmen haben einen Grund; bekannte Fehler nennen den OFFEN-Eintrag', () => {
    for (const [name, a] of Object.entries(AUSNAHMEN) as [string, { art: string; grund: string; offen?: string }][]) {
      expect(a.grund.length, `${name}: Grund`).toBeGreaterThan(20)
      if (a.art === 'bekannter_fehler') expect(a.offen, `${name}: OFFEN-Verweis`).toMatch(/^OFFEN [\w-]+$/)
    }
  })

  it('Register und Test halten die Regeln der Planprüfung: keine Commits, kein db.ts, keine Auth-Nutzer, keine Abdeckungsfirma', () => {
    for (const pfad of ['../support/positiv.ts', '../rls/positiv.test.ts']) {
      const t = text(pfad)
      for (const verboten of [/\bcommit\b/i, /support\/db\.ts/, /\bmakeUser\b/, /committedCoverFirm/, /auth\.admin/]) expect(t, `${pfad}: ${verboten}`).not.toMatch(verboten)
    }
  })

  it('kein Registertext beendet die Rollback-Probe (`probes` klebt die Texte in begin; … rollback;)', () => {
    const t = text('../support/positiv.ts')
    expect(t).not.toMatch(/\brollback\s*(;|to\b|and\b)|\bsavepoint\b|\bend\s+transaction\b/i)
  })

  it('Geldspalten sind ganzzahlig: jede Spalte *_cents und prior_*, dazu die Wertfunktionen payout_preview und my_cancel_info nur int4 oder int8', () => {
    const geld = (n: string) => /_cents$/.test(n) || /^prior_(fee|net|payout|total|vat)$/.test(n)
    const alle = Object.entries(REGISTER) as [string, { spalten?: Record<string, string>; typ?: string }][]
    const falsch = alle.flatMap(([fn, e]) => [
      ...Object.entries(e.spalten ?? {}).filter(([c, t]) => geld(c) && t !== 'int4' && t !== 'int8').map(([c, t]) => `${fn}.${c}: ${t}`),
      ...(['payout_preview', 'my_cancel_info'].includes(fn) && e.typ !== 'int4' && e.typ !== 'int8' ? [`${fn}: ${e.typ}`] : []),
    ])
    expect(falsch).toEqual([])
    expect(alle.filter(([, e]) => Object.keys(e.spalten ?? {}).some(geld)).length, 'es gibt Geldspalten im Register').toBeGreaterThan(10)
  })

  it('Funktionen mit p_actor laufen nur als service_role (Typ erzwingt es, hier der Laufzeitblick)', () => {
    const typen = text('../../supabase/functions/_shared/database.types.ts')
    const mitActor = [...typen.matchAll(/^ {6}([a-z_0-9]+): \{\n {8}Args: \{[^}]*\bp_actor: /gm)].map((m) => m[1]!)
    expect(mitActor.length).toBeGreaterThan(10)
    for (const n of mitActor) expect((REGISTER as Record<string, { als: string }>)[n]?.als, n).toBe('service_role')
  })
})
