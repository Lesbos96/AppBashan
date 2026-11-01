// S9a-1: Preisversionen und Gebührensätze unveränderlich, Admin-Funktionen, aal2-Admin (Migrationen 0015, 0016).
// Start: npm run test:rls. Zerstörerische Prüfungen laufen als Eigentümer-SQL in begin … rollback (tests/support/owner.ts),
// nichts wird dauerhaft veröffentlicht. API-Tests ändern nur die unveröffentlichte Version TEST_VERSION.
// Jede Verweigerung hat einen erlaubten Gegenfall (Schritte mit „_ok“ im Namen).
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { anon, deleteUsers, makeUser, must, run, service, type TestUser } from '../support/db.ts'
import { ownerGrantRole, ownerSql, probes, type Step } from '../support/owner.ts'

const TEST_VERSION = 9998
const NIL = '00000000-0000-4000-8000-0000000000ff'
let cust: TestUser
let adm: TestUser

const today = `(now() at time zone 'Europe/Vienna')::date`

beforeAll(async () => {
  await service.from('price_config').delete().eq('version', TEST_VERSION)
  await service.from('price_versions').delete().eq('version', TEST_VERSION)
  cust = await makeUser('einst-kunde')
  adm = await makeUser('einst-admin')
  ownerGrantRole(adm.id, 'admin')
})

afterAll(async () => {
  await service.from('price_config').delete().eq('version', TEST_VERSION)
  await service.from('price_versions').delete().eq('version', TEST_VERSION)
  await deleteUsers()
})

const expectAll = (got: Record<string, string>, expected: Record<string, string | RegExp>) => {
  for (const [name, want] of Object.entries(expected)) {
    if (typeof want === 'string') expect(got[name], name).toBe(want)
    else expect(got[name], name).toMatch(want)
  }
  expect(Object.keys(got).sort()).toEqual(Object.keys(expected).sort())
}

