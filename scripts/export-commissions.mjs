// Provisions-Export eines Abrechnungsmonats als CSV (S9g, Konzept 9.5). Läuft mit service_role gegen das verlinkte Projekt;
// die admin-ID prüft die Datenbank-Funktion, jeder Export steht im Audit-Log. Keine Kundendaten in der Datei.
// Aufruf: npm run export:commissions -- 2026-10 <admin-user-id> [datei]   (Standard: tmp/commissions-<monat>.csv)
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { commissionsCsv } from '../supabase/functions/_shared/commission/csv.ts'

const [month, admin, out = `tmp/commissions-${process.argv[2]}.csv`] = process.argv.slice(2)
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? '') || !/^[0-9a-f-]{36}$/.test(admin ?? '')) {
  console.error('Aufruf: npm run export:commissions -- <JJJJ-MM> <admin-user-id> [datei]')
  process.exit(2)
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
// PostgREST kürzt Antworten auf max_rows (1000) ohne Fehler: seitenweise holen, bis eine Seite kürzer ist (stabile Reihenfolge in der Funktion)
const PAGE = 1000
const data = []
for (let from = 0; ; from += PAGE) {
  const { data: page, error } = await db.rpc('export_commissions', { p_actor: admin, p_month: `${month}-01` }).range(from, from + PAGE - 1)
  if (error) {
    console.error(`Export fehlgeschlagen: ${error.code ?? ''} ${error.message}`)
    process.exit(1)
  }
  data.push(...page)
  if (page.length < PAGE) break
}
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, commissionsCsv(data))
console.log(`${data.length} Zeilen nach ${out}`)
