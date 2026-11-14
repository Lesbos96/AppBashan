// Probe für den pre-push-Hook: Trockenlauf eines Pushes von HEAD nach main. Es wird nichts übertragen (--dry-run); der Hook läuft trotzdem.
import { spawnSync } from 'node:child_process'

const r = spawnSync('git', ['push', '--dry-run', 'origin', 'HEAD:refs/heads/main'], { stdio: 'inherit' })
process.exit(r.status ?? 1)
