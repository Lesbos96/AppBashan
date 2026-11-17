// Nebenläufigkeit der Foto-Pipeline (S9d): (1) die letzten zwei Fotos werden gleichzeitig markiert: genau eine Verteilung, kein Deadlock;
// (2) zwei Belege gleichzeitig beim achten Foto: genau einer gewinnt. Echte Wettläufe brauchen committete Fixtures und getrennte Verbindungen;
// alles wird am Ende gelöscht (kein Journal im Spiel). Bezirk 21 hat keine committete Firma, die Fixtures bleiben unter sich.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ownerSql, ownerSqlAsync } from '../support/owner.ts'
import { firm, grantAdmin, insertUsers, newId, ownerDeletePartner } from '../support/partner.ts'

const U = { adm: newId(), cust: newId(), pa: newId(), pb: newId() }
const OV = { districts: 'array[21]::smallint[]' }
const startAt = (secs: number) => `select pg_sleep(greatest(0, extract(epoch from (timestamptz '${new Date(Date.now() + secs * 1000).toISOString()}' - clock_timestamp()))));`
const uid = () => crypto.randomUUID()

const request = (id: string) =>
  `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
     values ('${id}', '${U.cust}', gen_random_uuid(), 'move', 'requested', 21, now() + interval '14 days', now() + interval '1 day');
   insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
     values ('${id}', 1, 'submit', '{}', '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[]}', 1, 68961, 68961, 68961);
   update public.service_requests set current_revision = (select id from public.price_revisions where request_id = '${id}' and n = 1) where id = '${id}';`
const photo = (req: string) =>
  `select set_config('app.mv_photo_request', '${req}', true);
   insert into public.request_photos (request_id, storage_path) select '${req}', s.customer_id || '/' || s.client_ref || '/' || gen_random_uuid() || '.jpg' from public.service_requests s where s.id = '${req}';
   select set_config('app.mv_photo_request', '', true);`

const USERS = insertUsers(Object.values(U))
beforeAll(() => {
  ownerSql(`begin; ${USERS} ${grantAdmin(U.adm)} ${firm(U.pa, 'a', 'active', U.adm, OV)} ${firm(U.pb, 'b', 'active', U.adm, OV)} commit;`)
})

afterAll(() => {
  const step = (label: string, fn: () => void) => {
    try {
      fn()
    } catch (e) {
      console.warn(`Aufräumen (${label}) unvollständig:`, (e as Error).message.slice(0, 200))
    }
  }
  const firms = (ownerSql(`select partner_id as id from public.partner_members where user_id in ('${U.pa}', '${U.pb}')`) as { id: string }[]).map((r) => r.id)
  step('Kunde und Auftrag', () => ownerSql(`delete from auth.users where id = '${U.cust}'`))
  for (const id of firms) step('Firma', () => ownerDeletePartner(id))
  for (const u of [U.pa, U.pb, U.adm]) step('Nutzer', () => ownerSql(`delete from auth.users where id = '${u}'`))
})