describe('veröffentlichte Preisversion ist unveränderlich (Trigger, auch gegen service_role)', () => {
  // 9996 ist veröffentlicht (nur in dieser Transaktion), 9995 nicht.
  const setup = () => `
    select public.admin_create_price_version('${adm.id}', 9996, date '2999-01-01', 'probe');
    select public.admin_set_price_config('${adm.id}', 9996, 'b', 2, 'cent', 'b');
    select public.admin_set_price_config('${adm.id}', 9996, 'a', 1, 'cent', 'a');
    select public.admin_create_price_version('${adm.id}', 9995, date '2999-01-01', 'probe');
    select public.admin_set_price_config('${adm.id}', 9995, 'k', 1, 'cent', 'k');
    select public.admin_create_price_version('${adm.id}', 9993, date '2999-01-01', 'leer');
    select public.publish_version('${adm.id}', 9996)`
  const svc = (name: string, sql: string): Step => ({ name, sql, as: 'service_role' })

  it('Änderungen jeder Art werden verweigert, die unveröffentlichte Version bleibt änderbar', () => {
    const got = probes(setup(), [
      { name: 'hash_kanonisch_ok', sql: `?(select content_hash = encode(sha256(convert_to('{"rows": [["a", 1, "cent", "a", [], null], ["b", 2, "cent", "b", [], null]], "version": 9996, "effective_on": "2999-01-01"}', 'UTF8')), 'hex') and published and published_at is not null from public.price_versions where version = 9996)` },
      { name: 'hash_gleich_publish_ok', sql: `?(select content_hash = private.price_version_hash(9996) from public.price_versions where version = 9996)` },
      svc('verify_ok', `perform public.verify_price_version(9996)`),
      svc('update_version', `update public.price_versions set note = 'x' where version = 9996`),
      svc('delete_version', `delete from public.price_versions where version = 9996`),
      svc('unpublish', `update public.price_versions set published = false where version = 9996`),
      svc('insert_config', `insert into public.price_config (version, key, value, unit, label) values (9996, 'c', 1, 'cent', 'c')`),
      svc('update_config', `update public.price_config set value = 9 where version = 9996 and key = 'a'`),
      svc('delete_config', `delete from public.price_config where version = 9996 and key = 'a'`),
      svc('move_into', `update public.price_config set version = 9996 where version = 9995 and key = 'k'`),
      svc('move_out', `update public.price_config set version = 9995 where version = 9996 and key = 'a'`),
      svc('truncate_config', `truncate public.price_config`),
      svc('truncate_versions', `truncate public.price_versions`),
      svc('publish_again', `perform public.publish_version('${adm.id}', 9996)`),
      svc('publish_by_customer', `perform public.publish_version('${cust.id}', 9995)`),
      svc('publish_empty', `perform public.publish_version('${adm.id}', 9993)`),
      svc('flag_without_marker', `update public.price_versions set published = true where version = 9995`),
      svc('insert_published', `insert into public.price_versions (version, effective_on, published) values (9994, date '2999-01-01', true)`),
      svc('unpublished_version_ok', `update public.price_versions set note = 'geändert' where version = 9995`),
      svc('unpublished_config_ok', `update public.price_config set value = 5 where version = 9995 and key = 'k'`),
      svc('unpublished_config_delete_ok', `delete from public.price_config where version = 9995 and key = 'k'`),
      // Gegenprobe Hash: Inhalt am Trigger vorbei ändern (nur Eigentümer), dann erkennt die Prüffunktion es
      { name: 'tamper', sql: `alter table public.price_config disable trigger guard_price_config; update public.price_config set value = 5 where version = 9996 and key = 'a'; alter table public.price_config enable trigger guard_price_config` },
      svc('verify_mismatch', `perform public.verify_price_version(9996)`),
      svc('verify_unpublished', `perform public.verify_price_version(9993)`),
    ])
    expectAll(got, {
      hash_kanonisch_ok: 'ok',
      hash_gleich_publish_ok: 'ok',
      verify_ok: 'ok',
      update_version: 'P0001: version_published',
      delete_version: 'P0001: version_published',
      unpublish: 'P0001: version_published',
      insert_config: 'P0001: version_published',
      update_config: 'P0001: version_published',
      delete_config: 'P0001: version_published',
      move_into: 'P0001: version_published',
      move_out: 'P0001: version_published',
      truncate_config: '42501: permission denied for table price_config',
      truncate_versions: '42501: permission denied for table price_versions',
      publish_again: 'P0001: version_published',
      publish_by_customer: '42501: not_admin',
      publish_empty: 'P0001: not_found',
      flag_without_marker: 'P0001: field_immutable',
      insert_published: 'P0001: field_immutable',
      unpublished_version_ok: 'ok',
      unpublished_config_ok: 'ok',
      unpublished_config_delete_ok: 'ok',
      tamper: 'ok',
      verify_mismatch: 'P0001: version_hash_mismatch',
      verify_unpublished: 'P0001: not_found',
    })
  })

  it('über die API: authenticated und admin (aal1) verweigert (42501), service_role bekommt version_published', async () => {
    const v1 = must(await service.from('price_versions').select('note').eq('version', 1).single())
    for (const db of [cust.db, adm.db]) {
      expect((await db.from('price_versions').update({ note: v1.note }).eq('version', 1)).error?.code).toBe('42501')
      expect((await db.from('price_versions').insert({ version: 9997, effective_on: '2999-01-01' })).error?.code).toBe('42501')
      expect((await db.from('price_config').update({ value: 1 }).eq('version', 1)).error?.code).toBe('42501')
    }
    // Gleicher Wert wie vorher: bricht die Sperre, ändert sich nichts.
    expect((await service.from('price_versions').update({ note: v1.note }).eq('version', 1)).error).toMatchObject({ code: 'P0001', message: 'version_published' })
    // Gegenfall: unveröffentlichte Version über den Admin-Weg anlegbar und per service_role änderbar
    expect((await service.rpc('admin_create_price_version', { p_actor: adm.id, p_version: TEST_VERSION, p_effective_on: '2999-01-01', p_note: `lauf ${run}` })).error).toBeNull()
    expect((await service.from('price_versions').update({ note: `lauf ${run} b` }).eq('version', TEST_VERSION)).error).toBeNull()
    expect(must(await service.from('price_versions').select('published').eq('version', TEST_VERSION).single()).published).toBe(false)
  })
})

