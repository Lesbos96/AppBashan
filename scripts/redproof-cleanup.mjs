// Räumt Wegwerf-Konten `redproof-%@movenow.test` auf Dev auf (Reste abgebrochener Läufe; Konto-Kaskade, dazu ihre Dateien im Bucket).
// Bricht ab, solange eine Sperre mit lebender PID oder eine Offen-Markierung vorliegt (ein laufender Lauf braucht seine Fixtures).
// Start: npx dotenv -e .env.local -- node scripts/redproof-cleanup.mjs [--dry-run] [--older-than-minutes 60]
import './dev-guard.mjs'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const DIR = 'tmp/proof'
const BUCKET = 'request-photos'
const dry = process.argv.includes('--dry-run')
const at = process.argv.indexOf('--older-than-minutes')
const minutes = at < 0 ? 60 : Number(process.argv[at + 1])
const alive = (pid) => { try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' } }
if (existsSync(`${DIR}/redproof.lock`) && alive(JSON.parse(readFileSync(`${DIR}/redproof.lock`, 'utf8')).pid)) { console.error('Ein Redproof-Lauf ist aktiv: kein Aufräumen.'); process.exit(2) }
if (existsSync(DIR) && readdirSync(DIR).some((f) => /^redproof-offen-/.test(f))) { console.error('Offene Markierung vorhanden: erst node scripts/redproof-restore.mjs.'); process.exit(2) }

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const cutoff = Date.now() - minutes * 60_000
const users = []
for (let page = 1; ; page++) {
  const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 })
  if (error) throw error
  users.push(...data.users.filter((u) => /^redproof-.*@movenow\.test$/.test(u.email ?? '') && Date.parse(u.created_at) < cutoff))
  if (data.users.length < 200) break
}
console.log(`${users.length} Konto/Konten redproof-% älter als ${minutes} min${dry ? ' (Trockenlauf, nichts gelöscht)' : ''}`)
for (const u of users) {
  if (dry) continue
  const paths = []
  const top = (await service.storage.from(BUCKET).list(u.id)).data ?? []
  for (const f of top) {
    const sub = (await service.storage.from(BUCKET).list(`${u.id}/${f.name}`)).data ?? []
    paths.push(...(sub.length ? sub.map((s) => `${u.id}/${f.name}/${s.name}`) : [`${u.id}/${f.name}`]))
  }
  for (let i = 0; i < paths.length; i += 100) await service.storage.from(BUCKET).remove(paths.slice(i, i + 100))
  const { error } = await service.auth.admin.deleteUser(u.id)
  console.log(`${error ? 'FEHLER' : 'gelöscht'}: Konto ${u.id.slice(0, 8)}…, ${paths.length} Datei(en)`)
}
