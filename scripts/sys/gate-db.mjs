// Datenbank-Gate. `antrag`: schreibt die Hashes der noch nicht auf Dev liegenden Migrationen.
// `push`: lässt nur durch, wenn zu jeder offenen Migration eine Fable-Freigabe mit gleichem Pfad und SHA-256 vorliegt (fail-closed), startet danach selbst
// `supabase db push`, liest die Liste neu und schreibt je tatsächlich angewendeter Migration die Marke `db-push` { pfad, sha256 } in runs.jsonl (auch nach einem
// teilweisen Push). Weicht der Inhalt einer Datei nach dem Push vom freigegebenen SHA-256 ab, gibt es für sie keine Marke.
// `--trocken --liste <json> --dir <ordner> --freigaben <ordner>`: Attrappe ohne Datenbank, nur die Prüfung. Diese Optionen gibt es nur mit --trocken.
import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { marken, offeneMigrationen, parseFreigabe, pruefePush } from './gate-db-lib.mjs'
import { PROOF_ROOT, schrittName, sha256Datei } from './lib.mjs'

const [modus, ...rest] = process.argv.slice(2)
const trocken = rest.includes('--trocken')
const opt = (name) => {
  const i = rest.indexOf(name)
  return i === -1 ? undefined : rest[i + 1]
}
const OPTIONEN = ['--liste', '--dir', '--freigaben']
const attrappe = OPTIONEN.some((o) => rest.includes(o))
const ungueltig = !['antrag', 'push'].includes(modus ?? '') || (attrappe && !trocken) || (trocken && !OPTIONEN.every((o) => opt(o)))
if (ungueltig) {
  console.error('Aufruf: gate-db.mjs antrag|push   (Attrappe nur mit: antrag|push --trocken --liste <json> --dir <ordner> --freigaben <ordner>)')
  process.exit(2)
}

function fehler(text) {
  console.error(`GATE-DB BLOCKIERT:\n- ${text}`)
  process.exit(1)
}

const SUPABASE = 'node_modules/supabase/dist/supabase.js'
function liesListe() {
  const aus = execFileSync(process.execPath, [SUPABASE, 'migration', 'list', '--linked', '--output-format', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  return JSON.parse(aus.slice(Math.max(0, aus.search(/[{[]/)))) // ein eventueller Vorspann vor der Klammer wird abgeschnitten
}

let offen
try {
  let liste
  if (trocken) {
    liste = JSON.parse(readFileSync(opt('--liste'), 'utf8'))
  } else {
    await import('../dev-guard.mjs') // bricht ab, wenn die Ref nicht die Dev-Ref ist
    liste = liesListe()
  }
  offen = offeneMigrationen(liste, trocken ? opt('--dir') : 'supabase/migrations')
} catch (e) {
  fehler(`Migrationsliste nicht lesbar oder unvollständig (${e.message.split('\n')[0]}). Ohne verlässliche Liste kein Push.`)
}
const ordner = trocken ? opt('--freigaben') : join(PROOF_ROOT, schrittName())

if (modus === 'antrag') {
  mkdirSync(ordner, { recursive: true })
  let n = 1
  while (existsSync(join(ordner, `db-antrag-${n}.json`))) n++
  const datei = join(ordner, `db-antrag-${n}.json`)
  writeFileSync(datei, JSON.stringify(offen.map(({ pfad, sha256 }) => ({ datei: pfad, sha256 })), null, 2) + '\n', { flag: 'wx' })
  console.log(`Antrag: ${datei} (${offen.length} offene Migration(en))`)
  process.exit(0)
}

const freigaben = existsSync(ordner)
  ? readdirSync(ordner)
      .filter((f) => /^db-freigabe-.*\.md$/.test(f))
      .map((f) => parseFreigabe(readFileSync(join(ordner, f), 'utf8')))
  : []
const { ok, gruende } = pruefePush(offen, freigaben)
if (!ok) fehler(gruende.join('\n- '))
if (trocken) {
  console.log(`GATE-DB: würde durchlassen (${offen.length} offene Migration(en), Trockenlauf, kein Push)`)
  process.exit(0)
}

console.log(`GATE-DB: frei (${offen.length} offene Migration(en)), starte supabase db push`)
const cli = spawnSync(process.execPath, [SUPABASE, 'db', 'push', '--linked', '--yes'], { stdio: 'inherit' })
let m
try {
  m = marken(offen, offeneMigrationen(liesListe(), 'supabase/migrations'), sha256Datei)
} catch (e) {
  fehler(`Liste nach dem Push nicht lesbar (${e.message.split('\n')[0]}), keine Marke. Danach \`npm run db:antrag\` und Stand prüfen.`)
}
mkdirSync(ordner, { recursive: true })
if (m.marken.length) appendFileSync(join(ordner, 'runs.jsonl'), JSON.stringify({ ziel: 'db-push', start: new Date().toISOString(), migrationen: m.marken }) + '\n')
console.log(`GATE-DB: ${m.marken.length} Marke(n) db-push geschrieben, CLI-Exit ${cli.status}`)
if (m.gruende.length) fehler(m.gruende.join('\n- '))
process.exit(cli.status ?? 1)
