// Wiederherstellung von Hand nach einem abgebrochenen Redproof-Lauf (R1, M-1/M-C): arbeitet alle Offen-Markierungen aus tmp/proof/
// LIFO ab (SQL: Restore bis Soll-Gleichheit, Deploy: genau der in der Markierung gespeicherte Commit), entfernt Totmann-Jobs, prüft das
// Soll und löscht Markierungen und Sperre. Ohne Argument. Start: npx dotenv -e .env.local -- node scripts/redproof-restore.mjs
import './dev-guard.mjs'
import { readFileSync } from 'node:fs'
import { createRun, FatalError, PreError, realDeps } from './redproof-lib.mjs'
import { createDeployer, realDeployDeps } from './redproof-deploy.mjs'

if (process.argv.length > 2) {
  console.error('Das Skript nimmt kein Argument: es arbeitet immer alle Markierungen ab (innen zuerst).')
  process.exit(2)
}
const deps = realDeps()
const deployer = createDeployer(realDeployDeps())
deps.deployCommit = (commit) => {
  const dir = deployer.exportCommit(commit)
  try { deployer.deploy(dir) } finally { deployer.remove(dir) }
}
deps.deployMatches = (commit) => deployer.matches(commit).same
const soll = JSON.parse(readFileSync('scripts/redproof-soll.json', 'utf8')).rows
const run = createRun(deps, { name: 'restore', mode: 'write', soll })
try {
  const { restored } = await run.recover()
  console.log(restored.length ? `Wiederhergestellt (innen zuerst): ${restored.join('; ')}. Dev gleich Soll.` : 'Keine Markierung offen. Dev gleich Soll.')
} catch (e) {
  console.error(String(e?.message ?? e))
  process.exitCode = e instanceof PreError ? 2 : e instanceof FatalError ? 3 : 1
}
