// sys1 (u5-3 M2): der Bericht nennt Pfad und SHA-256 der höchsten Abnahme-Runde, und die Kopie kommt aus dem Rückgabewert von kopiere (nicht aus dem Namen).
import { describe, expect, it } from 'vitest'
import { abnahmeBericht } from '../../scripts/sys/bericht-lib.mjs'

const SHA = 'ab'.repeat(32)
const abnahme = { modell: 'claude-fable-5-2', hoch: 0 }

describe('abnahmeBericht', () => {
  it('nennt Quelle, SHA-256, Runde, Kopie und Findings', () => {
    const b = abnahmeBericht({ abnahme, name: 'sys1-abnahme-3.md', runde: 3, kopie: 'docs/proof/sys1/sys1-abnahme-3.md', sha256: SHA })
    expect(b.json).toEqual({ datei: 'docs/proof/sys1/sys1-abnahme-3.md', quelle: 'tmp/proof/sys1-abnahme-3.md', sha256: SHA, runde: 3, hoch: 0, modell: 'claude-fable-5-2' })
    expect(b.zeile).toBe(`Abnahme: tmp/proof/sys1-abnahme-3.md · SHA-256 ${SHA} · Kopie docs/proof/sys1/sys1-abnahme-3.md · Runde 3 · Offene Findings hoch: 0`)
  })
  it('Kopie mit Hash-Suffix im Namen steht so im Bericht (Wert von kopiere, nicht der Name)', () => {
    const b = abnahmeBericht({ abnahme, name: 'sys1-abnahme-2.md', runde: 2, kopie: 'docs/proof/sys1/sys1-abnahme-2-1a2b3c4d.md', sha256: SHA })
    expect(b.json.datei).toBe('docs/proof/sys1/sys1-abnahme-2-1a2b3c4d.md')
    expect(b.json.quelle).toBe('tmp/proof/sys1-abnahme-2.md')
  })
  it('ohne Abnahme: null und „keine“', () => {
    expect(abnahmeBericht({ abnahme: null, name: null, runde: null, kopie: null, sha256: null })).toEqual({ json: null, zeile: 'Abnahme: keine' })
  })
})
