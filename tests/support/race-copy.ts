// Negativkontrolle für Wettlauftests (sys1, n12b-2): legt eine Kopie der Storno-Funktionen OHNE die Sperre der Anfrage in einem eigenen Schema `race_ctl` an
// (committet, damit parallele Verbindungen sie sehen) und entfernt sie wieder. Die echten Funktionen bleiben unangetastet; ein Absturz hinterlässt nur das
// unerreichbare Schema (kein USAGE für anon, authenticated, service_role, kein EXECUTE für PUBLIC), das der nächste Lauf zu Beginn entfernt.
// Die Kopie entsteht aus pg_get_functiondef der echten Funktion; eine Ersetzung (Sperre `for update` → ungesperrter Lesezugriff plus 2 s Pause, damit sich die
// Wettläufer sicher überlappen) und der Funktionsname. Die Funktion bricht ab, wenn die Sperrklausel nicht genau einmal vorkommt oder die Kopie rückübersetzt
// nicht dem Original entspricht. Lösch-Gate (scripts/sys/gate-loesch-lib.mjs): Freigabe dieser Datei im Commit nötig, Lauf nur über `npm run t`.
import '../../scripts/dev-guard.mjs'
import { loeschFreigabe, loeschLog } from '../../scripts/sys/gate-loesch-lib.mjs'
import { ownerSql } from './owner.ts'

export const KOPIE = {
  kunde: 'race_ctl.cancel_by_customer_nolock',
  firma: 'race_ctl.cancel_by_partner_nolock',
} as const

const SPERRE = 's.id = p_request for update;'
const OHNE = 's.id = p_request; perform pg_sleep(2);'

/** Entfernt das Schema `race_ctl` samt Kopien (auch Reste eines abgebrochenen Laufs). */
export function entferneKopien() {
  loeschFreigabe(import.meta.url)
  ownerSql('drop schema if exists race_ctl cascade')
  loeschLog('tests/support/race-copy.ts', { schemaEntfernt: 1 })
}

/** Legt `race_ctl.cancel_by_customer_nolock`, `race_ctl.cancel_by_partner_nolock` und `race_ctl.change_gate_nolock` an. */
export function legeKopienAn() {
  loeschFreigabe(import.meta.url)
  entferneKopien()
  ownerSql(`do $r$
    declare
      v record;
      orig text;
      neu text;
      n int;
    begin
      create schema race_ctl;
      revoke all on schema race_ctl from public, anon, authenticated, service_role;
      for v in
        select * from (values
          ('private.change_gate(uuid,text,uuid)'::regprocedure, 'private.change_gate(', 'race_ctl.change_gate_nolock('),
          ('public.cancel_by_customer(uuid,uuid,bigint,numeric,numeric,bigint,bigint,bigint,bigint,integer,integer)'::regprocedure, 'public.cancel_by_customer(', 'race_ctl.cancel_by_customer_nolock('),
          ('public.cancel_by_partner(uuid,text,uuid,text,uuid[],bigint,numeric,numeric,bigint,bigint,bigint,bigint,integer,integer)'::regprocedure, 'public.cancel_by_partner(', 'race_ctl.cancel_by_partner_nolock(')
        ) t(f, alt, kopf)
      loop
        orig := pg_get_functiondef(v.f);
        n := (length(orig) - length(replace(orig, '${SPERRE}', ''))) / length('${SPERRE}');
        -- die Sperre liegt in change_gate (Absage der Firma) bzw. im Rumpf (Absage des Kunden), nie in cancel_by_partner selbst
        if (v.alt = 'public.cancel_by_partner(' and n <> 0) or (v.alt <> 'public.cancel_by_partner(' and n <> 1) then
          raise exception 'race_copy: % enthält die Sperrklausel % mal', v.alt, n;
        end if;
        neu := replace(replace(replace(orig, '${SPERRE}', '${OHNE}'), v.alt, v.kopf), 'private.change_gate(', 'race_ctl.change_gate_nolock(');
        -- Rückübersetzung muss das Original ergeben (die Kopie weicht nur in Namen und Sperrklausel ab)
        if replace(replace(replace(neu, '${OHNE}', '${SPERRE}'), v.kopf, v.alt), 'race_ctl.change_gate_nolock(', 'private.change_gate(') is distinct from orig then
          raise exception 'race_copy: Kopie von % weicht vom Original ab', v.alt;
        end if;
        execute neu;
      end loop;
      -- Kopien für niemanden außer den Eigentümer ausführbar
      execute (select string_agg(format('revoke all on function %s from public, anon, authenticated, service_role', p.oid::regprocedure), '; ')
               from pg_proc p where p.pronamespace = 'race_ctl'::regnamespace);
    end $r$`)
  loeschLog('tests/support/race-copy.ts', { schemaAngelegt: 1 })
}