describe('Admin-Funktionen: nur service_role bzw. Eigentümer, nur für Rolle admin', () => {
  const calls = (): [string, Record<string, unknown>][] => [
    ['publish_version', { p_actor: adm.id, p_version: TEST_VERSION }],
    ['admin_create_price_version', { p_actor: adm.id, p_version: 9997, p_effective_on: '2999-01-01' }],
    ['admin_set_price_config', { p_actor: adm.id, p_version: TEST_VERSION, p_key: 'x', p_value: 1, p_unit: 'cent', p_label: 'x' }],
    ['admin_set_setting', { p_actor: adm.id, p_key: 'offers_open_max', p_value: 3, p_effective_from: '2999-01-01' }],
    ['verify_price_version', { p_version: 1 }],
    ['admin_grant_role', { p_user: cust.id, p_role: 'admin' }],
  ]

  it.each(['anon', 'customer', 'admin'] as const)('%s ruft keine Admin-Funktion auf (42501)', async (who) => {
    const db = who === 'anon' ? anon : who === 'customer' ? cust.db : adm.db
    for (const [name, args] of calls()) {
      const { error } = await db.rpc(name as never, args as never)
      expect(error?.code, name).toBe('42501')
      expect(error?.message, name).toContain(`permission denied for function ${name}`)
    }
  })

  it('admin_grant_role ist auch für service_role gesperrt; die anderen erreicht service_role (Gegenfall)', async () => {
    const grant = await service.rpc('admin_grant_role' as never, { p_user: cust.id, p_role: 'admin' } as never)
    expect(grant.error?.code).toBe('42501')
    expect(grant.error?.message).toContain('permission denied for function admin_grant_role')
    expect((await service.rpc('verify_price_version', { p_version: 1 })).error).toBeNull()
    expect((await service.rpc('admin_set_price_config', { p_actor: cust.id, p_version: TEST_VERSION, p_key: 'x', p_value: 1, p_unit: 'cent', p_label: 'x' })).error).toMatchObject({
      code: '42501',
      message: 'not_admin',
    })
    // Rolle bleibt customer
    expect(must(await service.from('profiles').select('role').eq('id', cust.id).single()).role).toBe('customer')
  })

  it('erlaubt: admin (p_actor) legt eine Konfigurationszeile in der unveröffentlichten Version an und das Journal hält es fest', async () => {
    expect((await service.rpc('admin_set_price_config', { p_actor: adm.id, p_version: TEST_VERSION, p_key: `rls.test.${run}`, p_value: 7, p_unit: 'cent', p_label: 'Test' })).error).toBeNull()
    expect(must(await service.from('price_config').select('value').eq('version', TEST_VERSION).eq('key', `rls.test.${run}`).single()).value).toBe(7)
    const log = must(await service.from('audit_log').select('actor_id, actor_role, action').eq('entity_id', `${TEST_VERSION}/rls.test.${run}`))
    expect(log).toEqual([{ actor_id: adm.id, actor_role: 'admin', action: 'set_price_config' }])
  })
})

