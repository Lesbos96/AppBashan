// Abnahme-Runden: jede Runde ist eine eigene Datei <root>/<schritt>-abnahme-<n>.md (n ab 1, nichts wird überschrieben). Es zählt die höchste Runde.
// Blockierende Gründe: Datei mit anderem Namen (alles, was mit „<schritt>-abnahme“ beginnt und auf .md endet, auch in anderer Schreibweise), Nummern nicht lückenlos ab 1,
// Kopfzeile „Vorgaenger:“ (Runde 1: keiner, Runde n: tmp/proof/<schritt>-abnahme-<n-1>.md) fehlt, ist doppelt oder zeigt auf eine andere Datei.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseFreigabe } from './gate-db-lib.mjs'

export function leseAbnahme(root, schritt) {
  const praefix = `${schritt}-abnahme` // nie als RegExp: der Schrittname kann Sonderzeichen enthalten
  const gruende = []
  const runden = new Map() // Nummer -> Dateiname
  for (const f of existsSync(root) ? readdirSync(root).sort() : []) {
    if (!f.toLowerCase().startsWith(praefix.toLowerCase()) || !f.toLowerCase().endsWith('.md')) continue
    const n = f.startsWith(praefix) ? /^-([1-9]\d*)\.md$/.exec(f.slice(praefix.length))?.[1] : undefined
    if (n) runden.set(Number(n), f)
    else gruende.push(`${f}: ungültiger Name einer Abnahme (erwartet ${schritt}-abnahme-<n>.md mit n ab 1, ohne führende Null; jede Runde eine neue Datei)`)
  }
  const nummern = [...runden.keys()].sort((a, b) => a - b)
  if (nummern.some((n, i) => n !== i + 1)) gruende.push(`Abnahme-Runden nicht lückenlos ab 1 (vorhanden: ${nummern.join(', ')})`)
  for (const n of nummern) {
    const zeilen = readFileSync(join(root, runden.get(n)), 'utf8').split(/\r?\n/).map((z) => z.trim()).filter((z) => z.startsWith('Vorgaenger:'))
    const soll = n === 1 ? 'keiner' : `tmp/proof/${schritt}-abnahme-${n - 1}.md`
    if (zeilen.length !== 1 || zeilen[0].slice('Vorgaenger:'.length).trim().replace(/\\/g, '/') !== soll) gruende.push(`${runden.get(n)}: genau eine Zeile „Vorgaenger: ${soll}“ erwartet`)
  }
  if (nummern.length === 0) return { abnahme: null, runde: null, name: null, gruende }
  const hoechste = nummern.at(-1)
  const name = runden.get(hoechste)
  return { abnahme: parseFreigabe(readFileSync(join(root, name), 'utf8')), runde: hoechste, name, gruende }
}
