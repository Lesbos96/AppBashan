import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (name: string) => readFileSync(new URL(`../../supabase/${name}`, import.meta.url), 'utf8')

// Kommentare raus, dann je Tabelle genau ein Insert-Statement (Seed-Strings enthalten kein Semikolon am Zeilenende).
const statements = (sql: string) => {
  const body = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
  const map = new Map<string, string>()
  for (const s of body.split(/;\s*(?:\n|$)/).map((x) => x.trim()).filter(Boolean)) {
    const table = /^insert into public\.(\w+)/.exec(s)?.[1]
    if (!table) throw new Error(`Unerwartetes Statement: ${s.slice(0, 60)}`)
    expect(map.has(table), `${table} doppelt`).toBe(false)
    map.set(table, s)
  }
  return map
}

const dev = statements(read('seed.sql'))
const prod = statements(read('seed.prod.sql'))
const tariffTables = ['price_versions', 'price_config', 'platform_settings']

describe('seed.prod.sql', () => {
  it('enthält Tarife und Gebührensatz', () => {
    expect([...prod.keys()].sort()).toEqual([...tariffTables].sort())
    expect(prod.get('platform_settings')).toContain("'fee_rate'")
    expect(prod.get('price_config')).toContain("'team_rate.1'")
  })

  it('enthält keine Tabelle, die nur der Dev-Seed füllt (Demo-Angebote, Testnutzer)', () => {
    const devOnly = [...dev.keys()].filter((t) => !tariffTables.includes(t))
    expect(devOnly).toContain('rental_offers')
    for (const table of devOnly) expect(prod.has(table), table).toBe(false)
    const sql = read('seed.prod.sql')
    expect(sql).not.toMatch(/is_demo|Beispielvermieter|auth\.|example\.(com|org)|test@/i)
  })

  it.each(tariffTables)('%s ist identisch mit seed.sql', (table) => {
    expect(prod.get(table)).toBe(dev.get(table))
  })
})
