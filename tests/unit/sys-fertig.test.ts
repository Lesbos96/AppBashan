import { describe, expect, it } from 'vitest'
import { MUSS_ABNAHME, pruefeFertig, type FertigKontext, type Lauf } from '../../scripts/sys/fertig.mjs'

const AB = { check: 'a1', e2e: 'a2', rls: 'a3' }
const lauf = (ziel: string, extra: Partial<Lauf> = {}): Lauf => ({
  nr: 1,
  ziel,
  args: [],
  befehl: { check: 'npm run check', e2e: 'npm run test:e2e', rls: 'npm run test:rls' }[ziel] ?? ziel,
  exit: 0,
  sauber: true,
  stabil: true,
  start: '2026-11-14T10:00:00.000Z',
  abdruck: AB[ziel as keyof typeof AB] ?? null,
  logOk: true,
  ...extra,
})
const ctx = (extra: Partial<FertigKontext> = {}): FertigKontext => ({
  stufe: 'R1',
  sauber: true,
  ffMoeglich: true,
  hooksAktiv: true,
  runs: [lauf('check'), lauf('e2e')],
  abdruck: AB,
  gruen: {},
  neueMigrationen: [],
  freigaben: [],
  abnahme: null,
  neueRlsTests: [],
  berichtStand: 'a1',
  berichtGate: 'bestanden',
  standZeilen: null,
  schrittPruefen: true,
  ...extra,
})
const SHA = 'b'.repeat(64)
const JETZT = Date.parse('2026-11-14T12:00:00.000Z')
const frei = { modell: 'claude-fable-5-2', dateien: [{ sha: SHA, pfad: 'supabase/migrations/1_x.sql' }], urteil: 'frei', hoch: 0 }
const r3 = (extra: Partial<FertigKontext> = {}) =>
  ctx({
    stufe: 'R3',
    runs: [lauf('check'), lauf('e2e'), lauf('rls', { nr: 3 })],
    neueMigrationen: [{ pfad: 'supabase/migrations/1_x.sql', sha256: SHA }],
    dbPushes: [{ start: '2026-11-14T09:00:00.000Z', migrationen: [{ pfad: 'supabase/migrations/1_x.sql', sha256: SHA }] }],
    freigaben: [frei],
    abnahme: { modell: 'claude-fable-5-2', dateien: [{ sha: SHA, pfad: 'scripts/sys/run.mjs' }], urteil: '', hoch: 0 },
    jetzt: JETZT,
    ...extra,
  })

