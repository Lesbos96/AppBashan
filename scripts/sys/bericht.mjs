// `npm run bericht`: Bericht aus Maschinenquellen (git, runs.jsonl, Freigaben, Abnahme, Hook-Protokoll) nach docs/proof/<schritt>/.
// Kopiert die Logs der gültigen Suite-Läufe byte-genau (nur neu anlegen), lässt danach `npm run scan:proof` laufen und aktualisiert docs/proof/gruen.json.
import { execFileSync } from 'node:child_process'
import { constants, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gueltigerLauf, pruefeFertig, sammle } from './fertig.mjs'
import { SUITEN } from './fingerabdruck.mjs'
import { git, hooksAktiv, PROOF_ROOT, schrittName, sha256Datei } from './lib.mjs'

const schritt = schrittName()
const c = sammle({ von: 'origin/main', schritt, schrittPruefen: false })
c.hooksAktiv = hooksAktiv()
const gruende = pruefeFertig(c)
const ziel = join('docs', 'proof', schritt)
mkdirSync(ziel, { recursive: true })

function kopiere(quelle) {
  const z = join(ziel, quelle.split(/[\\/]/).pop())
  if (existsSync(z) && sha256Datei(z) !== sha256Datei(quelle)) throw new Error(`${z} existiert mit anderem Inhalt (Nachweise werden nie überschrieben)`)
  if (!existsSync(z)) copyFileSync(quelle, z, constants.COPYFILE_EXCL)
  return z
}

const lesen = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null)
const session = lesen(join(PROOF_ROOT, 'session.json'))
const agents = existsSync(join(PROOF_ROOT, 'agents.jsonl')) ? readFileSync(join(PROOF_ROOT, 'agents.jsonl'), 'utf8').split('\n').filter(Boolean).map((z) => JSON.parse(z)) : []
const berater = {}
for (const a of agents.filter((x) => x.ereignis === 'SubagentStart')) berater[a.agent_type] = (berater[a.agent_type] ?? 0) + 1

const laeufe = {}
const gruenNeu = lesen('docs/proof/gruen.json') ?? {}
for (const s of SUITEN) {
  const r = gueltigerLauf(c, s)
  if (r) {
    const marke = String(r.ziel)
    const log = kopiere(join(PROOF_ROOT, r.schritt, `${String(r.nr).padStart(3, '0')}-${marke}.log`))
    laeufe[s] = { nr: r.nr, exit: r.exit, tests: r.tests, sek: r.sek, hash: r.hash, log }
    gruenNeu[s] = { abdruck: c.abdruck[s], hash: r.hash, schritt: r.schritt }
  } else if (c.gruen?.[s]?.abdruck === c.abdruck[s]) laeufe[s] = { uebernommen: c.gruen[s].hash }
  else laeufe[s] = null
}
const kopien = []
const abnahmePfad = join(PROOF_ROOT, `${schritt}-abnahme.md`)
if (existsSync(abnahmePfad)) kopien.push(kopiere(abnahmePfad))
const ordner = join(PROOF_ROOT, schritt)
for (const f of existsSync(ordner) ? readdirSync(ordner).filter((x) => /^db-(freigabe|antrag)-/.test(x)) : []) kopien.push(kopiere(join(ordner, f)))

const rot = c.runs.filter((r) => r.schritt === schritt && r.exit !== 0).length
const geaendert = {}
for (const p of git('diff', '--no-renames', '--name-only', 'origin/main...HEAD').split('\n').filter(Boolean)) {
  const k = /^(supabase\/migrations|supabase\/functions|src|tests\/rls|tests\/unit|tests\/e2e|scripts|\.claude|docs)\//.exec(p)?.[1] ?? 'andere'
  geaendert[k] = (geaendert[k] ?? 0) + 1
}
const json = {
  schritt,
  stufe: c.stufe,
  gate: gruende.length === 0 ? 'bestanden' : 'blockiert',
  gruende,
  modell: session?.modell ?? 'unbekannt',
  berater,
  hash: git('rev-parse', 'HEAD'),
  stand: c.abdruck.check,
  mainVorher: git('merge-base', 'origin/main', 'HEAD'),
  commits: Number(git('rev-list', '--count', 'origin/main..HEAD')),
  geaendert,
  laeufe,
  versuche: { gesamt: c.runs.filter((r) => r.schritt === schritt).length, rot },
  migrationen: c.neueMigrationen.map((m) => ({ pfad: m.pfad, sha256: m.sha256 })),
  abnahme: c.abnahme ? { datei: abnahmePfad, hoch: c.abnahme.hoch, modell: c.abnahme.modell } : null,
  kopien,
}
writeFileSync(join(ziel, 'bericht.json'), JSON.stringify(json, null, 2) + '\n')
const zeile = (s) => {
  const l = laeufe[s]
  return l === null ? `  ${s}  FEHLT` : l.uebernommen ? `  ${s}  übernommen von ${l.uebernommen.slice(0, 7)} (Fingerabdruck gleich)` : `  ${s}  EXIT=${l.exit}  ${l.tests ?? '?'}  ${l.sek} s  → ${l.log}`
}
writeFileSync(
  join(ziel, 'bericht.md'),
  [
    `Schritt ${schritt} · Stufe ${c.stufe} (aus Pfaden) · Gate: ${json.gate}`,
    ...gruende.map((g) => `  OFFEN: ${g}`),
    `Modell: ${json.modell} (Hook) · Berater: ${Object.entries(berater).map(([k, v]) => `${k} ${v}×`).join(', ') || 'keine protokolliert'}`,
    `Code-Stand: ${json.hash.slice(0, 7)} · main vorher: ${json.mainVorher.slice(0, 7)} · Commits: ${json.commits}`,
    `Geändert: ${Object.entries(geaendert).map(([k, v]) => `${k} ${v}`).join(' · ')}`,
    '',
    'Läufe auf dem Endstand',
    ...SUITEN.map(zeile),
    `  Versuche gesamt: ${json.versuche.gesamt}, davon rot ${rot} (bleiben in tmp/)`,
    '',
    `Datenbank: ${json.migrationen.length} neue Migration(en)${json.migrationen.map((m) => `\n  ${m.pfad} SHA256 ${m.sha256.slice(0, 8)}…`).join('')}`,
    `Abnahme: ${json.abnahme ? `${json.abnahme.datei} · Offene Findings hoch: ${json.abnahme.hoch}` : 'keine'}`,
    '',
  ].join('\n'),
)
writeFileSync('docs/proof/gruen.json', JSON.stringify(gruenNeu, null, 2) + '\n')
console.log(readFileSync(join(ziel, 'bericht.md'), 'utf8'))
if (!process.env.npm_execpath) throw new Error('Aufruf nur über `npm run bericht`')
execFileSync(process.execPath, [process.env.npm_execpath, 'run', 'scan:proof'], { stdio: 'inherit' })
process.exit(gruende.length === 0 ? 0 : 1)
