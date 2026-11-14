// Lösch-Gate. Der festgelegte Befehl, mit dem versionierte Skripte auf Dev löschen oder Status ändern dürfen:
//   npm run loesch -- <skript.mjs> [Argumente]   prüft Register und Fable-Freigabe (Pfad + SHA-256, samt gebundener Dateien, aus dem Commit), startet das Skript,
//                                                 schreibt tmp/proof/<schritt>/loesch-lauf.jsonl (Lauf-ID, Pfad, SHA-256, Argumente, EXIT, Zahlen). Zahlen meldet das Skript
//                                                 mit Zeilen `LOESCH-ZAHL <name>=<ganze Zahl>` auf stdout.
//   npm run loesch -- uebernehme <tmp/proof/…/loesch-freigabe-N.md>   prüft den Bericht des Beraters und kopiert ihn nach docs/freigaben/<schritt>-loesch-freigabe-N.md
// Optionen vor dem Skriptpfad, nur mit --trocken (Attrappe ohne Start): --register <json> --freigaben <ordner>
import { spawn } from 'node:child_process'
import { constants, copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { parseFreigabe } from './gate-db-lib.mjs'
import { FREIGABEN, freigabenAusDir, freigabenAusGit, leseRegister, loeschLog, pruefeLoesch, REGISTER } from './gate-loesch-lib.mjs'
import { schrittName } from './lib.mjs'

const args = process.argv.slice(2)
const norm = (p) => p.replace(/\\/g, '/')
const aus = (code, text) => {
  console.error(text)
  process.exit(code)
}

if (args[0] === 'uebernehme') {
  const quelle = norm(args[1] ?? '')
  if (args.length !== 2 || !/^tmp\/proof\/(?!.*\.\.)(?:[\w.-]+\/)*loesch-freigabe-[\w.-]+\.md$/.test(quelle)) aus(2, 'Aufruf: gate-loesch.mjs uebernehme tmp/proof/<ordner>/loesch-freigabe-N.md')
  const f = parseFreigabe(readFileSync(quelle, 'utf8'))
  const register = leseRegister()
  const bekannt = new Set(Object.entries(register.skripte).flatMap(([p, bindet]) => [p, ...bindet]))
  const gruende = []
  if (f.dateien.length === 0) gruende.push('keine SHA256-Zeile')
  for (const d of f.dateien) if (!bekannt.has(d.pfad)) gruende.push(`${d.pfad}: nicht im Register ${REGISTER}`)
  if (!gruende.length) gruende.push(...pruefeLoesch(f.dateien.map((d) => d.pfad), [f]).gruende)
  if (gruende.length) aus(1, `LÖSCH-GATE BLOCKIERT (uebernehme):\n- ${gruende.join('\n- ')}`)
  mkdirSync(FREIGABEN, { recursive: true })
  const ziel = join(FREIGABEN, `${schrittName()}-${quelle.split('/').pop()}`)
  copyFileSync(quelle, ziel, constants.COPYFILE_EXCL) // nie überschreiben
  console.log(`LÖSCH-GATE: Freigabe übernommen: ${ziel} (${f.dateien.length} Datei(en)); noch committen, sie zählt nur aus dem Commit`)
  process.exit(0)
}

const opt = {}
let trocken = false
while (args[0]?.startsWith('--')) {
  const o = args.shift()
  if (o === '--trocken') trocken = true
  else if (o === '--register' || o === '--freigaben') opt[o] = args.shift()
  else aus(2, `Unbekannte Option ${o}`)
}
if ((opt['--register'] || opt['--freigaben']) && !trocken) aus(2, '--register und --freigaben gibt es nur mit --trocken')
if (trocken && !(opt['--register'] && opt['--freigaben'])) aus(2, '--trocken braucht --register und --freigaben')
const skript = norm(args.shift() ?? '')
if (!/^[\w./-]+\.mjs$/.test(skript) || skript.includes('..')) aus(2, 'Aufruf: npm run loesch -- <skript.mjs> [Argumente]   |   uebernehme <freigabe.md>')

const bindet = leseRegister(opt['--register'] ?? REGISTER).skripte[skript]
if (!bindet) aus(1, `LÖSCH-GATE BLOCKIERT: ${skript} steht nicht im Register (oder ist ein Modul, das sich selbst prüft)`)
const { ok, gruende } = pruefeLoesch([skript, ...bindet], trocken ? freigabenAusDir(opt['--freigaben']) : freigabenAusGit())
if (!ok) aus(1, `LÖSCH-GATE BLOCKIERT:\n- ${gruende.join('\n- ')}`)
if (trocken) {
  console.log(`LÖSCH-GATE: würde durchlassen (${skript}, Trockenlauf, nichts gestartet)`)
  process.exit(0)
}

await import('../dev-guard.mjs') // bricht ab, wenn die Ref nicht die Dev-Ref ist (nicht jedes Registerskript lädt ihn selbst)
const laufId = randomUUID()
const start = Date.now()
console.log(`LÖSCH-GATE: frei, Lauf ${laufId}`)
const kind = spawn(process.execPath, [skript, ...args], { stdio: ['inherit', 'pipe', 'inherit'], env: { ...process.env, MV_LOESCH_LAUF: laufId } })
let ausgabe = ''
kind.stdout.on('data', (b) => {
  process.stdout.write(b)
  ausgabe += b
})
const exit = await new Promise((resolve) => {
  kind.on('error', () => resolve(127))
  kind.on('close', (c) => resolve(c ?? 1))
})
const zahlen = {}
for (const m of ausgabe.matchAll(/^LOESCH-ZAHL (\w+)=(-?\d+)\s*$/gm)) zahlen[m[1]] = Number(m[2])
loeschLog(skript, zahlen, { laufId, args, exit, sek: Math.round((Date.now() - start) / 100) / 10 })
console.log(`LÖSCH-GATE: Lauf ${laufId} EXIT=${exit} Zahlen ${JSON.stringify(zahlen)}`)
process.exit(exit)
