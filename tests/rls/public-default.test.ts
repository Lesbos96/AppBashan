// sys2 (BEKS 1, Migration 0071): Neue Funktionen von postgres bekommen in keinem Schema mehr automatisch EXECUTE für PUBLIC (und damit für anon und authenticated).
// Rot-Beweis vor 0071: eine neue Funktion OHNE jedes revoke ist für anon und authenticated ausführbar (Ist-Wert true statt false), eine globale Default-ACL-Zeile fehlt.
// Die Rechte bestehender Funktionen bleiben unverändert: der Katalogauszug (public und private) steht mit SHA-256 im Log, derselbe Wert wie vor 0071.
// Rollback-Proben, es bleibt nichts zurück.
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ownerSql, probes } from '../support/owner.ts'

const SCHEMAS = ['public', 'private'] as const

describe('PUBLIC-Default für neue Funktionen (0071)', () => {
  it('eine neue Funktion ohne jedes revoke ist in public und private für anon, authenticated und service_role nicht ausführbar', () => {
    const setup = SCHEMAS.map((s) => `create function ${s}.zz_pd_probe() returns int language sql as $$ select 1 $$`).join('; ')
    const r = probes(
      setup,
      SCHEMAS.flatMap((s) => ['anon', 'authenticated', 'service_role'].map((rolle) => ({ name: `${s}.${rolle}`, sql: `=has_function_privilege('${rolle}', '${s}.zz_pd_probe()', 'execute')` }))),
    )
    for (const s of SCHEMAS) for (const rolle of ['anon', 'authenticated', 'service_role']) expect(r[`${s}.${rolle}`], `${rolle} darf eine neue Funktion in ${s} nicht ausführen`).toBe('= false')
  })

  it('ein ausdrückliches GRANT nur für service_role öffnet genau diese Rolle (die Regel aus daten.md)', () => {
    const r = probes(
      'create function public.zz_pd_probe() returns int language sql as $$ select 1 $$; grant execute on function public.zz_pd_probe() to service_role',
      ['anon', 'authenticated', 'service_role'].map((rolle) => ({ name: rolle, sql: `=has_function_privilege('${rolle}', 'public.zz_pd_probe()', 'execute')` })),
    )
    expect(r).toEqual({ anon: '= false', authenticated: '= false', service_role: '= true' })
  })

  it('pg_default_acl: genau eine globale Zeile für Funktionen von postgres, ohne PUBLIC', () => {
    const rows = ownerSql(`select a.grantee::int as grantee
      from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a
      where d.defaclnamespace = 0 and d.defaclobjtype = 'f' and d.defaclrole = 'postgres'::regrole`)
    expect(rows.length, 'es muss die globale Zeile geben (sonst gilt der eingebaute PUBLIC-Default)').toBeGreaterThan(0)
    expect(rows.filter((x) => Number(x.grantee) === 0), 'PUBLIC darf nicht in der Default-ACL stehen').toEqual([])
  })

  it('Katalogauszug der Funktionsrechte in public und private (Hash im Log, vor und nach 0071 gleich)', () => {
    const rows = ownerSql(`select n.nspname || '.' || p.oid::regprocedure::text as f, p.proowner::regrole::text as owner,
        case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as grantee, a.privilege_type as priv
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where n.nspname in ('public', 'private')
      order by 1, 3, 4`)
    const text = rows.map((x) => `${x.f}|${x.owner}|${x.grantee}|${x.priv}`).join('\n')
    console.log(`Funktionsrechte public+private: ${rows.length} Zeilen, SHA-256 ${createHash('sha256').update(text).digest('hex')}`)
    expect(rows.length).toBeGreaterThan(0)
  })
})
