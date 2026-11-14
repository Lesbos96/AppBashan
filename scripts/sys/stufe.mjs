// Risikostufe aus geänderten Pfaden. Höchste Stufe gewinnt, unbekannte Pfade zählen als R3.
// Herabstufen gibt es nicht; die Stufe wird nie selbst eingeschätzt.
import { pathToFileURL } from 'node:url'

// Reihenfolge zählt: erster Treffer. R3-Sonderfälle stehen vor den allgemeineren Regeln.
const REGELN = [
  [/^\.claude\//, 3],
  [/^\.githooks\//, 3],
  [/^CLAUDE\.md$/, 3], // Regeln für alle Sessions: läuft nicht an den Gates vorbei
  [/^package\.json$/, 3], // enthält die Gate-Ketten (t, check, test:rls, db:push, prepare, fertig, bericht)
  [/^scripts\/sys\//, 3],
  [/^tests\/unit\/sys-/, 3],
  [/^supabase\//, 3],
  [/^src\/lib\/money/, 3],
  [/^tests\/(rls|support)\//, 3],
  [/^docs\/freigaben\//, 3], // Lösch-Freigaben (Gate)
  [/^docs\/reference\/design\/tokens\.json$/, 1], // wird von src/ importiert (Fingerabdruck: DOCS_IMPORTE)
  [/^docs\//, 0],
  [/\.md$/, 0],
  [/^src\/(screens|components|assets)\//, 1],
  [/\.css$/, 1],
  [/^tests\/(e2e|shots)\//, 1],
  [/^src\/(lib|app|dev)\//, 2],
  [/^tests\/unit\//, 2],
  [/^scripts\//, 2],
  [/^public\//, 2],
  [/^(src\/[^/]+\.(ts|tsx)|index\.html|vite\.config\.ts|playwright\.config\.ts|tsconfig[^/]*\.json|eslint\.config\.js|package-lock\.json)$/, 2],
]

export function stufeAus(pfade) {
  let hoechste = 0
  for (const p of pfade) {
    const norm = p.replace(/\\/g, '/')
    const treffer = REGELN.find(([re]) => re.test(norm))
    hoechste = Math.max(hoechste, treffer ? treffer[1] : 3)
  }
  return `R${hoechste}`
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { git } = await import('./lib.mjs')
  const pfade = git('diff', '--no-renames', '--name-only', 'main...HEAD').split('\n').filter(Boolean)
  console.log(`${stufeAus(pfade)} (${pfade.length} Pfade gegen main)`)
}