describe('Gebührensätze und Einstellungen', () => {
  const setup = `select 1`
  const svc = (name: string, sql: string): Step => ({ name, sql, as: 'service_role' })
  const ins = (key: string, version: number, value: string, from: string) =>
    `insert into public.platform_settings (key, version, value, effective_from) values ('${key}', ${version}, ${value}, ${from})`

  it('Vorlauf, Unveränderlichkeit, Wertebereich', () => {
    const got = probes(setup, [
      svc('fee_short', ins('fee_rate', 2, '0.16', `${today} + 29`)),
      svc('fee_ok', ins('fee_rate', 2, '0.16', `${today} + 30`)),
      svc('fee_update_future', `update public.platform_settings set value = 0.17 where key = 'fee_rate' and version = 2`),
      svc('fee_update_current', `update public.platform_settings set value = 0.15 where key = 'fee_rate' and version = 1`),
      svc('fee_delete_current', `delete from public.platform_settings where key = 'fee_rate' and version = 1`),
      svc('fee_delete_future_ok', `delete from public.platform_settings where key = 'fee_rate' and version = 2`),
      svc('vat_short', ins('fee_vat_rate', 2, '0.2', `${today} + 10`)),
      svc('vat_ok', ins('fee_vat_rate', 2, '0.2', `${today} + 31`)),
      svc('notice_short', ins('fee_notice_days', 2, '15', `${today} + 29`)),
      svc('notice_ok', ins('fee_notice_days', 2, '15', `${today} + 30`)),
      svc('notice_below_15', ins('fee_notice_days', 3, '14', `${today} + 30`)),
      svc('fee_rename', `update public.platform_settings set key = 'fee_rate_x' where key = 'fee_rate' and version = 1`),
      svc('fee_scale', ins('fee_rate', 8, '0.12345', `${today} + 400`)),
      // das verkürzte Vorlauf-Datum liegt in der Zukunft: bis dahin gelten weiter 30 Tage
      svc('notice_still_30', ins('fee_rate', 3, '0.18', `${today} + 29`)),
      svc('other_key_free_ok', ins('price_hold_minutes', 2, '45', today)),
      svc('other_key_update_ok', `update public.platform_settings set value = 40 where key = 'price_hold_minutes' and version = 2`),
      svc('rate_range', ins('fee_rate', 9, '1.5', `${today} + 400`)),
      svc('window_fraction', ins('window_start_morning', 2, '480.5', today)),
      svc('window_1440', ins('window_start_morning', 3, '1440', today)),
      svc('window_ok', ins('window_start_morning', 4, '481', today)),
      svc('truncate', `truncate public.platform_settings`),
      svc('set_ok', `perform public.admin_set_setting('${adm.id}', 'fee_rate', 0.16, ${today} + 30)`),
      svc('set_short', `perform public.admin_set_setting('${adm.id}', 'fee_vat_rate', 0.2, ${today} + 29)`),
      svc('set_customer', `perform public.admin_set_setting('${cust.id}', 'offers_open_max', 4, ${today})`),
      svc('set_delete_future_ok', `perform public.admin_set_setting('${adm.id}', 'fee_rate', null, ${today} + 30)`),
      svc('set_delete_current', `perform public.admin_set_setting('${adm.id}', 'fee_rate', null, date '2026-10-28')`),
      { name: 'rates_view_ok', sql: `?(select fee_rate = 0.15 and fee_vat_rate = 0.2 and fee_rate_from = date '2026-10-28' from public.current_fee_rates)` },
    ])
    expect(got.rate_range).toMatch(/^23514: .*platform_settings_rates/)
    expect(got.window_fraction).toMatch(/^23514: .*platform_settings_window_start/)
    expect(got.window_1440).toMatch(/^23514: .*platform_settings_window_start/)
    expect(got.notice_below_15).toMatch(/^23514: .*platform_settings_notice/)
    expect(got.fee_scale).toMatch(/^23514: .*platform_settings_rates/)
    delete got.notice_below_15
    delete got.fee_scale
    delete got.rate_range
    delete got.window_fraction
    delete got.window_1440
    expectAll(got, {
      fee_short: 'P0001: fee_rate_notice',
      fee_ok: 'ok',
      fee_rename: 'P0001: fee_rate_immutable',
      fee_update_future: 'P0001: fee_rate_immutable',
      fee_update_current: 'P0001: fee_rate_immutable',
      fee_delete_current: 'P0001: fee_rate_immutable',
      fee_delete_future_ok: 'ok',
      vat_short: 'P0001: fee_rate_notice',
      vat_ok: 'ok',
      notice_short: 'P0001: fee_rate_notice',
      notice_ok: 'ok',
      notice_still_30: 'P0001: fee_rate_notice',
      other_key_free_ok: 'ok',
      other_key_update_ok: 'ok',
      window_ok: 'ok',
      truncate: '42501: permission denied for table platform_settings',
      set_ok: 'ok',
      set_short: 'P0001: fee_rate_notice',
      set_customer: '42501: not_admin',
      set_delete_future_ok: 'ok',
      set_delete_current: 'P0001: not_found',
      rates_view_ok: 'ok',
    })
  })

  it('Schreiben über die API: admin (aal1) und Kunde verweigert (42501), keine Schreib-Grants', async () => {
    for (const db of [cust.db, adm.db]) {
      const row = { key: 'offers_open_max', version: 99, value: 1, effective_from: '2999-01-01' }
      expect((await db.from('platform_settings').insert(row)).error?.code).toBe('42501')
      expect((await db.from('platform_settings').update({ value: 1 }).eq('key', 'offers_open_max')).error?.code).toBe('42501')
      expect((await db.from('platform_settings').delete().eq('key', 'offers_open_max')).error?.code).toBe('42501')
    }
  })

  it('booking_terms: fünf Werte und termsHash, kein fee_*, für anon und Kunden', async () => {
    const stored = Object.fromEntries(
      ownerSql(`select key, value::text as value from public.platform_settings where key like 'cancel\\_%' or key = 'call_out_fee_cents' order by key`).map((r) => [String(r.key), String(r.value)]),
    )
    const order = ['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents']
    const expectedHash = createHash('sha256').update(order.map((k) => `${k}=${stored[k]}\n`).join('')).digest('hex')
    for (const db of [anon, cust.db]) {
      const terms = must(await db.rpc('booking_terms')) as Record<string, unknown>
      expect(Object.keys(terms).sort()).toEqual([...order, 'termsHash'].sort())
      expect(terms.termsHash).toBe(expectedHash)
      expect(terms.call_out_fee_cents).toBe(6900)
      expect(JSON.stringify(terms)).not.toMatch(/fee_rate|fee_vat/)
    }
  })
})

