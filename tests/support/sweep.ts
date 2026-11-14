// Aufräumen der Wettlauftests (committete Fixtures), auch Reste früherer Läufe. Ein einziger CLI-Aufruf je Aufruf der Funktion
// (ein DO-Block statt je Firma und Nutzer einer Abfrage); die Laufzeit hängt nicht mehr von der Zahl der Reste ab.
// Test-Marker: Nutzer pt-*@movenow.test, Firmen Kontaktadresse pt-firma-<8 Hex>@movenow.test. Journal, Zuordnungen, Angebote, Belege und Nachträge
// einer Firma sind unlöschbar (ON DELETE RESTRICT): solche Firmen werden gesperrt, damit sie nie Empfänger anderer Tests sind und bleiben als Waisen stehen
// (ihre Mitglieder gehen mit den Nutzern verloren); Nutzer, an denen Aufträge hängen, bleiben (OPEN_ISSUES S9c-7).
// Es darf nur ein test:rls-Lauf gleichzeitig auf Dev laufen (der Marker gehört keinem Lauf einzeln).
// Lösch-Gate (scripts/sys/gate-loesch-lib.mjs): beide Funktionen prüfen vor dem ersten Löschen die Freigabe dieser Datei und von marker.ts (docs/freigaben, im Commit) und
// protokollieren Lauf-ID und Zahlen in tmp/proof/<schritt>/loesch-lauf.jsonl. Ohne Freigabe: Fehler, auch bei `final`.
import '../../scripts/dev-guard.mjs'
import { loeschFreigabe, loeschLog } from '../../scripts/sys/gate-loesch-lib.mjs'
import { COVER_FIRM, FIRM_MAIL_RE } from './marker.ts'
import { ownerSql } from './owner.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const MAX_LOESCHEN = 1000 // Obergrenze je Aufruf für Testnutzer und Testfirmen; mehr deutet auf ein zu weites Muster, dann wird nichts gelöscht

// Testfirma = Marker-Kontaktadresse, nicht die Abdeckungsfirma und kein Mitglied außerhalb der Testkonten (pt-*@movenow.test).
// Die Mitgliedschaft ist kein Marker: sie geht mit dem Nutzer verloren (partner_members.user_id on delete cascade), die Firma bliebe unauffindbar.
const TEST_FIRM = `p.contact_email ~ '${FIRM_MAIL_RE}' and p.name <> '${COVER_FIRM}'
  and not exists (select 1 from public.partner_members m join auth.users x on x.id = m.user_id where m.partner_id = p.id and coalesce(x.email, '') not like 'pt-%@movenow.test')`
// Gebunden = etwas verweist mit RESTRICT auf die Firma (0030:57 Zuordnung, 0038:20 Angebot, 0028:13 Journal, 0035:20 Beleg, 0040:11 Nachtrag): nicht löschbar
const BOUND = `(exists (select 1 from public.assignments a where a.partner_id = p.id) or exists (select 1 from public.partner_offers o where o.partner_id = p.id)
  or exists (select 1 from public.commission_entries c where c.partner_id = p.id) or exists (select 1 from public.job_photos j where j.uploaded_partner_id = p.id)
  or exists (select 1 from public.price_revisions r where r.proposed_by = p.id))`

const UUID_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.jpg)?$/

/**
 * Löscht die Storage-Objekte der Belege von Testfirmen (Bucket job-photos, Pfade aus job_photos, nur über die Storage-API, s9i-7c2, Fable-Auflage 4).
 * Die Zeilen in job_photos bleiben (unlöschbar); nicht angefasst werden SQL-Deletes auf storage.objects, andere Buckets und Objekte ohne job_photos-Zeile.
 * Mehr als 50 Treffer oder ein Pfad ohne UUID-Muster: Abbruch ohne Löschen. Danach muss die Zählung 0 sein. Gibt die Zahl der gelöschten Objekte zurück.
 */
export async function sweepReceiptObjects(): Promise<number> {
  loeschFreigabe(import.meta.url)
  const { service } = await import('./db.ts')
  const exists = `exists (select 1 from storage.objects o where o.bucket_id = 'job-photos' and o.name = j.storage_path)`
  const sel = `from public.job_photos j join public.partners p on p.id = j.uploaded_partner_id where j.kind = 'receipt' and ${TEST_FIRM} and ${exists}`
  const paths = ownerSql(`select j.storage_path as p ${sel}`).map((r) => String(r.p))
  if (paths.length > 50 || paths.some((p) => !UUID_FILE.test(p))) throw new Error(`Belegobjekte: ${paths.length} Treffer oder ungültiger Pfad, nichts gelöscht`)
  if (paths.length === 0) return 0
  const { error } = await service.storage.from('job-photos').remove(paths)
  if (error) throw error
  const left = Number(ownerSql(`select count(*) as n ${sel}`)[0]?.n)
  loeschLog('tests/support/sweep.ts', { belegObjekteGeloescht: paths.length, belegObjekteRest: left })
  if (left !== 0) throw new Error(`Belegobjekte: ${left} nach dem Löschen noch vorhanden`)
  return paths.length
}

/**
 * Räumt Testfirmen und Testnutzer auf; `admin` ist der Akteur der Sperren und bleibt, außer bei `final` (dann wird auch er versucht).
 * Ein Fehler bei einer Firma betrifft nur diese. Am Anfang eines Tests (`final` aus) wirft die Funktion, wenn danach noch aktive oder
 * ungebundene (also nicht gelöschte) Testfirmen übrig sind (sie wären Empfänger fremder Tests); im `afterAll` (`final`) bleibt es bei einer Warnung.
 */
export function sweepTestResidue(admin: string, final = false) {
  loeschFreigabe(import.meta.url) // vor dem try: ein fehlender Freigabe-Nachweis darf auch bei `final` nicht zur Warnung werden
  if (!UUID.test(admin)) throw new Error('Aufräumen: admin ist keine UUID, nichts gelöscht')
  let left = { active: 0, unbound: 0 }
  try {
    const r = ownerSql(`do $sweep$
      declare f record; u record;
      begin
        if (select count(*) from auth.users where email like 'pt-%@movenow.test') > ${MAX_LOESCHEN}
          or (select count(*) from public.partners p where ${TEST_FIRM}) > ${MAX_LOESCHEN} then
          raise exception 'sweep: mehr als ${MAX_LOESCHEN} Testnutzer oder Testfirmen, nichts gelöscht';
        end if;
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
          exception when others then null; -- Kunde mit Aufträgen oder Journal (Auftrag, Journal, Zuordnung): das Konto bleibt
          end;
        end loop;
      end $sweep$;
      select count(*) filter (where p.status in ('active', 'payment_hold')) as active, count(*) filter (where not ${BOUND}) as unbound
        from public.partners p where ${TEST_FIRM};`)[0]
    left = { active: Number(r?.active), unbound: Number(r?.unbound) }
    if (!Number.isFinite(left.active) || !Number.isFinite(left.unbound)) throw new Error('Aufräumen: Restzählung ohne Ergebnis')
    loeschLog('tests/support/sweep.ts', { testfirmenAktivNach: left.active, testfirmenUngebundenNach: left.unbound }, { final })
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
