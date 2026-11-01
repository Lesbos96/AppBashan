import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (name: string) => readFileSync(new URL(`../../supabase/${name}`, import.meta.url), 'utf8')

// Kommentare raus, dann je Tabelle genau ein Insert-Statement (Seed-Strings enthalten kein Semikolon am Zeilenende).
const statements = (sql: string) => {
  const body = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
  const map = new Map<string, string>()
  for (const s of body.split(/;\s*(?:\n|$)/).map((x) => x.trim()).filter(Boolean)) {
    // das Veröffentlichen der Seed-Version ist das einzige Statement, das kein Insert ist
    const table = /^insert into public\.(\w+)/.exec(s)?.[1] ?? (s === 'select private.publish_seed_version(1)' ? 'publish' : undefined)
    if (!table) throw new Error(`Unerwartetes Statement: ${s.slice(0, 60)}`)
    expect(map.has(table), `${table} doppelt`).toBe(false)
    map.set(table, s)
  }
  return map
}

const dev = statements(read('seed.sql'))
const prod = statements(read('seed.prod.sql'))
const tariffTables = ['price_versions', 'price_config', 'platform_settings']
const prodTables = [...tariffTables, 'publish']

describe('seed.prod.sql', () => {
  it('enthält Tarife und Gebührensatz', () => {
    expect([...prod.keys()].sort()).toEqual([...prodTables].sort())
    expect(prod.get('platform_settings')).toContain("'fee_rate'")
    expect(prod.get('price_config')).toContain("'team_rate.1'")
  })

  it('enthält keine Tabelle, die nur der Dev-Seed füllt (Demo-Angebote, Testnutzer)', () => {
    const devOnly = [...dev.keys()].filter((t) => !prodTables.includes(t))
    expect(devOnly).toContain('rental_offers')
    for (const table of devOnly) expect(prod.has(table), table).toBe(false)
    const sql = read('seed.prod.sql')
    expect(sql).not.toMatch(/is_demo|Beispielvermieter|auth\.|example\.(com|org)|test@/i)
  })

  it.each(prodTables)('%s ist identisch mit seed.sql', (table) => {
    expect(prod.get(table)).toBe(dev.get(table))
  })
})