describe('audit_log, Rollen, aal2-Admin', () => {
  const svc = (name: string, sql: string): Step => ({ name, sql, as: 'service_role' })
  const asA = (name: string, who: string, aal: 'aal1' | 'aal2', sql: string): Step => ({ name, sql, as: 'authenticated', claims: { sub: who, aal } })
  // Journal-Zeile und unveröffentlichte Version 9995 stehen nur in dieser Transaktion
  const setup = () => `
    select public.admin_create_price_version('${adm.id}', 9995, date '2999-01-01', 'probe')`

  it('audit_log nur anfügen; Lesen nur admin mit aal2; profiles.role nur mit Marker', () => {
    const got = probes(setup(), [
      { name: 'audit_update_owner', sql: `update public.audit_log set action = 'x'` },
      { name: 'audit_delete_owner', sql: `delete from public.audit_log` },
      svc('audit_update_service', `update public.audit_log set action = 'x'`),
      svc('audit_delete_service', `delete from public.audit_log`),
      svc('audit_truncate_service', `truncate public.audit_log`),
      { name: 'audit_truncate_owner', sql: `truncate public.audit_log` },
      { name: 'settings_truncate_owner', sql: `truncate public.platform_settings` },
      { name: 'config_truncate_owner', sql: `truncate public.price_config` },
      svc('audit_insert_ok', `insert into public.audit_log (actor_role, action, entity) values ('system', 'probe', 'test')`),
      asA('audit_read_aal2_ok', adm.id, 'aal2', `?(select count(*) >= 1 from public.audit_log)`),
      asA('audit_read_aal1', adm.id, 'aal1', `?(select count(*) = 0 from public.audit_log)`),
      asA('audit_read_customer', cust.id, 'aal2', `?(select count(*) = 0 from public.audit_log)`),
      { name: 'audit_anon', sql: `perform count(*) from public.audit_log`, as: 'anon' },
      asA('is_admin_aal2_ok', adm.id, 'aal2', `?(select private.is_admin())`),
      asA('is_admin_aal1', adm.id, 'aal1', `?(not (select private.is_admin()))`),
      asA('is_admin_customer', cust.id, 'aal2', `?(not (select private.is_admin()))`),
      asA('unpublished_admin_aal2_ok', adm.id, 'aal2', `?(select count(*) = 1 from public.price_versions where version = 9995)`),
      asA('unpublished_admin_aal1', adm.id, 'aal1', `?(select count(*) = 0 from public.price_versions where version = 9995)`),
      { name: 'unpublished_anon', sql: `?(select count(*) = 0 from public.price_versions where version = 9995)`, as: 'anon' },
      { name: 'published_anon_ok', sql: `?(select count(*) = 1 from public.price_versions where version = 1)`, as: 'anon' },
      asA('profiles_admin_aal2_ok', adm.id, 'aal2', `?(select count(*) > 1 from public.profiles)`),
      asA('profiles_admin_aal1', adm.id, 'aal1', `?(select count(*) = 1 from public.profiles)`),
      svc('profile_id_swap', `update public.profiles set id = '${NIL}' where id = '${cust.id}'`),
      svc('role_update', `update public.profiles set role = 'admin' where id = '${cust.id}'`),
      svc('role_insert', `insert into public.profiles (id, role) values ('${cust.id}', 'admin')`),
      svc('name_update_ok', `update public.profiles set display_name = 'Test' where id = '${cust.id}'`),
      { name: 'grant_not_found', sql: `perform public.admin_grant_role('${NIL}', 'admin')` },
      { name: 'grant_ok', sql: `perform public.admin_grant_role('${cust.id}', 'rental_provider')` },
      { name: 'grant_audit_ok', sql: `?(select count(*) = 1 from public.audit_log where action = 'grant_role' and actor_role = 'owner' and entity_id = '${cust.id}' and detail = '{"role": "rental_provider"}')` },
      { name: 'grant_effect_ok', sql: `?(select role = 'rental_provider' from public.profiles where id = '${cust.id}')` },
    ])
    expectAll(got, {
      audit_update_owner: 'P0001: append_only',
      audit_delete_owner: 'P0001: append_only',
      audit_update_service: '42501: permission denied for table audit_log',
      audit_delete_service: '42501: permission denied for table audit_log',
      audit_truncate_service: '42501: permission denied for table audit_log',
      audit_truncate_owner: 'P0001: append_only',
      settings_truncate_owner: 'P0001: append_only',
      config_truncate_owner: 'P0001: append_only',
      audit_insert_ok: 'ok',
      audit_read_aal2_ok: 'ok',
      audit_read_aal1: 'ok',
      audit_read_customer: 'ok',
      audit_anon: '42501: permission denied for table audit_log',
      is_admin_aal2_ok: 'ok',
      is_admin_aal1: 'ok',
      is_admin_customer: 'ok',
      unpublished_admin_aal2_ok: 'ok',
      unpublished_admin_aal1: 'ok',
      unpublished_anon: 'ok',
      published_anon_ok: 'ok',
      profiles_admin_aal2_ok: 'ok',
      profiles_admin_aal1: 'ok',
      profile_id_swap: 'P0001: field_immutable',
      role_update: 'P0001: field_immutable',
      role_insert: 'P0001: field_immutable',
      name_update_ok: 'ok',
      grant_not_found: 'P0001: not_found',
      grant_ok: 'ok',
      grant_audit_ok: 'ok',
      grant_effect_ok: 'ok',
    })
  })

  it('become_rental_provider bleibt der Weg zur Vermieter-Rolle (Marker im eigenen Konto)', async () => {
    expect(must(await cust.db.rpc('become_rental_provider'))).toBe('rental_provider')
    expect(must(await service.from('profiles').select('role').eq('id', cust.id).single()).role).toBe('rental_provider')
    expect(must(await adm.db.rpc('become_rental_provider'))).toBe('admin')
  })
})
