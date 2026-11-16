// sys1 (n15-2, Migration 0070): Neue Funktionen im Schema public bekommen kein EXECUTE mehr automatisch für anon, authenticated und service_role.
// Rot-Beweis vor 0070: eine neue Funktion in public (nur `revoke all … from public` wie in 0006, kein weiteres revoke) ist für alle drei Rollen ausführbar (Ist-Wert true statt false).
// Die Rechte bestehender Funktionen bleiben unverändert: der Test schreibt den Katalogauszug (public und private) mit SHA-256 ins Log; derselbe Wert vor und nach `db:push`.
// Rollback-Proben, es bleibt nichts zurück.
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ownerSql, probes } from '../support/owner.ts'

const ROLLEN = ['anon', 'authenticated', 'service_role'] as const
const FN = 'public.zz_default_priv_probe()'

describe('Default-Privilegien (0070)', () => {
  it('der Weg der Migration läuft als postgres', () => {
    expect(ownerSql('select current_user::text as u')[0]?.u).toBe('postgres')
  })

  it('eine neue Funktion in public ist ohne ausdrückliches GRANT für anon, authenticated und service_role nicht ausführbar', () => {
    const r = probes(
      `create function ${FN.replace('()', '')}() returns int language sql as $$ select 1 $$; revoke all on function ${FN} from public;`,
      ROLLEN.map((rolle) => ({ name: rolle, sql: `=has_function_privilege('${rolle}', '${FN}', 'execute')` })),
    )
    for (const rolle of ROLLEN) expect(r[rolle], `${rolle} darf eine neue Funktion in public nicht ausführen`).toBe('= false')
  })

  it('pg_default_acl: für postgres in public stehen keine Funktionsrechte für anon, authenticated, service_role', () => {
    const rows = ownerSql(`select coalesce(a.grantee::regrole::text, 'PUBLIC') as grantee
      from pg_default_acl d
      join pg_namespace n on n.oid = d.defaclnamespace and n.nspname = 'public'
      cross join lateral aclexplode(d.defaclacl) a
      where d.defaclobjtype = 'f' and d.defaclrole = 'postgres'::regrole and a.grantee <> d.defaclrole`)
    expect(rows.map((x) => x.grantee).filter((g) => (ROLLEN as readonly string[]).includes(String(g)))).toEqual([])
  })

  it('Katalogauszug der Funktionsrechte in public und private (Hash im Log, vor und nach 0070 gleich)', () => {
    const rows = ownerSql(`select n.nspname || '.' || p.oid::regprocedure::text as f, p.proowner::regrole::text as owner,
        case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as grantee, a.privilege_type as priv
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where n.nspname in ('public', 'private')
      order by 1, 3, 4`)
    const text = rows.map((x) => `${x.f}|${x.owner}|${x.grantee}|${x.priv}`).join('\n')
    const owners = new Set(rows.map((x) => x.owner))
    console.log(`Funktionsrechte public+private: ${rows.length} Zeilen, SHA-256 ${createHash('sha256').update(text).digest('hex')}`)
    expect([...owners]).toEqual(['postgres'])
  })
})
