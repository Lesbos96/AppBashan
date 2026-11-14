// Fingerabdruck je Suite: Hash über die Dateien, von denen das Ergebnis abhängt (Git-Blob-Hashes der verfolgten Dateien).
import { git, sha256 } from './lib.mjs'

const NICHT_DOCS = [':(exclude)docs', ':(exclude,glob)**/*.md']
const TSCONFIG = ':(glob)tsconfig*.json'
const SPECS = {
  // alles außer Doku
  check: ['.', ...NICHT_DOCS],
  rls: ['supabase/migrations', 'supabase/functions', 'supabase/seed.sql', 'tests/rls', 'tests/support', 'scripts', 'vite.config.ts', TSCONFIG, 'package.json', 'package-lock.json'],
  e2e: ['src', 'public', 'index.html', 'tests/e2e', 'tests/support', 'playwright.config.ts', 'vite.config.ts', TSCONFIG, 'supabase/functions/_shared', 'package.json', 'package-lock.json'],
}

export const SUITEN = Object.keys(SPECS)
// Kanonischer Befehl je Suite: nur ein Lauf ohne Zusatzargumente zählt als Nachweis der ganzen Suite.
export const KANON = { check: 'npm run check', e2e: 'npm run test:e2e', rls: 'npm run test:rls' }

export function fingerabdruck(suite) {
  const spec = SPECS[suite]
  if (!spec) throw new Error(`Unbekannte Suite: ${suite}`)
  return sha256(git('ls-files', '-s', '--', ...spec))
}
