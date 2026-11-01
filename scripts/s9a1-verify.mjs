// Prüft nach Migration 0015/0016 und Seed (Dev): Version 1 ist veröffentlicht, gehasht, aktuell und unverändert prüfbar.
// Start: npx dotenv -e .env.local -- node scripts/s9a1-verify.mjs   (nur Ergebnisse, keine Werte aus .env)
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
let failed = 0
const check = (ok, name) => {
  console.log(`${ok ? 'OK ' : 'FEHLER'} ${name}`)
  if (!ok) failed++
}

const current = await db.from('current_price_version').select('version').single()
check(current.data?.version === 1, `current_price_version = 1 (${current.data?.version})`)
const v1 = await db.from('price_versions').select('published, published_at, content_hash').eq('version', 1).single()
check(v1.data?.published === true && Boolean(v1.data?.published_at) && /^[0-9a-f]{64}$/.test(v1.data?.content_hash ?? ''), 'Version 1 veröffentlicht mit Hash')
const config = await db.from('price_config').select('key', { count: 'exact', head: true }).eq('version', 1)
check(config.count === 28, `price_config Version 1: ${config.count} Zeilen (erwartet 28)`)
const seedRows = [...readFileSync('supabase/seed.sql', 'utf8').matchAll(/\(1, '([\w.]+)', ([\d.]+), '([^']+)'/g)].map((m) => `${m[1]}|${Number(m[2])}|${m[3]}`).sort()
const dbRows = ((await db.from('price_config').select('key, value, unit').eq('version', 1)).data ?? []).map((r) => `${r.key}|${Number(r.value)}|${r.unit}`).sort()
check(JSON.stringify(seedRows) === JSON.stringify(dbRows), 'price_config Version 1 gleich den Werten aus seed.sql')
check((await db.rpc('verify_price_version', { p_version: 1 })).error === null, 'verify_price_version(1) ohne Abweichung')
const settings = await db.from('platform_settings').select('key, version').order('key')
const keys = (settings.data ?? []).map((r) => `${r.key}/${r.version}`)
check(keys.length === 27 && keys.includes('fee_rate/1') && keys.includes('fee_notice_days/1'), `platform_settings: ${keys.length} Zeilen (erwartet 27)`)
const terms = await db.rpc('booking_terms')
check(terms.error === null && !/fee_rate|fee_vat/.test(JSON.stringify(terms.data)), 'booking_terms liefert Werte ohne fee_*')
process.exit(failed === 0 ? 0 : 1)
