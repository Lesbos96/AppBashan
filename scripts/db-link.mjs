// Verlinkt das Dev-Projekt. Ref, Token und Passwort kommen per dotenv-cli aus .env.local.
import { execFileSync } from 'node:child_process'

const ref = process.env.SUPABASE_PROJECT_REF ?? ''
if (!/^[a-z]{20}$/.test(ref)) {
  console.error('SUPABASE_PROJECT_REF fehlt oder hat nicht das Format eines Project-Refs.')
  process.exit(1)
}
execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'link', '--project-ref', ref], {
  stdio: 'inherit',
})
