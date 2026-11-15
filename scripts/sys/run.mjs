// Test-Startprogramm: `npm run t -- <ziel> [args]`. Jeder Lauf schreibt sein Log selbst, nur neu anlegen (Flag wx), mit dem echten Exit-Code des Kindprozesses.
// Ziele: check, e2e, rls, shots, build, eine Testdatei (tests/unit|rls/*.test.ts, *.spec.ts) oder `cmd <programm> <args…>` (ohne Shell, für Proben).
import { spawn } from 'node:child_process'
import { appendFileSync, closeSync, mkdirSync, openSync, readdirSync, readFileSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import { fingerabdruck, SUITEN } from './fingerabdruck.mjs'
import { git, runRoot, sauber, schrittName, sha256Datei } from './lib.mjs'

const [zielRoh = '', ...extraRoh] = process.argv.slice(2)
const ziel = zielRoh.replace(/\\/g, '/') // Dateipfade normalisiert speichern (Rot-vor-Grün vergleicht Pfade)
const extra = extraRoh[0] === '--' ? extraRoh.slice(1) : extraRoh // `npm run t -- check -- --grep x` ergibt kein doppeltes --
const npmZiele = { check: ['run', 'check'], e2e: ['run', 'test:e2e'], rls: ['run', 'test:rls'], shots: ['run', 'shots'], 'shots:all': ['run', 'shots:all'], build: ['run', 'build'] }
// Skripte, die `cmd` starten darf: Proben-Fixtures, die reinen Prüfungen und nur die Trocken- bzw. Nur-prüfen-Form der Gates (nie ein Merge oder Push ohne Nachfrage).
const CMD_ERLAUBT = [
  (s) => /^scripts\/sys\/fixtures\/[\w.-]+\.mjs$/.test(s[0]),
  (s) => s[0] === 'scripts/sys/stufe.mjs',
  (s) => s[0] === 'scripts/sys/gate-db.mjs' && s.includes('--trocken'),
  (s) => s[0] === 'scripts/sys/gate-loesch.mjs' && s[1] === '--trocken', // Gate-Optionen stehen immer vor dem Skriptpfad, hier also zuerst
  (s) => s[0] === 'scripts/sys/fertig.mjs' && s.includes('--nur-pruefen') && !s.includes('--pre-push'),
]

function befehlFuer() {
  const datei = ziel
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
  // cmd nur mit fester Liste (Proben); sonst wäre es eine Hintertür am Guard vorbei. Erfüllt nie eine Pflichtsuite.
  if (ziel === 'cmd' && extra[0] === 'node' && extra[1] && !extra[1].includes('..') && CMD_ERLAUBT.some((ok) => ok(extra.slice(1)))) {
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
const marke = ziel.replace(/[\\/:]/g, '_')
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
const saubervor = sauber(true)
const start = Date.now()
writeSync(fd, `Commit: ${hash}\nArbeitsbaum sauber: ${saubervor ? 'ja' : 'nein'}\nBefehl: ${befehl.anzeige}\nStart: ${new Date(start).toISOString()}\n---\n`)
const kopfEnde = readFileSync(logPfad).length

// MV_LAUF: Kennung des Laufs; Module mit Lösch-Gate (tests/support/sweep.ts) arbeiten nur in einem Lauf dieses Programms.
const kind = spawn(befehl.prog, befehl.args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, env: { ...process.env, MV_LAUF: `${schrittName()}/${nr}` } })
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
const stabil = hash === git('rev-parse', 'HEAD') && saubervor === sauber(true) && (abdruckVor === null || abdruckVor === fingerabdruck(ziel))
appendFileSync(
  join(ordner, 'runs.jsonl'),
  JSON.stringify({ nr, ziel, args: extra, befehl: befehl.anzeige, hash, sauber: saubervor, stabil, start: new Date(start).toISOString(), exit: code, sek, tests, logSha: sha256Datei(logPfad), abdruck: abdruckVor }) + '\n',
)

const zeilen = log.slice(kopfEnde).split(/\r?\n/)
const fehler = zeilen.slice(0, -30).filter((z) => /\b(error|fail(ed|ing)?|exception|fatal)\b/i.test(z)).slice(-20)
console.log([...fehler, ...zeilen.slice(-30), `Log: ${logPfad}`, `EXIT=${code}`].join('\n'))
process.exit(code)