describe('Foto-Pipeline unter Last', () => {
  it('die letzten zwei Fotos gleichzeitig markiert: genau eine Verteilung (je Firma ein Listing, eine Mail), kein Deadlock', async () => {
    const R = newId()
    ownerSql(`begin; ${request(R)} ${photo(R)} ${photo(R)}
      insert into public.job_photos (request_id, kind, source_photo_id, status, attempts, lease_until)
        select request_id, 'request', id, 'pending', 1, now() + interval '5 minutes' from public.request_photos where request_id = '${R}';
      commit;`)
    const jp = (i: number) => `(select id from public.job_photos where request_id = '${R}' order by id limit 1 offset ${i})`
    const mark = (i: number) => `begin; ${startAt(7)} set local role service_role; select public.photo_publish_mark(${jp(i)}, 1, false, null, null, 'decode_failed'); commit;`
    const runs = await Promise.all([ownerSqlAsync(mark(0)), ownerSqlAsync(mark(1))])
    expect(runs.map((r) => ('error' in r ? r.error : 'ok')), JSON.stringify(runs)).toEqual(['ok', 'ok'])

    const s = ownerSql(`select
      (select count(*) from public.job_photos where request_id = '${R}' and status = 'failed') as failed,
      (select count(*) from public.job_listings where request_id = '${R}') as listings,
      (select count(*) from public.outbox where request_id = '${R}' and kind = 'photo_failed') as photo_failed,
      (select count(*) from public.outbox where request_id = '${R}' and kind = 'listing_new') as listing_new,
      (select status::text from public.service_requests where id = '${R}') as status`)[0] as Record<string, string | number>
    expect([Number(s.failed), Number(s.listings), Number(s.photo_failed), Number(s.listing_new), s.status]).toEqual([2, 2, 1, 2, 'requested'])
  }, 480_000)

  it('zwei Belege gleichzeitig beim achten: genau einer gewinnt, danach acht Belege, der andere meldet receipt_limit', async () => {
    const R = newId()
    ownerSql(`begin; ${request(R)}
      select private.set_request_status('${R}', 'accepted', '${U.pa}', 'partner');
      insert into public.assignments (request_id, partner_id) select '${R}', m.partner_id from public.partner_members m where m.user_id = '${U.pa}';
      insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
        select '${R}', 'receipt', m.partner_id, 'ready', gen_random_uuid() || '.jpg', repeat(to_hex(g), 64), now() from public.partner_members m, generate_series(1, 7) g where m.user_id = '${U.pa}';
      commit;`)
    const files = [`${uid()}.jpg`, `${uid()}.jpg`]
    ownerSql(`insert into storage.objects (bucket_id, name) values ('job-photos', '${files[0]}'), ('job-photos', '${files[1]}')`)
    // bl1: verschiedene Bilder (Hash a und b, die sieben vorhandenen tragen 1 bis 7); gleiche Hashes wären nach dem Dedupe keine zwei Belege
    const add = (f: string, sha: string) =>
      `begin; ${startAt(7)} set local role service_role; select public.photo_receipt_add('${U.pa}', 'aal2', '${R}', '${f}', repeat('${sha}', 64)); commit;`
    const runs = await Promise.all(files.map((f, i) => ownerSqlAsync(add(f, i === 0 ? 'a' : 'b'))))
    const won = runs.filter((r) => 'rows' in r)
    const lost = runs.filter((r): r is { error: string } => 'error' in r)
    expect(won, JSON.stringify(runs)).toHaveLength(1)
    expect(lost).toHaveLength(1)
    expect(lost[0]?.error).toContain('receipt_limit')
    expect(Number((ownerSql(`select count(*) as n from public.job_photos where request_id = '${R}' and kind = 'receipt'`)[0] as { n: string }).n)).toBe(8)
    // die Objekte der Probe aus dem Bucket entfernen (Direktes Löschen schützt Supabase, der Schalter erlaubt es nur diesem Aufruf)
    try {
      ownerSql(`begin; set local storage.allow_delete_query = 'true'; delete from storage.objects where bucket_id = 'job-photos' and name in ('${files[0]}', '${files[1]}'); commit;`)
    } catch {
      console.warn('Objekte der Probe bleiben im Bucket; photo_purge entfernt sie als Waisen.')
    }
  }, 480_000)

  it('zwei gleiche Belege (gleicher Hash) gleichzeitig: beide Aufrufe gelingen, genau eine Zeile (bl1, n12-1)', async () => {
    const R = newId()
    ownerSql(`begin; ${request(R)}
      select private.set_request_status('${R}', 'accepted', '${U.pa}', 'partner');
      insert into public.assignments (request_id, partner_id) select '${R}', m.partner_id from public.partner_members m where m.user_id = '${U.pa}';
      commit;`)
    const files = [`${uid()}.jpg`, `${uid()}.jpg`]
    ownerSql(`insert into storage.objects (bucket_id, name) values ('job-photos', '${files[0]}'), ('job-photos', '${files[1]}')`)
    const add = (f: string) =>
      `begin; ${startAt(7)} set local role service_role; select public.photo_receipt_add('${U.pa}', 'aal2', '${R}', '${f}', repeat('e', 64)); commit;`
    const runs = await Promise.all(files.map((f) => ownerSqlAsync(add(f))))
    expect(runs.map((r) => ('error' in r ? r.error : 'ok')), JSON.stringify(runs)).toEqual(['ok', 'ok'])
    expect(Number((ownerSql(`select count(*) as n from public.job_photos where request_id = '${R}' and kind = 'receipt'`)[0] as { n: string }).n)).toBe(1)
    try {
      ownerSql(`begin; set local storage.allow_delete_query = 'true'; delete from storage.objects where bucket_id = 'job-photos' and name in ('${files[0]}', '${files[1]}'); commit;`)
    } catch {
      console.warn('Objekte der Probe bleiben im Bucket; photo_purge entfernt sie als Waisen.')
    }
  }, 480_000)
})
