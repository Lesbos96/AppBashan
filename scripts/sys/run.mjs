// Test-Startprogramm: `npm run t -- <ziel> [args]`. Jeder Lauf schreibt sein Log selbst, nur neu anlegen (Flag wx), mit dem echten Exit-Code des Kindprozesses.
// Ziele: check, e2e, rls, shots, build, eine Testdatei (tests/unit|rls/*.test.ts, *.spec.ts) oder `cmd <programm> <args…>` (ohne Shell, für Proben).
import { spawn } from 'node:child_process'
import { appendFileSync, closeSync, mkdirSync, openSync, readdirSync, readFileSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import { fingerabdruck, SUITEN } from './fingerabdruck.mjs'
import { git, runRoot, sauber, schrittName, sha256Datei } from './lib.mjs'

const [ziel = '', ...extra] = process.argv.slice(2)
const npmZiele = { check: ['run', 'check'], e2e: ['run', 'test:e2e'], rls: ['run', 'test:rls'], shots: ['run', 'shots'], build: ['run', 'build'] }

function befehlFuer() {
  const datei = ziel.replace(/\\/g, '/')
  let npmArgs
  if (npmZiele[ziel]) npmArgs = [...npmZiele[ziel], ...(extra.length ? ['--', ...extra] : [])]
  else if (/^tests\/unit\/.+\.test\.ts$/.test(datei)) npmArgs = ['test', '--', datei, ...extra]
  else if (/^tests\/rls\/.+\.test\.ts$/.test(datei)) npmArgs = ['run', 'test:rls', '--', datei, ...extra]
  else if (/^tests\/(e2e|shots)\/.+\.spec\.ts$/.test(datei)) npmArgs = ['run', 'test:e2e', '--', datei, ...extra]
  if (npmArgs) {
    const npm = process.env.npm_execpath
    if (!npm) throw new Error('Aufruf nur über `npm run t -- <ziel>` (npm_execpath fehlt)')
    return { prog: process.execPath, args: [npm, ...npmArgs], anzeige: `npm ${npmArgs.join(' ')}` }
  }
  // cmd nur für Skripte aus scripts/sys (Proben); sonst wäre es eine Hintertür am Guard vorbei. Erfüllt nie eine Pflichtsuite.
  if (ziel === 'cmd' && extra[0] === 'node' && /^scripts\/sys\/[\w./-]+\.mjs$/.test(extra[1] ?? '') && !extra[1].includes('..')) {
    return { prog: process.execPath, args: extra.slice(1), anzeige: extra.join(' ') }
  }
  throw new Error(`Unbekanntes Ziel "${ziel}". Erlaubt: ${Object.keys(npmZiele).join(', ')}, Testdatei, cmd node scripts/sys/<datei>.mjs [args]`)
}

let befehl
try {
  befehl = befehlFuer()
} catch (e) {
  console.error(e.message)
  process.exit(2)
}

const ordner = join(runRoot(), schrittName())
mkdirSync(ordner, { recursive: true })
const marke = ziel === 'cmd' ? 'cmd' : ziel.replace(/[\\/]/g, '_')
let nr = readdirSync(ordner).reduce((m, f) => Math.max(m, Number(/^(\d{3})-/.exec(f)?.[1] ?? 0)), 0) + 1
let logPfad
let fd
for (;;) {
  logPfad = join(ordner, `${String(nr).padStart(3, '0')}-${marke}.log`)
  try {
    fd = openSync(logPfad, 'wx') // nur neu anlegen: Überschreiben ist technisch ausgeschlossen
    break
  } catch (e) {
    if (e.code !== 'EEXIST') throw e
    nr++
  }
}

const abdruckVor = SUITEN.includes(ziel) ? fingerabdruck(ziel) : null
const hash = git('rev-parse', 'HEAD')
const saubervor = sauber()
const start = Date.now()
writeSync(fd, `Commit: ${hash}\nArbeitsbaum sauber: ${saubervor ? 'ja' : 'nein'}\nBefehl: ${befehl.anzeige}\nStart: ${new Date(start).toISOString()}\n---\n`)
const kopfEnde = readFileSync(logPfad).length

const kind = spawn(befehl.prog, befehl.args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
kind.stdout.on('data', (b) => writeSync(fd, b))
kind.stderr.on('data', (b) => writeSync(fd, b))
const code = await new Promise((resolve) => {
  kind.on('error', (e) => {
    writeSync(fd, `Start fehlgeschlagen: ${e.message}\n`)
    resolve(127)
  })
  kind.on('close', (c) => resolve(c ?? 1))
})
const sek = Math.round((Date.now() - start) / 100) / 10
writeSync(fd, `\n---\nDauer: ${sek} s\nEXIT=${code}\n`)
closeSync(fd)

const log = readFileSync(logPfad, 'utf8')
const tests = (/^\s*Tests\s+(.+)$/m.exec(log) ?? /^\s*(\d+ passed.*)$/m.exec(log))?.[1]?.trim() ?? null
const stabil = hash === git('rev-parse', 'HEAD') && saubervor === sauber() && (abdruckVor === null || abdruckVor === fingerabdruck(ziel))
appendFileSync(
  join(ordner, 'runs.jsonl'),
  JSON.stringify({ nr, ziel, args: extra, befehl: befehl.anzeige, hash, sauber: saubervor, stabil, start: new Date(start).toISOString(), exit: code, sek, tests, logSha: sha256Datei(logPfad), abdruck: abdruckVor }) + '\n',
)

const zeilen = log.slice(kopfEnde).split(/\r?\n/)
const fehler = zeilen.slice(0, -30).filter((z) => /\b(error|fail(ed|ing)?|exception|fatal)\b/i.test(z)).slice(-20)
console.log([...fehler, ...zeilen.slice(-30), `Log: ${logPfad}`, `EXIT=${code}`].join('\n'))
process.exit(code)
