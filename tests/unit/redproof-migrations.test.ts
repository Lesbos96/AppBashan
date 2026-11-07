// Parser der Migrations-Gegenprüfung (H-A-Rest) und SQL-Bausteine der Lockerungen (N-1): Fixtures ohne Datenbank.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { compareObjects, netInventory, norm, PLATTFORMOBJEKTE, splitStatements } from '../../scripts/redproof-migrations.mjs'
import { constraintDrop, patchFn, policyLoosen, triggerOff } from '../../scripts/redproof-sql.mjs'

const inv = (...sqls: string[]) => netInventory(sqls.map((sql, i) => ({ name: `${String(i + 1).padStart(4, '0')}.sql`, sql })))

describe('splitStatements', () => {
  it('Strings, Kommentare, Dollar-Quotes mit eigenem Tag und Semikolon darin', () => {
    const s = splitStatements("-- Kommentar; kein Ende\ncreate function f() returns int as $body$ begin return 1; end $body$ language plpgsql; select 'a;b'; /* x; */ select 2;")
    expect(s).toHaveLength(3)
    expect(s[0]).toContain('return 1; end')
    expect(s[1]).toBe("select 'a;b'")
  })
})

describe('netInventory', () => {
  it('späteres alter policy ersetzt Teile des create', () => {
    const r = inv('create policy p on public.t for select to authenticated using (a = 1);', 'alter policy p on public.t using (a = 2);')
    expect(r.policies.get('public.t.p')).toMatchObject({ cmd: 'select', qual: 'a = 2' })
  })
  it('drop nach create → soll fehlen; drop policy/trigger/constraint/default', () => {
    const r = inv(
      `create table public.t (id uuid primary key, v text default 'x', constraint v_chk check (v <> ''));
       create policy p on public.t for all to authenticated using (true);
       create trigger trg before insert on public.t for each row execute function private.f();
       alter table public.t enable row level security;`,
      'drop policy p on public.t; drop trigger if exists trg on public.t; alter table public.t drop constraint v_chk; alter table public.t alter column v drop default;',
    )
    expect(r.policies.size + r.triggers.size + r.defaults.size).toBe(0)
    expect(r.constraints.has('public.t.v_chk')).toBe(false)
    expect(r.constraints.has('public.t.t_pkey')).toBe(true)
    expect(r.rls.get('public.t')).toEqual({ enabled: true, force: false })
  })
  it('drop table entfernt alle Objekte der Tabelle', () => {
    const r = inv('create table t (id int primary key, v text default 1); create policy p on t for all using (true);', 'drop table t;')
    expect(r.policies.size + r.constraints.size + r.defaults.size + r.rls.size).toBe(0)
  })
  it('Inline-Constraint (benannt und automatisch benannt) und Inline-Default', () => {
    const r = inv(`create table public.b (id uuid primary key default gen_random_uuid(), a_id uuid not null references public.a(id) on delete cascade, email text constraint b_email check (email ~ '@'), n int check (n > 0), u text unique);`)
    expect([...r.constraints.keys()].sort()).toEqual(['public.b.b_a_id_fkey', 'public.b.b_email', 'public.b.b_n_check', 'public.b.b_pkey', 'public.b.b_u_key'])
    expect(r.defaults.get('public.b.id')?.text).toBe('gen_random_uuid()')
  })
  it('Policy in einem do-Block wird erfasst, dolar-quote mit eigenem Tag', () => {
    const r = inv("do $do$ begin create policy q on public.t for select to anon using (true); end $do$;")
    expect(r.policies.has('public.t.q')).toBe(true)
  })
  it('Funktionskörper und späteres create or replace; drop function', () => {
    const r = inv('create function public.f(a int) returns int language sql as $$ select 1 $$;', 'create or replace function public.f(a int) returns int language sql as $$ select 2 $$;', 'create function private.g() returns int language sql as $$ select 1 $$;', 'drop function private.g();')
    expect(r.functions.get('public.f/1')?.body.trim()).toBe('select 2')
    expect(r.functions.has('private.g/0')).toBe(false)
  })
  it('unbenannter Tabellen-Check ist nicht ableitbar und steht unter unresolved', () => {
    const r = inv('create table t (a int, b int, check (a < b));')
    expect(r.unresolved).toHaveLength(1)
  })
})

