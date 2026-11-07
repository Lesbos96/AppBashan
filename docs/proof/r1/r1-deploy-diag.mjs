// Diagnose: HEAD-Kopie von quote auf Dev deployen und den Fehlertext zeigen (stderr, ohne Secrets).
import '../../scripts/dev-guard.mjs'
import { createDeployer, realDeployDeps } from '../../scripts/redproof-deploy.mjs'
const dep = createDeployer(realDeployDeps())
const dir = dep.exportCommit('137afdb8ff4d9b4ba40d3a70cda01395c899b9a3')
try { console.log(dep.deploy(dir)); console.log('DEPLOY ok') } catch (e) { console.log('STDERR:', String(e.stderr ?? '').slice(0, 3000)); console.log('STDOUT:', String(e.stdout ?? '').slice(0, 1000)) } finally { dep.remove(dir) }