describe('Merge-Gate: pruefeFertig', () => {
  it('grün, wenn alle Pflichtläufe zum Fingerabdruck passen (R1)', () => {
    expect(pruefeFertig(ctx())).toEqual([])
  })
  it('R0 braucht keine Läufe', () => {
    expect(pruefeFertig(ctx({ stufe: 'R0', runs: [] }))).toEqual([])
  })
  it('ohne grünen Lauf blockiert', () => {
    expect(pruefeFertig(ctx({ runs: [] })).join()).toMatch(/check: kein grüner Lauf/)
  })
  it.each<[string, Partial<Lauf>]>([
    ['anderer Fingerabdruck', { abdruck: 'x' }],
    ['EXIT ≠ 0', { exit: 1 }],
    ['Arbeitsbaum nicht sauber', { sauber: false }],
    ['Zusatzargumente', { args: ['-t', 'x'] }],
    ['nicht kanonischer Befehl', { befehl: 'npm run check -- x' }],
    ['Log verändert oder Kopf passt nicht', { logOk: false }],
    ['Baum während des Laufs geändert', { stabil: false }],
  ])('Lauf zählt nicht: %s', (_n, extra) => {
    expect(pruefeFertig(ctx({ runs: [lauf('check', extra), lauf('e2e')] })).join()).toMatch(/check: kein grüner Lauf/)
  })
  it('ein Cmd-Lauf erfüllt keine Suite', () => {
    expect(pruefeFertig(ctx({ runs: [lauf('cmd', { befehl: 'npm run check' }), lauf('e2e')] })).join()).toMatch(/check/)
  })
  it('gruen.json von origin/main übernimmt eine Suite nur bei gleichem Fingerabdruck', () => {
    expect(pruefeFertig(ctx({ runs: [lauf('check')], gruen: { e2e: { abdruck: 'a2' } } }))).toEqual([])
    expect(pruefeFertig(ctx({ runs: [lauf('check')], gruen: { e2e: { abdruck: 'alt' } } })).join()).toMatch(/e2e/)
  })
  it('rls zählt nur, wenn er nach dem letzten db-push startete', () => {
    const c = r3({ dbPushes: [{ start: '2026-11-14T11:00:00.000Z', migrationen: [{ pfad: 'supabase/migrations/1_x.sql', sha256: SHA }] }] })
    expect(pruefeFertig(c).join()).toMatch(/rls: .*nach dem letzten db-push/)
    expect(pruefeFertig(r3())).toEqual([])
  })
  it('neue oder geänderte Migration ohne Marke db-push (Push gescheitert oder umgangen) blockiert', () => {
    expect(pruefeFertig(r3({ dbPushes: [] })).join()).toMatch(/keine Marke db-push/)
    expect(pruefeFertig(r3({ dbPushes: [{ start: '2026-11-14T09:00:00.000Z', migrationen: [{ pfad: 'supabase/migrations/anderer.sql', sha256: SHA }] }] })).join()).toMatch(/keine Marke db-push/)
  })
  it('M16: Marke mit anderem SHA-256 (Datei nach dem Push geändert) oder im alten Format (nur Pfad) zählt nicht', () => {
    const marke = (m: unknown) => r3({ dbPushes: [{ start: '2026-11-14T09:00:00.000Z', migrationen: m as { pfad: string; sha256: string }[] }] })
    expect(pruefeFertig(marke([{ pfad: 'supabase/migrations/1_x.sql', sha256: 'c'.repeat(64) }])).join()).toMatch(/keine Marke db-push für Pfad und SHA256/)
    expect(pruefeFertig(marke(['supabase/migrations/1_x.sql'])).join()).toMatch(/keine Marke db-push/)
    expect(pruefeFertig(marke([{ pfad: 'supabase/migrations/1_x.sql', sha256: SHA }]))).toEqual([])
  })
  describe('Lösch-Gate (zweite Ebene)', () => {
    const SKRIPT = { pfad: 'scripts/storage-reset.mjs', sha256: SHA }
    const lf = { modell: 'claude-fable-5-2', dateien: [{ sha: SHA, pfad: 'scripts/storage-reset.mjs' }], urteil: 'frei', hoch: 0 }
    it('geändertes Registerskript braucht eine Freigabe für den neuen SHA-256', () => {
      expect(pruefeFertig(ctx({ loeschGeaendert: [SKRIPT], loeschFreigaben: [] })).join()).toMatch(/Lösch-Gate: scripts\/storage-reset\.mjs: keine Freigabe/)
      expect(pruefeFertig(ctx({ loeschGeaendert: [SKRIPT], loeschFreigaben: [{ ...lf, dateien: [{ sha: 'c'.repeat(64), pfad: SKRIPT.pfad }] }] })).join()).toMatch(/keine Freigabe/)
      expect(pruefeFertig(ctx({ loeschGeaendert: [SKRIPT], loeschFreigaben: [lf] }))).toEqual([])
    })
    it('Freigabe von einem anderen Modell oder mit Urteil gesperrt blockiert', () => {
      expect(pruefeFertig(ctx({ loeschGeaendert: [SKRIPT], loeschFreigaben: [{ ...lf, modell: 'claude-sonnet-5-5' }] })).join()).toMatch(/nicht von Fable/)
      expect(pruefeFertig(ctx({ loeschGeaendert: [SKRIPT], loeschFreigaben: [lf, { ...lf, urteil: 'gesperrt' }] })).join()).toMatch(/Urteil gesperrt/)
    })
    it('geänderte oder gelöschte Datei in docs/freigaben blockiert, neue nicht', () => {
      expect(pruefeFertig(ctx({ freigabenGeaendert: ['docs/freigaben/u1b-loesch-freigabe-1.md'] })).join()).toMatch(/unveränderlich/)
      expect(pruefeFertig(ctx({ freigabenGeaendert: [] }))).toEqual([])
    })
  })
  it('nicht sauber, kein ff, Hook-Pfad falsch', () => {
    const g = pruefeFertig(ctx({ sauber: false, ffMoeglich: false, hooksAktiv: false })).join('|')
    expect(g).toMatch(/nicht sauber/)
    expect(g).toMatch(/kein ff-Merge/)
    expect(g).toMatch(/hooksPath/)
  })
  it('bericht.json muss zum Code-Stand passen und das Gate als bestanden melden', () => {
    expect(pruefeFertig(ctx({ berichtStand: 'alt' })).join()).toMatch(/bericht\.json/)
    expect(pruefeFertig(ctx({ berichtStand: null })).join()).toMatch(/bericht\.json/)
    expect(pruefeFertig(ctx({ berichtGate: 'blockiert' })).join()).toMatch(/Gate nicht als bestanden/)
    expect(pruefeFertig(ctx({ berichtStand: null, ohneBericht: true }))).toEqual([])
  })
  it('STAND.md über 40 Zeilen blockiert', () => {
    expect(pruefeFertig(ctx({ standZeilen: 41 })).join()).toMatch(/STAND/)
  })

  describe('R3', () => {
    it('grün mit Freigabe, Abnahme und Rot-vor-Grün', () => {
      expect(pruefeFertig(r3({ neueRlsTests: ['tests/rls/n.test.ts'], runs: [lauf('check'), lauf('e2e'), lauf('rls', { nr: 3 }), lauf('tests/rls/n.test.ts', { nr: 1, exit: 1 }), lauf('tests/rls/n.test.ts', { nr: 2 })] }))).toEqual([])
    })
    it('neue Migration ohne passende Freigabe blockiert', () => {
      expect(pruefeFertig(r3({ freigaben: [] })).join()).toMatch(/keine Freigabe/)
      expect(pruefeFertig(r3({ freigaben: [{ ...frei, dateien: [{ sha: 'c'.repeat(64), pfad: 'supabase/migrations/1_x.sql' }] }] })).join()).toMatch(/keine Freigabe/)
    })
    it('Abnahme fehlt, nicht von Fable, mit hohem Fund, veraltet', () => {
      expect(pruefeFertig(r3({ abnahme: null })).join()).toMatch(/Abnahme-Datei fehlt/)
      expect(pruefeFertig(r3({ abnahme: { modell: 'claude-sonnet-5-5', dateien: [{ sha: SHA, pfad: 'a' }], urteil: '', hoch: 0 } })).join()).toMatch(/nicht von Fable/)
      expect(pruefeFertig(r3({ abnahme: { modell: 'claude-fable-5-2', dateien: [{ sha: SHA, pfad: 'a' }], urteil: '', hoch: 1 } })).join()).toMatch(/hoch: 0/)
      expect(pruefeFertig(r3({ abnahmeVeraltet: ['scripts/sys/run.mjs'] })).join()).toMatch(/seit der Abnahme geändert/)
      expect(pruefeFertig(r3({ abnahmeFehlt: ['supabase/functions/quote/index.ts'] })).join()).toMatch(/nicht von der Abnahme genannt/)
    })
    it('neuer rls-Test ohne roten Lauf davor blockiert', () => {
      const c = r3({ neueRlsTests: ['tests/rls/n.test.ts'], runs: [lauf('check'), lauf('e2e'), lauf('rls', { nr: 3 }), lauf('tests/rls/n.test.ts', { nr: 2 })] })
      expect(pruefeFertig(c).join()).toMatch(/kein roter Lauf vor dem ersten grünen/)
    })
    describe('rls: Übernahme und Läufe höchstens 7 Tage alt', () => {
      // Schritt ohne Migration: keine Freigabe und keine Marke nötig, kein db-push
      const ohneMigration = { neueMigrationen: [], freigaben: [], dbPushes: [] }
      const ohneRls = (zeit?: string, abdruck = 'a3', extra: Partial<FertigKontext> = {}) =>
        r3({ ...ohneMigration, runs: [lauf('check'), lauf('e2e')], gruen: { rls: { abdruck, ...(zeit ? { zeit } : {}) } }, ...extra })
      it('sieben Tage alt oder jünger: übernommen', () => {
        expect(pruefeFertig(ohneRls('2026-11-07T12:00:00.000Z'))).toEqual([])
        expect(pruefeFertig(ohneRls('2026-11-14T11:00:00.000Z'))).toEqual([])
      })
      it('älter als sieben Tage, ohne Zeit, unlesbar, in der Zukunft oder ohne jetzt: voller Lauf nötig', () => {
        for (const zeit of ['2026-11-07T11:59:59.000Z', undefined, '2026-11-15T12:00:00.000Z', 'kein Datum']) {
          expect(pruefeFertig(ohneRls(zeit)).join()).toMatch(/rls: .*7 Tage/)
        }
        expect(pruefeFertig(ohneRls('2026-11-14T11:00:00.000Z', 'a3', { jetzt: undefined })).join()).toMatch(/rls: .*7 Tage/)
      })
      it('Übernahme nur nach dem letzten db-push', () => {
        const c = ohneRls('2026-11-14T08:00:00.000Z', 'a3', { dbPushes: [{ start: '2026-11-14T09:00:00.000Z', migrationen: [] }] })
        expect(pruefeFertig(c).join()).toMatch(/rls: .*nach dem letzten db-push/)
      })
      it('anderer Fingerabdruck: wie bisher kein Lauf', () => {
        expect(pruefeFertig(ohneRls('2026-11-14T11:00:00.000Z', 'alt')).join()).toMatch(/rls: kein grüner Lauf/)
      })
      it('ein alter lokaler Lauf (auch aus einem früheren Schritt) ersetzt die Übernahme nicht', () => {
        const alt = lauf('rls', { nr: 3, start: '2026-11-01T10:00:00.000Z' })
        expect(pruefeFertig(r3({ ...ohneMigration, runs: [lauf('check'), lauf('e2e'), alt], gruen: {} })).join()).toMatch(/rls: kein grüner Lauf/)
        expect(pruefeFertig(r3({ ...ohneMigration, runs: [lauf('check'), lauf('e2e'), alt], gruen: { rls: { abdruck: 'a3', zeit: '2026-11-01T10:00:00.000Z' } } })).join()).toMatch(/rls: .*7 Tage/)
      })
      it('ein frischer Lauf zählt, auch wenn gruen.json nichts hat', () => {
        expect(pruefeFertig(r3({ ...ohneMigration, gruen: {} }))).toEqual([])
      })
      it('R2 übernimmt rls ohne Altersgrenze', () => {
        expect(pruefeFertig(ctx({ stufe: 'R2', runs: [lauf('check'), lauf('e2e')], gruen: { rls: { abdruck: 'a3' } }, jetzt: JETZT }))).toEqual([])
      })
    })
    it('gruen.json im Commit: von Hand gesetzter Eintrag blockiert, gleicher oder vom Lauf abgeleiteter nicht', () => {
      const gruenLauf = (schritt: string) => ({ abdruck: 'a1', hash: 'h1', schritt, zeit: '2026-11-14T10:00:00.000Z' })
      const mit = (head: object, runs = [lauf('check', { hash: 'h1', schritt: 'u2b' }), lauf('e2e'), lauf('rls', { nr: 3 })]) => ctx({ stufe: 'R3', runs, gruen: {}, gruenHead: head, neueMigrationen: [], freigaben: [], abnahme: r3().abnahme, jetzt: JETZT } as Partial<FertigKontext>)
      expect(pruefeFertig(mit({ check: gruenLauf('u2b') }))).toEqual([])
      expect(pruefeFertig(mit({ check: { ...gruenLauf('u2b'), zeit: '2026-11-14T11:59:00.000Z' } })).join()).toMatch(/gruen\.json: Eintrag check/)
      expect(pruefeFertig(mit({ rls: { abdruck: 'a3', hash: 'x', schritt: 'u2b', zeit: '2026-11-14T11:00:00.000Z' } })).join()).toMatch(/gruen\.json: Eintrag rls/)
      expect(pruefeFertig(ctx({ stufe: 'R3', runs: [lauf('check'), lauf('e2e'), lauf('rls', { nr: 3 })], gruen: { check: gruenLauf('u1b') }, gruenHead: { check: gruenLauf('u1b') }, neueMigrationen: [], freigaben: [], abnahme: r3().abnahme, jetzt: JETZT } as Partial<FertigKontext>))).toEqual([])
    })
    it('N22: gelöschte Datei der Mindestmenge blockiert, außer die Abnahme nennt sie mit „Geloescht:“', () => {
      expect(pruefeFertig(r3({ geloeschtMuss: ['.githooks/pre-push'] })).join()).toMatch(/\.githooks\/pre-push.*Geloescht/)
      const abnahme = { ...r3().abnahme!, geloescht: ['.githooks/pre-push'] }
      expect(pruefeFertig(r3({ geloeschtMuss: ['.githooks/pre-push'], abnahme }))).toEqual([])
    })
    it('N23: .claude/agents gehört zur Mindestmenge der Abnahme', () => {
      expect(MUSS_ABNAHME.test('.claude/agents/advisor.md')).toBe(true)
      expect(MUSS_ABNAHME.test('.claude/rules/geld.md')).toBe(false)
    })
    it('N25: Kopie oder Log aus bericht.json fehlt im Commit', () => {
      expect(pruefeFertig(r3({ berichtKopienFehlen: ['docs/proof/u2b/037-check.log'] })).join()).toMatch(/docs\/proof\/u2b\/037-check\.log.*nicht im Commit/)
      expect(pruefeFertig(r3({ berichtKopienFehlen: ['docs/proof/u2b/037-check.log'], ohneBericht: true }))).toEqual([])
    })
  })
})
