// Fingerabdruck je Suite: Hash über die Dateien, von denen das Ergebnis abhängt (Git-Blob-Hashes der verfolgten Dateien).
import { git, sha256 } from './lib.mjs'

const NICHT_DOCS = [':(exclude)docs', ':(exclude,glob)**/*.md']
const TSCONFIG = ':(glob)tsconfig*.json'
// Die App importiert die Design-Tokens aus docs/ (src/lib/motion.ts, src/dev/Fundament.tsx): zählt als Code. Ein Selbsttest sucht weitere Importe aus docs/.
export const DOCS_IMPORTE = ['docs/reference/design/tokens.json']
// Je Suite eine Liste von Pfadgruppen (eine Gruppe = ein `git ls-files`-Aufruf, wegen der Ausschlüsse).
const SPECS = {
  // alles außer Doku
  check: [['.', ...NICHT_DOCS], DOCS_IMPORTE],
  rls: [['supabase/migrations', 'supabase/functions', 'supabase/seed.sql', 'tests/rls', 'tests/support', 'scripts', 'vite.config.ts', TSCONFIG, 'package.json', 'package-lock.json']],
  e2e: [['src', 'public', 'index.html', 'tests/e2e', 'tests/support', 'playwright.config.ts', 'vite.config.ts', TSCONFIG, 'supabase/functions/_shared', 'package.json', 'package-lock.json', ...DOCS_IMPORTE]],
}

export const SUITEN = Object.keys(SPECS)
// Kanonischer Befehl je Suite: nur ein Lauf ohne Zusatzargumente zählt als Nachweis der ganzen Suite.
export const KANON = { check: 'npm run check', e2e: 'npm run test:e2e', rls: 'npm run test:rls' }

export function fingerabdruck(suite) {
  const gruppen = SPECS[suite]
  if (!gruppen) throw new Error(`Unbekannte Suite: ${suite}`)
  return sha256(gruppen.map((spec) => git('ls-files', '-s', '--', ...spec)).join('\n--\n'))
}