describe('compareObjects (beide Richtungen)', () => {
  // Dev liefert die Plattformobjekte immer mit (sonst „fehlt auf Dev“)
  const dev = (rows: object[]) => [...rows, ...PLATTFORMOBJEKTE.map((p) => ({ k: p.k, n: p.n, v: p.def }))] as { k: string; n: string; v: string }[]
  it('gleich trotz Umschreibung (Casts, = ANY (ARRAY[…]), Schemapräfix, Klammern)', () => {
    const r = inv("create policy p on public.t for select to authenticated using (role in ('a', 'b') and public.f(x));")
    const out = compareObjects(r, dev([{ k: 'policy', n: 'public.t.p', v: "SELECT¦{authenticated}¦((role = ANY (ARRAY['a'::text, 'b'::text])) AND f(x))¦¦PERMISSIVE" }]))
    expect(out[0].state).toMatch(/^gleich/)
  })
  it('gelockerte Policy (true statt Bedingung) → abweichend mit beiden Texten', () => {
    const r = inv('create policy p on public.t for select to authenticated using (owner = auth.uid());')
    const out = compareObjects(r, dev([{ k: 'policy', n: 'public.t.p', v: 'SELECT¦{authenticated}¦true¦¦PERMISSIVE' }]))
    expect(out[0]).toMatchObject({ state: 'abweichend', dev: 'SELECT¦{authenticated}¦true¦¦PERMISSIVE' })
    expect(out[0].mig).toContain('owner = auth.uid()')
  })
  it('Dev ohne Objekt (gelöschter Trigger, entfernter Constraint) → „fehlt auf Dev“', () => {
    const r = inv('create table public.t (id int primary key, e text constraint e_fmt check (e <> \'\')); create trigger trg before insert on public.t for each row execute function private.f();')
    const out = compareObjects(r, dev([{ k: 'constraint', n: 'public.t.t_pkey', v: 'PRIMARY KEY (id)' }]))
    expect(out.filter((l) => l.state === 'fehlt auf Dev').map((l) => `${l.k} ${l.n}`)).toEqual(['constraint public.t.e_fmt', 'trigger public.t.trg'])
  })
  it('Objekt auf Dev ohne Migration → „nicht gefunden“', () => {
    const out = compareObjects(inv('select 1;'), dev([{ k: 'policy', n: 'storage.objects.redproof_update', v: 'UPDATE¦{authenticated}¦true¦true' }]))
    expect(out.filter((l: any) => l.state === 'nicht gefunden').map((l: any) => l.n)).toEqual(['storage.objects.redproof_update'])
  })
  it('Plattformobjekte: nur die benannten Einzelfälle, Definition muss stimmen; kein Freibrief für das Schema', () => {
    expect(PLATTFORMOBJEKTE.map((p) => p.n)).toEqual(['storage.objects.protect_objects_delete', 'storage.objects.update_objects_updated_at'])
    expect(PLATTFORMOBJEKTE.every((p) => p.def.length > 40 && p.grund.length > 20)).toBe(true)
    const DEL = 'storage.objects.protect_objects_delete'
    const UPD = 'storage.objects.update_objects_updated_at'
    const row = (n: string, tweak: (def: string) => string = (d) => d) => {
      const p = PLATTFORMOBJEKTE.find((x) => x.n === n)
      if (!p) throw new Error(`kein Plattformobjekt ${n}`)
      return { k: p.k, n: p.n, v: tweak(p.def) }
    }
    const ok = [row(DEL, (d) => d.replace(' ON ', '  ON ')), row(UPD)]
    expect(compareObjects(inv('select 1;'), ok).map((l: any) => l.state)).toEqual(['gleich (Plattformobjekt)', 'gleich (Plattformobjekt)'])
    // Definition auf Dev geändert (Statement statt Row) → Fund
    const changed = [row(UPD, (d) => d.replace('FOR EACH ROW', 'FOR EACH STATEMENT')), row(DEL)]
    expect(compareObjects(inv('select 1;'), changed).find((l: any) => l.n === UPD)?.state).toBe('abweichend')
    // anderer Trigger im selben Schema ohne Eintrag → weiter „nicht gefunden“
    expect(compareObjects(inv('select 1;'), [...ok, { k: 'trigger', n: 'storage.objects.fremd', v: 'CREATE TRIGGER fremd BEFORE DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION x()' }]).find((l: any) => l.n.endsWith('fremd'))?.state).toBe('nicht gefunden')
    // Plattformobjekt fehlt auf Dev → Fund
    expect(compareObjects(inv('select 1;'), [row(UPD)]).find((l: any) => l.n === DEL)?.state).toBe('fehlt auf Dev')
  })
  it('Funktionskörper: Kommentare und Leerraum egal, geänderter Text → abweichend', () => {
    const r = inv('create function public.f() returns int language sql as $$ select 1 -- eins\n $$;')
    expect(compareObjects(r, dev([{ k: 'function', n: 'public.f/0', v: ' select   1 ' }]))[0].state).toMatch(/^gleich/)
    expect(compareObjects(r, dev([{ k: 'function', n: 'public.f/0', v: 'select 2' }]))[0].state).toBe('abweichend')
  })
  it('Umschreibungen: between, not in, not like, Alias, on delete set null, Trigger-Ereignisreihenfolge, Tabellenpräfix in Policies', () => {
    const r = inv(`create table public.t (id int primary key, fk int references public.p (id) on delete set null, n int check (n between 1 and 23), k text, constraint k_chk check (k not in ('a', 'b') or k not like 'x%'));
      create policy p on public.t for select to authenticated using (t.id = (select auth.uid()));
      create trigger g before update or delete on public.t for each row execute function private.g('x');`)
    const out = compareObjects(r, dev([
      { k: 'constraint', n: 'public.t.t_pkey', v: 'PRIMARY KEY (id)' },
      { k: 'constraint', n: 'public.t.t_fk_fkey', v: 'FOREIGN KEY (fk) REFERENCES p(id) ON DELETE SET NULL' },
      { k: 'constraint', n: 'public.t.t_n_check', v: 'CHECK (((n >= 1) AND (n <= 23)))' },
      { k: 'constraint', n: 'public.t.k_chk', v: "CHECK (((k <> ALL (ARRAY['a'::text, 'b'::text])) OR (k !~~ 'x%'::text)))" },
      { k: 'policy', n: 'public.t.p', v: 'SELECT¦{authenticated}¦(id = ( SELECT auth.uid() AS uid))¦¦PERMISSIVE' },
      { k: 'trigger', n: 'public.t.g', v: "CREATE TRIGGER g BEFORE DELETE OR UPDATE ON public.t FOR EACH ROW EXECUTE FUNCTION private.g('x')" },
    ]))
    expect(out.filter((l: any) => !l.state.startsWith('gleich')).map((l: any) => `${l.n} ${l.state}`)).toEqual([])
  })
  it('M-5: Operatorzeichen zählen (~ vs. kein Operator, ?| vs. ?&) und permissive/restrictive wird verglichen', () => {
    const r = inv("create table public.t (id int primary key, e text, constraint e_fmt check (e ~ '@'));\ncreate policy p on public.t for select to authenticated using (e ~ '@');")
    const dev = (c: string, pol: string) => [
      { k: 'constraint', n: 'public.t.t_pkey', v: 'PRIMARY KEY (id)' },
      { k: 'constraint', n: 'public.t.e_fmt', v: c },
      { k: 'policy', n: 'public.t.p', v: pol },
      ...PLATTFORMOBJEKTE.map((p) => ({ k: p.k, n: p.n, v: p.def })),
    ]
    const bad = (rows: any[]) => compareObjects(r, rows).filter((l: any) => !l.state.startsWith('gleich')).map((l: any) => `${l.n} ${l.state}`)
    expect(bad(dev("CHECK ((e ~ '@'::text))", "SELECT¦{authenticated}¦(e ~ '@'::text)¦¦PERMISSIVE"))).toEqual([])
    expect(bad(dev("CHECK ((e = '@'::text))", "SELECT¦{authenticated}¦(e ~ '@'::text)¦¦PERMISSIVE"))).toEqual(['public.t.e_fmt abweichend'])
    expect(bad(dev("CHECK ((e ~ '@'::text))", "SELECT¦{authenticated}¦(e ~ '@'::text)¦¦RESTRICTIVE"))).toEqual(['public.t.p abweichend'])
    expect(norm("a ?| b")).not.toBe(norm("a ?& b"))
  })
  it('drop column entfernt Constraints, die die Spalte betreffen (auch mehrspaltige Checks)', () => {
    const r = inv('create table public.t (a int, b int, c int references public.p (id), check (a < b));', 'alter table public.t drop column a; alter table public.t drop column c;')
    expect([...r.constraints.keys()]).toEqual([])
  })
  it('norm: Spalten-Default und Casts', () => {
    expect(norm("''::text")).toBe(norm("''"))
    expect(norm('now()')).toBe(norm('NOW( )'))
  })
})

