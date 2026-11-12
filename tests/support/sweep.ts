// Aufräumen der Wettlauftests (committete Fixtures), auch Reste früherer Läufe. Ein einziger CLI-Aufruf je Aufruf der Funktion
// (ein DO-Block statt je Firma und Nutzer einer Abfrage); die Laufzeit hängt nicht mehr von der Zahl der Reste ab.
// Test-Marker: Nutzer pt-*@movenow.test, Firmen Kontaktadresse pt-firma-<8 Hex>@movenow.test. Journal, Zuordnungen und Angebote sind unlöschbar
// (ON DELETE RESTRICT): Firmen damit werden gesperrt, damit sie nie Empfänger anderer Tests sind; Nutzer, an denen etwas hängt, bleiben (OPEN_ISSUES S9c-7).
// Es darf nur ein test:rls-Lauf gleichzeitig auf Dev laufen (der Marker gehört keinem Lauf einzeln).
import '../../scripts/dev-guard.mjs'
import { ownerSql } from './owner.ts'
import { COVER_FIRM, FIRM_MAIL_RE } from './partner.ts'

// Testfirma = Marker-Kontaktadresse, nicht die Abdeckungsfirma und kein Mitglied außerhalb der Testkonten (pt-*@movenow.test).
// Die Mitgliedschaft ist kein Marker: sie geht mit dem Nutzer verloren (partner_members.user_id on delete cascade), die Firma bliebe unauffindbar.
const TEST_FIRM = `p.contact_email ~ '${FIRM_MAIL_RE}' and p.name <> '${COVER_FIRM}'
  and not exists (select 1 from public.partner_members m join auth.users x on x.id = m.user_id where m.partner_id = p.id and coalesce(x.email, '') not like 'pt-%@movenow.test')`
// Gebunden = etwas verweist mit RESTRICT auf die Firma (0030:57 Zuordnung, 0038:20 Angebot, 0028:13 Journal, 0035:20 Beleg, 0040:11 Nachtrag): nicht löschbar
const BOUND = `(exists (select 1 from public.assignments a where a.partner_id = p.id) or exists (select 1 from public.partner_offers o where o.partner_id = p.id)
  or exists (select 1 from public.commission_entries c where c.partner_id = p.id) or exists (select 1 from public.job_photos j where j.uploaded_partner_id = p.id)
  or exists (select 1 from public.price_revisions r where r.proposed_by = p.id))`

/**
 * Räumt Testfirmen und Testnutzer auf; `admin` ist der Akteur der Sperren und bleibt, außer bei `final` (dann wird auch er versucht).
 * Ein Fehler bei einer Firma betrifft nur diese. Am Anfang eines Tests (`final` aus) wirft die Funktion, wenn danach noch aktive oder
 * ungebundene (also nicht gelöschte) Testfirmen übrig sind (sie wären Empfänger fremder Tests); im `afterAll` (`final`) bleibt es bei einer Warnung.
 */
export function sweepTestResidue(admin: string, final = false) {
  let left = { active: 0, unbound: 0 }
  try {
    const r = ownerSql(`do $sweep$
      declare f record; u record;
      begin
        for f in select p.id, p.status::text as st, ${BOUND} as bound
          from public.partners p where ${TEST_FIRM} loop
          begin
            if not f.bound then
              perform set_config('app.mv_partner_delete', f.id::text, true);
              delete from public.partner_documents where partner_id = f.id;
              delete from public.partner_vat_rules where partner_id = f.id;
              delete from public.partner_regions where partner_id = f.id;
              delete from public.partner_categories where partner_id = f.id;
              delete from public.partner_members where partner_id = f.id;
              delete from public.partners where id = f.id;
            elsif f.st in ('active', 'payment_hold') then
              perform public.admin_set_partner_status('${admin}', f.id, 'suspended', 'Testrest nach Wettlauftest ' || left(f.id::text, 8));
            end if;
          exception when others then raise warning 'sweep firm %: %', f.id, sqlerrm;
          end;
        end loop;
        for u in select id from auth.users x where x.email like 'pt-%@movenow.test' and (${final} or x.id <> '${admin}')
          and not exists (select 1 from public.partner_members m join public.partners p on p.id = m.partner_id where m.user_id = x.id and p.name = '${COVER_FIRM}') loop
          begin
            delete from auth.users where id = u.id;
          exception when others then null; -- Kunde oder Mitglied mit Journal, Zuordnung oder Angebot: bleibt
          end;
        end loop;
      end $sweep$;
      select count(*) filter (where p.status in ('active', 'payment_hold')) as active, count(*) filter (where not ${BOUND}) as unbound
        from public.partners p where ${TEST_FIRM};`)[0]
    left = { active: Number(r?.active), unbound: Number(r?.unbound) }
    if (!Number.isFinite(left.active) || !Number.isFinite(left.unbound)) throw new Error('Aufräumen: Restzählung ohne Ergebnis')
  } catch (e) {
    console.warn('Aufräumen fehlgeschlagen:', (e as Error).message.slice(0, 200))
    if (!final) throw e
  }
  if (left.active > 0 || left.unbound > 0) {
    const msg = `Aufräumen unvollständig: ${left.active} aktive, ${left.unbound} nicht gelöschte ungebundene Testfirmen übrig`
    if (final) console.warn(msg)
    else throw new Error(msg)
  }
}
