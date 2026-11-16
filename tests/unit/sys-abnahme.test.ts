// Abnahme-Runden (u5): jede Runde ist eine eigene Datei tmp/proof/<schritt>-abnahme-<n>.md, die höchste zählt, Lücken und falsche Vorgänger blockieren.
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { leseAbnahme } from '../../scripts/sys/abnahme-lib.mjs'

const SHA = 'a'.repeat(64)
const text = (hoch: number, vorgaenger: string) => `Modell: claude-fable-5-2\nVorgaenger: ${vorgaenger}\nSHA256: ${SHA} scripts/sys/run.mjs\nOffene Findings hoch: ${hoch}\n`
const vor = (n: number) => `tmp/proof/x-abnahme-${n}.md`
function root(dateien: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'abnahme-'))
  for (const [name, inhalt] of Object.entries(dateien)) writeFileSync(join(dir, name), inhalt)
  return dir
}

describe('leseAbnahme', () => {
  it('ohne Datei: keine Abnahme, kein Grund (der Gate meldet „Abnahme fehlt“ selbst)', () => {
    expect(leseAbnahme(root({}), 'x')).toMatchObject({ abnahme: null, gruende: [] })
  })

  it('Runde 1 mit hoch 0 und „Vorgaenger: keiner“ ist gültig', () => {
    const r = leseAbnahme(root({ 'x-abnahme-1.md': text(0, 'keiner') }), 'x')
    expect(r).toMatchObject({ runde: 1, name: 'x-abnahme-1.md', gruende: [] })
    expect(r.abnahme?.hoch).toBe(0)
  })

  it('Runde 1 hoch 1 und Runde 2 hoch 0: blockiert nicht, die höchste Runde zählt (st1: vorher blockierte es)', () => {
    const r = leseAbnahme(root({ 'x-abnahme-1.md': text(1, 'keiner'), 'x-abnahme-2.md': text(0, vor(1)) }), 'x')
    expect(r.gruende).toEqual([])
    expect(r.runde).toBe(2)
    expect(r.abnahme?.hoch).toBe(0)
  })

  it('Runde 1 hoch 0 und Runde 2 hoch 1: die höchste Runde zählt, hoch bleibt 1 (fertig blockiert)', () => {
    const r = leseAbnahme(root({ 'x-abnahme-1.md': text(0, 'keiner'), 'x-abnahme-2.md': text(1, vor(1)) }), 'x')
    expect(r.gruende).toEqual([])
    expect(r.abnahme?.hoch).toBe(1)
  })

  it('fehlende Runde 1 und Lücke in der Nummerierung blockieren', () => {
    expect(leseAbnahme(root({ 'x-abnahme-2.md': text(0, vor(1)) }), 'x').gruende.join()).toMatch(/lückenlos/)
    expect(leseAbnahme(root({ 'x-abnahme-1.md': text(1, 'keiner'), 'x-abnahme-3.md': text(0, vor(2)) }), 'x').gruende.join()).toMatch(/lückenlos/)
  })

  it.each([
    ['Runde 1 mit Vorgänger', { 'x-abnahme-1.md': text(0, vor(0)) }],
    ['Runde 2 ohne Vorgänger („keiner“)', { 'x-abnahme-1.md': text(1, 'keiner'), 'x-abnahme-2.md': text(0, 'keiner') }],
    ['Runde 2 zeigt auf eine andere Datei', { 'x-abnahme-1.md': text(1, 'keiner'), 'x-abnahme-2.md': text(0, 'tmp/proof/y-abnahme-1.md') }],
    ['Runde 3 zeigt auf Runde 1', { 'x-abnahme-1.md': text(1, 'keiner'), 'x-abnahme-2.md': text(1, vor(1)), 'x-abnahme-3.md': text(0, vor(1)) }],
    ['Kopfzeile fehlt', { 'x-abnahme-1.md': 'Modell: claude-fable-5-2\nOffene Findings hoch: 0\n' }],
    ['Kopfzeile doppelt', { 'x-abnahme-1.md': text(0, 'keiner') + 'Vorgaenger: keiner\n' }],
  ])('%s blockiert (Vorgaenger)', (_n, dateien) => {
    expect(leseAbnahme(root(dateien), 'x').gruende.join()).toMatch(/Vorgaenger/)
  })

  it.each(['x-abnahme.md', 'x-abnahme-runde1.md', 'x-abnahme-02.md', 'x-abnahme-0.md', 'X-Abnahme-2.MD', 'x-abnahme-r2.md'])('Datei mit anderem Namen (%s) neben gültiger Runde 1 blockiert', (name) => {
    expect(leseAbnahme(root({ 'x-abnahme-1.md': text(0, 'keiner'), [name]: text(0, vor(1)) }), 'x').gruende.join()).toMatch(/Name/)
  })

  it('Dateien anderer Schritte (anderes Präfix) zählen nicht, ein Schrittname mit Regex-Zeichen bricht nichts', () => {
    expect(leseAbnahme(root({ 'xy-abnahme-1.md': text(1, 'keiner'), 'x-1-abnahme-1.md': text(1, 'keiner') }), 'x')).toMatchObject({ abnahme: null, gruende: [] })
    const dir = root({ 'a.b-abnahme-1.md': text(0, 'keiner'), 'axb-abnahme-1.md': text(1, 'keiner') })
    const r = leseAbnahme(dir, 'a.b')
    expect(r.gruende).toEqual([])
    expect(r.abnahme?.hoch).toBe(0)
  })
})
