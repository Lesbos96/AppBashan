// Gemeinsame Helfer der Arbeitssystem-Skripte (scripts/sys). Nur Node-Standardbibliothek.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Fester Nachweisordner. Nur run.mjs und session.mjs dürfen ihn für Tests per Umgebung umlenken (runRoot);
// Gates (fertig, gate-db, bericht) lesen immer diesen Ordner.
export const PROOF_ROOT = 'tmp/proof'
export const runRoot = () => process.env.PROOF_ROOT ?? PROOF_ROOT

export function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

export const schrittName = () => git('branch', '--show-current').replace(/[\\/]/g, '-') || 'detached'

// Sauber: keine Änderung an verfolgten Dateien und keine unverfolgten Dateien außerhalb von docs/.
// Unverfolgte Dateien unter docs/ beeinflussen keine Suite und zählen nicht.
export function sauber() {
  const zeilen = git('status', '--porcelain').split('\n').filter(Boolean)
  return zeilen.every((z) => z.startsWith('?? docs/'))
}

// Der pre-push-Hook ist nur wirksam, wenn Git ihn findet (`npm run prepare` setzt es, läuft sonst nur bei `npm install`).
export const hooksAktiv = () => {
  try {
    return git('config', 'core.hooksPath') === '.githooks'
  } catch {
    return false
  }
}

export const sha256 = (daten) => createHash('sha256').update(daten).digest('hex')
export const sha256Datei = (pfad) => sha256(readFileSync(pfad))

// Alle Läufe aller Schritte. Auf main ist der Branchname nicht mehr der Schrittordner, darum zählt der Fingerabdruck.
export function leseRuns(root = PROOF_ROOT) {
  if (!existsSync(root)) return []
  const runs = []
  for (const d of readdirSync(root, { withFileTypes: true })) {
    const datei = join(root, d.name, 'runs.jsonl')
    if (!d.isDirectory() || !existsSync(datei)) continue
    for (const zeile of readFileSync(datei, 'utf8').split('\n').filter(Boolean)) {
      try {
        runs.push({ ...JSON.parse(zeile), schritt: d.name })
      } catch {
        // beschädigte Zeile zählt nicht als Nachweis
      }
    }
  }
  return runs
}
