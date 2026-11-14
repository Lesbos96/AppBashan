// Lösch-Gate: Register der versionierten Skripte, die auf Dev löschen oder Status ändern, Freigabeprüfung (Pfad + SHA-256) und Lauf-Log.
// Freigaben (Bericht des Beraters, Format wie bei der Datenbank) liegen versioniert in docs/freigaben/ und zählen nur aus dem Commit (HEAD).
import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFreigabe, pruefePush } from './gate-db-lib.mjs'
import { git, PROOF_ROOT, schrittName, sha256Datei } from './lib.mjs'

export const REGISTER = 'scripts/sys/loesch-register.json'
export const FREIGABEN = 'docs/freigaben'
// Muster für „löscht oder ändert Daten auf Dev“ oder „hängt an der Dev-Datenbank“. Der Vollständigkeits-Test hält das Register aktuell.
export const LOESCH_MUSTER =
  /delete\s+from|truncate\s+(table\s+)?[\w."]|\.delete\(\s*\)|\)\.remove\(|deleteUser\(|\bupdate\s+[\w."]+\s+set\b|\.update\(|admin_set_\w+|method:\s*['"](POST|PATCH|PUT|DELETE)['"]|dev-guard/i

const norm = (p) => p.replace(/\\/g, '/')
const FREIGABE_DATEI = /(^|[-/])loesch-freigabe-[\w.-]*\.md$/

// { skripte: { pfad: [gebundene Dateien] }, ausgenommen: { pfad: { grund, sha256 } } }
export const leseRegister = (pfad = REGISTER) => JSON.parse(readFileSync(pfad, 'utf8'))

export const freigabenAusDir = (dir = FREIGABEN) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => FREIGABE_DATEI.test(f)).map((f) => parseFreigabe(readFileSync(join(dir, f), 'utf8'))) : []

// Nur Dateien, die im Commit stehen (HEAD): eine Freigabe im Arbeitsbaum ohne Commit zählt nicht.
export function freigabenAusGit(rev = 'HEAD', dir = FREIGABEN) {
  const namen = git('ls-tree', '--name-only', rev, `${dir}/`).split('\n').filter((p) => FREIGABE_DATEI.test(p))
  return namen.map((p) => parseFreigabe(git('show', `${rev}:${p}`)))
}

// pfade: relativ zu wurzel. Fehlt eine Datei, wirft die Funktion (fail-closed).
export function pruefeLoesch(pfade, freigaben, wurzel = '.') {
  return pruefePush(pfade.map((p) => ({ pfad: norm(p), sha256: sha256Datei(join(wurzel, p)) })), freigaben)
}

// Aufräum-Modul (tests/support/sweep.ts): läuft nur im Lauf des Start-Programms (MV_LAUF), steht im Register und hat samt gebundenen Dateien eine Freigabe im Commit.
export function loeschFreigabe(url, { register = REGISTER, freigaben = () => freigabenAusGit() } = {}) {
  if (!process.env.MV_LAUF) throw new Error('LÖSCH-GATE: nur im Lauf des Start-Programms (npm run t), MV_LAUF fehlt')
  const pfad = norm(relative(process.cwd(), url.startsWith('file:') ? fileURLToPath(url) : resolve(url)))
  const bindet = leseRegister(register).skripte[pfad]
  if (!bindet) throw new Error(`LÖSCH-GATE: ${pfad} steht nicht im Register ${register}`)
  const { ok, gruende } = pruefeLoesch([pfad, ...bindet], freigaben())
  if (!ok) throw new Error(`LÖSCH-GATE BLOCKIERT: ${gruende.join('; ')}`)
}

const PROZESS_LAUF = randomUUID()
// Hängt eine Zeile an tmp/proof/<schritt>/loesch-lauf.jsonl: Lauf-ID (vom Gate vorgegeben, sonst je Prozess), Lauf des Start-Programms, Pfad, SHA-256, Zahlen.
export function loeschLog(pfad, zahlen, extra = {}) {
  const ordner = join(PROOF_ROOT, schrittName())
  mkdirSync(ordner, { recursive: true })
  const zeile = {
    laufId: process.env.MV_LOESCH_LAUF || PROZESS_LAUF,
    lauf: process.env.MV_LAUF || null,
    pfad: norm(pfad),
    sha256: sha256Datei(pfad),
    zeit: new Date().toISOString(),
    zahlen,
    ...extra,
  }
  appendFileSync(join(ordner, 'loesch-lauf.jsonl'), JSON.stringify(zeile) + '\n')
}

// Dateien mit Lösch-/Statusmuster: scripts/*.mjs|ts (ohne sys/) und tests/support/*.ts.
export function scanne(wurzel = '.') {
  const treffer = []
  for (const [dir, re] of [['scripts', /\.(mjs|ts)$/], ['tests/support', /\.ts$/]]) {
    for (const f of readdirSync(join(wurzel, dir), { withFileTypes: true })) {
      if (f.isFile() && re.test(f.name) && LOESCH_MUSTER.test(readFileSync(join(wurzel, dir, f.name), 'utf8'))) treffer.push(`${dir}/${f.name}`)
    }
  }
  return treffer.sort()
}