describe('SQL-Bausteine (idempotente Restores, N-1)', () => {
  const select = (q: string) => {
    if (q.includes('pg_get_functiondef')) return [{ d: 'CREATE OR REPLACE FUNCTION public.f()\n RETURNS int\n AS $function$ select 1 $function$\n' }]
    if (q.includes('pg_get_constraintdef')) return [{ d: "CHECK ((email ~ '@'::text))" }]
    return [{ qual: '(a = 1)', with_check: '(a = 1)' }]
  }
  it('Funktion: Lockerung ändert, Restore ist die Originaldefinition (create or replace); fehlendes Muster → Fehler', () => {
    const r = patchFn(select, 'public.f()', 'select 1', 'select 2')
    expect(r.loosen).toContain('select 2')
    expect(r.restore).toContain('select 1')
    expect(r.restore).toMatch(/^CREATE OR REPLACE FUNCTION/)
    expect(() => patchFn(select, 'public.f()', 'nicht da', 'x')).toThrow(/Muster nicht gefunden/)
  })
  it('Constraint: Restore löscht zuerst if exists, dann add; purge steht davor', () => {
    const r = constraintDrop(select, 'public.t', 'c', "delete from public.t where e = 'x'")
    expect(r.restore.split(';\n')).toEqual(["delete from public.t where e = 'x'", 'alter table public.t drop constraint if exists c', "alter table public.t add constraint c CHECK ((email ~ '@'::text))"])
  })
  it('Policy: Restore als alter policy mit gelesener Bedingung; Trigger: enable', () => {
    expect(policyLoosen(select, 'p', 'public.t', 'using', 'true')).toEqual({ loosen: 'alter policy p on public.t using (true)', restore: 'alter policy p on public.t using ((a = 1))' })
    expect(triggerOff('public.t', 'trg').restore).toBe('alter table public.t enable trigger trg')
  })
})
