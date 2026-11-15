// Datenbank-Gate. `antrag`: schreibt die Hashes der noch nicht auf Dev liegenden Migrationen.
// `push`: lässt nur durch, wenn zu jeder offenen Migration eine Fable-Freigabe mit gleichem Pfad und SHA-256 vorliegt (fail-closed), schreibt die Startmarke `db-push-start`,
// startet danach selbst `supabase db push`, liest die Liste neu (bis zu dreimal) und schreibt je tatsächlich angewendeter Migration die Marke `db-push` { pfad, sha256 } in runs.jsonl
// (auch nach einem teilweisen Push). Weicht der Inhalt einer Datei nach dem Push vom freigegebenen SHA-256 ab, gibt es für sie keine Marke.
// `nachtrag` (AM5): holt fehlende Marken aus den Startmarken nach, wenn der Push gelang, die Marken aber nicht geschrieben wurden (gleiche Prüfung: Liste, SHA-256).
// `--trocken --liste <json> --dir <ordner> --freigaben <ordner>`: Attrappe ohne Datenbank, nur die Prüfung (`antrag` und `nachtrag` schreiben in den Ordner `--freigaben`,
// der nie unter tmp/proof liegen darf: Exit 2). Diese Optionen gibt es nur mit --trocken.
import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { marken, nachtragMarken, offeneMigrationen, parseFreigabe, pruefePush, startMarke, unmarkierteStarts } from './gate-db-lib.mjs'
import { PROOF_ROOT, schrittName, sha256Datei } from './lib.mjs'

const [modus, ...rest] = process.argv.slice(2)
const trocken = rest.includes('--trocken')
const opt = (name) => {
  const i = rest.indexOf(name)
  return i === -1 ? undefined : rest[i + 1]
}
const OPTIONEN = ['--liste', '--dir', '--freigaben']
const attrappe = OPTIONEN.some((o) => rest.includes(o))
const ungueltig = !['antrag', 'push', 'nachtrag'].includes(modus ?? '') || (attrappe && !trocken) || (trocken && !OPTIONEN.every((o) => opt(o)))
if (ungueltig) {
  console.error('Aufruf: gate-db.mjs antrag|push|nachtrag   (Attrappe nur mit: antrag|push|nachtrag --trocken --liste <json> --dir <ordner> --freigaben <ordner>)')
  process.exit(2)
}

// Die Attrappe schreibt (antrag, nachtrag) nur in einen Ordner außerhalb des echten Nachweisordners: sonst entstünde aus einer handgeschriebenen Liste eine echte Marke `db-push`,
// die `fertig` aus tmp/proof liest. Vergleich aufgelöst und ohne Groß/Klein wie im Guard.
const klein = (p) => resolve(p).replace(/\\/g, '/').toLowerCase()
if (trocken && opt('--freigaben') && (klein(opt('--freigaben')) + '/').startsWith(klein(PROOF_ROOT) + '/')) {
  console.error('Aufruf: --freigaben der Attrappe darf nicht unter tmp/proof liegen (dort liest fertig die echten Marken).')
  process.exit(2)
}

function fehler(text) {
  console.error(`GATE-DB BLOCKIERT:\n- ${text}`)
  process.exit(1)
}

const SUPABASE = 'node_modules/supabase/dist/supabase.js'
function liesListe() {
  const aus = execFileSync(process.execPath, [SUPABASE, 'migration', 'list', '--linked', '--output-format', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000 })
  return JSON.parse(aus.slice(Math.max(0, aus.search(/[{[]/)))) // ein eventueller Vorspann vor der Klammer wird abgeschnitten
}

let offen
let liste
try {
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

const runsDatei = join(ordner, 'runs.jsonl')
const schreibeMarken = (marken, extra = {}) => {
  mkdirSync(ordner, { recursive: true })
  if (marken.length) appendFileSync(runsDatei, JSON.stringify({ ziel: 'db-push', start: new Date().toISOString(), ...extra, migrationen: marken }) + '\n')
}

if (modus === 'nachtrag') {
  // AM5: Push gelungen, Marken fehlen (Liste danach nicht lesbar, Absturz): aus den Startmarken ohne Marke nachtragen. Die Nachtragsmarke trägt als `start` den Zeitpunkt des Nachtrags
  // (ein rls-Lauf muss danach laufen) und verweist auf die Startmarken.
  const zeilen = existsSync(runsDatei) ? readFileSync(runsDatei, 'utf8').split('\n').filter(Boolean).flatMap((z) => { try { return [JSON.parse(z)] } catch { return [] } }) : []
  const vorher = unmarkierteStarts(zeilen)
  if (vorher.length === 0) {
    console.log('GATE-DB nachtrag: keine Startmarke ohne Marke')
    process.exit(0)
  }
  const n = nachtragMarken(vorher, liste, sha256Datei)
  schreibeMarken(n.marken.map(({ pfad, sha256 }) => ({ pfad, sha256 })), { nachtrag: true, startmarke: [...new Set(n.marken.map((x) => x.start))] })
  console.log(`GATE-DB nachtrag: ${n.marken.length} Marke(n) db-push geschrieben, ${n.offen.length} noch nicht angewendet`)
  if (n.gruende.length) fehler(n.gruende.join('\n- '))
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
mkdirSync(ordner, { recursive: true })
appendFileSync(runsDatei, JSON.stringify(startMarke(offen)) + '\n') // AM5: vor dem CLI-Start, damit `nachtrag` nach einem gelungenen Push ohne Marke weiß, was freigegeben war
const cli = spawnSync(process.execPath, [SUPABASE, 'db', 'push', '--linked', '--yes'], { stdio: 'inherit' })
let m
let letzterFehler = ''
for (let versuch = 1; versuch <= 3 && !m; versuch++) {
  try {
    m = marken(offen, offeneMigrationen(liesListe(), 'supabase/migrations'), sha256Datei)
  } catch (e) {
    letzterFehler = e.message.split('\n')[0]
    if (versuch < 3) await new Promise((r) => setTimeout(r, 3000))
  }
}
if (!m) fehler(`Liste nach dem Push nicht lesbar (${letzterFehler}), keine Marke. Danach \`npm run db:nachtrag\` (holt die Marken aus der Startmarke nach).`)
schreibeMarken(m.marken)
console.log(`GATE-DB: ${m.marken.length} Marke(n) db-push geschrieben, CLI-Exit ${cli.status}`)
if (m.gruende.length) fehler(m.gruende.join('\n- '))
process.exit(cli.status ?? 1)
