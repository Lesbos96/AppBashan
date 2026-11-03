import './dev-guard.mjs'
// Spielt supabase/seed.sql (Demo-Angebote, idempotent) in das Dev-Projekt ein. Läuft per dotenv-cli (npm run db:seed:dev); db:push setzt kein --include-seed mehr.
import { execFileSync } from 'node:child_process'

execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'db', 'query', '--linked', '-f', 'supabase/seed.sql'], {
  stdio: 'inherit',
})
