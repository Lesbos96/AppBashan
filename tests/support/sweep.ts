// Aufräumen der Wettlauftests (committete Fixtures), auch Reste früherer Läufe. Ein einziger CLI-Aufruf je Aufruf der Funktion
// (ein DO-Block statt je Firma und Nutzer einer Abfrage); die Laufzeit hängt nicht mehr von der Zahl der Reste ab.
// Test-Marker: E-Mail pt-*@movenow.test. Journal, Zuordnungen und Angebote sind unlöschbar (ON DELETE RESTRICT): Firmen damit werden
// gesperrt, damit sie nie Empfänger anderer Tests sind; Nutzer, an denen etwas hängt, bleiben (OPEN_ISSUES S9c-7).
// Es darf nur ein test:rls-Lauf gleichzeitig auf Dev laufen (der Marker gehört keinem Lauf einzeln).
import '../../scripts/dev-guard.mjs'
import { ownerSql } from './owner.ts'
import { COVER_FIRM } from './partner.ts'

/**
 * Räumt Testfirmen und Testnutzer auf; `admin` ist der Akteur der Sperren und bleibt, außer bei `final` (dann wird auch er versucht).
 * Ein Fehler bei einer Firma betrifft nur diese. Am Anfang eines Tests (`final` aus) wirft die Funktion, wenn danach noch aktive Testfirmen
 * übrig sind (sie wären Empfänger fremder Tests); im `afterAll` (`final`) bleibt es bei einer Warnung.
 */
export function sweepTestResidue(admin: string, final = false) {
  let left = 0
  try {
    left = Number(
      ownerSql(`do $sweep$
      declare f record; u record;
      begin
        for f in select distinct p.id, p.status::text as st,
            (exists (select 1 from public.assignments a where a.partner_id = p.id) or exists (select 1 from public.partner_offers o where o.partner_id = p.id)) as bound
          from public.partners p join public.partner_members m on m.partner_id = p.id join auth.users x on x.id = m.user_id
          where x.email like 'pt-%@movenow.test' and p.name <> '${COVER_FIRM}' loop
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
      select count(*) as n from public.partners p join public.partner_members m on m.partner_id = p.id join auth.users x on x.id = m.user_id
        where x.email like 'pt-%@movenow.test' and p.name <> '${COVER_FIRM}' and p.status in ('active', 'payment_hold');`)[0]?.n,
    )
  } catch (e) {
    console.warn('Aufräumen fehlgeschlagen:', (e as Error).message.slice(0, 200))
    if (!final) throw e
  }
  if (left > 0) {
    const msg = `Aufräumen unvollständig: ${left} aktive Testfirmen übrig`
    if (final) console.warn(msg)
    else throw new Error(msg)
  }
}
