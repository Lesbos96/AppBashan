// Datenbank-Gate. `antrag`: schreibt die Hashes der noch nicht auf Dev liegenden Migrationen.
// `push`: lässt nur durch, wenn zu jeder offenen Migration eine Fable-Freigabe mit gleichem Pfad und SHA-256 vorliegt (fail-closed).
// `--trocken --liste <json> --dir <ordner> --freigaben <ordner>`: Attrappe ohne Datenbank, nur die Prüfung. Diese Optionen gibt es nur mit --trocken.
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { offeneMigrationen, parseFreigabe, pruefePush } from './gate-db-lib.mjs'
import { PROOF_ROOT, schrittName } from './lib.mjs'

const [modus, ...rest] = process.argv.slice(2)
const trocken = rest.includes('--trocken')
const opt = (name) => rest[rest.indexOf(name) + 1]
const attrappe = ['--liste', '--dir', '--freigaben'].some((o) => rest.includes(o))
if ((modus !== 'antrag' && modus !== 'push') || (attrappe && !trocken) || (trocken && !['--liste', '--dir', '--freigaben'].every((o) => opt(o)))) {
  console.error('Aufruf: gate-db.mjs antrag|push   (Attrappe nur mit: --trocken --liste <json> --dir <ordner> --freigaben <ordner>)')
  process.exit(2)
}

function fehler(text) {
  console.error(`GATE-DB BLOCKIERT:\n- ${text}`)
  process.exit(1)
}

let offen
try {
  let liste
  if (trocken) {
    liste = JSON.parse(readFileSync(opt('--liste'), 'utf8'))
  } else {
    await import('../dev-guard.mjs') // bricht ab, wenn die Ref nicht die Dev-Ref ist
    liste = JSON.parse(
      execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'migration', 'list', '--linked', '-o', 'json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    )
  }
  offen = offeneMigrationen(liste, trocken ? opt('--dir') : 'supabase/migrations')
} catch (e) {
  fehler(`Migrationsliste nicht lesbar (${e.message.split('\n')[0]}). Ohne verlässliche Liste kein Push.`)
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
if (!trocken && offen.length > 0) {
  // Marke: ein rls-Lauf muss nach dem Push liegen, sonst gilt er gegen das alte Schema.
  mkdirSync(ordner, { recursive: true })
  appendFileSync(join(ordner, 'runs.jsonl'), JSON.stringify({ ziel: 'db-push', start: new Date().toISOString(), migrationen: offen.map((m) => m.pfad) }) + '\n')
}
console.log(trocken ? `GATE-DB: würde durchlassen (${offen.length} offene Migration(en), Trockenlauf, kein Push)` : `GATE-DB: frei (${offen.length} offene Migration(en))`)
