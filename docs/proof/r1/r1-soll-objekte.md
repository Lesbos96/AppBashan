# Soll-Gegenprüfung Migration ↔ Dev

Stand 2026-11-07T16:10:18.966Z (nur Selects). Migrationen: 22, letzte 20261103120000_0022_no_self_upgrade.sql.

Zeilen je Ergebnis: gleich 266.
Unbenannte Constraints ohne ableitbaren Namen (nicht geprüft): 0. Umbenennungen/alter policy ohne create (Warnung): 0.

## Zielliste: von s9a1 bis s9a4 gelockerte Objekte

| Art | Name | Ergebnis | Migration |
|---|---|---|---|
| function | `private.assert_admin/1` | gleich (roh gleich) | 20261101160000_0015_versions_published.sql |
| function | `private.guard_photo_insert/0` | gleich (roh gleich) | 20261102120000_0021_photo_limits.sql |
| function | `private.guard_platform_setting/0` | gleich (roh gleich) | 20261101170000_0016_settings_admin.sql |
| function | `private.guard_price_version/0` | gleich (roh gleich) | 20261101160000_0015_versions_published.sql |
| function | `private.guard_profile_role/0` | gleich (roh gleich) | 20261101170000_0016_settings_admin.sql |
| function | `private.guard_request_status/0` | gleich (roh gleich) | 20261101180000_0017_status_machine.sql |
| function | `private.guard_revision_insert/0` | gleich (roh gleich) | 20261101190000_0018_revisions_contacts.sql |
| function | `private.is_admin/0` | gleich (roh gleich) | 20261101160000_0015_versions_published.sql |
| function | `private.staging_photo_count/0` | gleich (roh gleich) | 20261103120000_0022_no_self_upgrade.sql |
| function | `public.booking_terms/0` | gleich (roh gleich) | 20261101170000_0016_settings_admin.sql |
| function | `public.photo_orphans/0` | gleich (roh gleich) | 20261102110000_0020_photo_staging.sql |
| function | `public.photo_staging_interval/0` | gleich (roh gleich) | 20261102110000_0020_photo_staging.sql |
| function | `public.publish_version/2` | gleich (roh gleich) | 20261101160000_0015_versions_published.sql |
| function | `public.quote_district/2` | gleich (roh gleich) | 20261102100000_0019_quote_hardening.sql |
| function | `public.quote_save_request/25` | gleich (roh gleich) | 20261102110000_0020_photo_staging.sql |
| function | `public.verify_price_version/1` | gleich (roh gleich) | 20261101160000_0015_versions_published.sql |
| policy | `public.request_photos.request_photos_select` | gleich | 20261102110000_0020_photo_staging.sql |
| policy | `storage.objects.request_photos_objects_delete` | gleich | 20261102120000_0021_photo_limits.sql |
| policy | `storage.objects.request_photos_objects_insert` | gleich | 20261102120000_0021_photo_limits.sql |
| policy | `storage.objects.request_photos_objects_select` | gleich | 20261102110000_0020_photo_staging.sql |
| trigger | `public.request_photos.guard_photo_insert` | gleich | 20261102110000_0020_photo_staging.sql |
| trigger | `public.request_photos.photo_immutable` | gleich | 20261102110000_0020_photo_staging.sql |
| trigger | `public.request_photos.photo_immutable_truncate` | gleich | 20261102110000_0020_photo_staging.sql |
| trigger | `public.service_requests.request_delete_guard` | gleich | 20261101190000_0018_revisions_contacts.sql |

## Plattformobjekte (ausdrückliche Ausnahmeliste, Supabase-eigen)

| Art | Name | Ergebnis | Begründung |
|---|---|---|---|
| trigger | `storage.objects.protect_objects_delete` | gleich (Plattformobjekt) | Supabase Storage sperrt direktes DELETE auf storage.objects (Dateien nur über die Storage-API löschen); gehört zum Storage-Schema, nicht zu unseren Migrationen. |
| trigger | `storage.objects.update_objects_updated_at` | gleich (Plattformobjekt) | Supabase Storage pflegt updated_at bei jedem UPDATE auf storage.objects; gehört zum Storage-Schema, nicht zu unseren Migrationen. |

## Alle Zeilen außer „gleich“ (beide Ausdrücke)


## Funktionen (Körper gegen letzte Fundstelle)

| Art | Name | Ergebnis | Migration |
|---|---|---|---|
| function | `private.append_only/0` | gleich (roh gleich) | 20261101160000_0015_versions_published.sql |
| function | `private.assert_admin/1` | gleich (roh gleich) | 20261101160000_0015_versions_published.sql |
| function | `private.do_publish/3` | gleich (roh gleich) | 20261101160000_0015_versions_published.sql |
| function | `private.geo_boundaries_make_valid/0` | gleich (roh gleich) | 20261029214738_0007_geo_boundaries_valid.sql |
| function | `private.guard_photo_insert/0` | gleich (roh gleich) | 20261102120000_0021_photo_limits.sql |
| function | `private.guard_platform_setting/0` | gleich (roh gleich) | 20261101170000_0016_settings_admin.sql |
| function | `private.guard_price_config/0` | gleich (roh gleich) | 20261101160000_0015_versions_published.sql |
| function | `private.guard_price_version/0` | gleich (roh gleich) | 20261101160000_0015_versions_published.sql |
| function | `private.guard_profile_role/0` | gleich (roh gleich) | 20261101170000_0016_settings_admin.sql |
| function | `private.guard_rental_status/0` | gleich (roh gleich) | 20261101180000_0017_status_machine.sql |
| function | `private.guard_request_fields/0` | gleich (roh gleich) | 20261101190000_0018_revisions_contacts.sql |
| function | `private.guard_request_insert/0` | gleich (roh gleich) | 20261101180000_0017_status_machine.sql |
| function | `private.guard_request_pointer/0` | gleich (roh gleich) | 20261101190000_0018_revisions_contacts.sql |
| function | `private.guard_request_status/0` | gleich (roh gleich) | 20261101180000_0017_status_machine.sql |
| function | `private.guard_revision_insert/0` | gleich (roh gleich) | 20261101190000_0018_revisions_contacts.sql |
| function | `private.handle_new_user/0` | gleich (roh gleich) | 20261029141616_0001_foundation.sql |
| function | `private.immutable_row/0` | gleich (roh gleich) | 20261101180000_0017_status_machine.sql |
| function | `private.is_admin/0` | gleich (roh gleich) | 20261101160000_0015_versions_published.sql |
| function | `private.log_request_status/0` | gleich (roh gleich) | 20261101180000_0017_status_machine.sql |
| function | `private.my_role/0` | gleich (roh gleich) | 20261029141616_0001_foundation.sql |
| function | `private.price_version_hash/1` | gleich (roh gleich) | 20261101160000_0015_versions_published.sql |
| function | `private.publish_seed_version/1` | gleich (roh gleich) | 20261101160000_0015_versions_published.sql |
| function | `private.require_revision/0` | gleich (roh gleich) | 20261101190000_0018_revisions_contacts.sql |
| function | `private.staging_photo_count/0` | gleich (roh gleich) | 20261103120000_0022_no_self_upgrade.sql |
| function | `public.admin_create_price_version/4` | gleich (roh gleich) | 20261101160000_0015_versions_published.sql |
| function | `public.admin_grant_role/2` | gleich (roh gleich) | 20261101170000_0016_settings_admin.sql |
| function | `public.admin_set_price_config/8` | gleich (roh gleich) | 20261101160000_0015_versions_published.sql |
| function | `public.admin_set_setting/5` | gleich (roh gleich) | 20261101170000_0016_settings_admin.sql |
| function | `public.booking_terms/0` | gleich (roh gleich) | 20261101170000_0016_settings_admin.sql |
| function | `public.photo_cleanup/0` | gleich (roh gleich) | 20261102110000_0020_photo_staging.sql |
| function | `public.photo_orphans/0` | gleich (roh gleich) | 20261102110000_0020_photo_staging.sql |
| function | `public.photo_staging_interval/0` | gleich (roh gleich) | 20261102110000_0020_photo_staging.sql |
| function | `public.price_version_hold/1` | gleich (roh gleich) | 20261102100000_0019_quote_hardening.sql |
| function | `public.publish_version/2` | gleich (roh gleich) | 20261101160000_0015_versions_published.sql |
| function | `public.quote_district/2` | gleich (roh gleich) | 20261102100000_0019_quote_hardening.sql |
| function | `public.quote_save_booking/13` | gleich (roh gleich) | 20261101190000_0018_revisions_contacts.sql |
| function | `public.quote_save_request/25` | gleich (roh gleich) | 20261102110000_0020_photo_staging.sql |
| function | `public.route_cleanup/0` | gleich (roh gleich) | 20261029233428_0009_route_cleanup.sql |
| function | `public.route_geo_facts/5` | gleich (roh gleich) | 20261029214421_0006_route_infra.sql |
| function | `public.take_rate_tokens/1` | gleich (roh gleich) | 20261029215750_0008_rate_limit_stop_early.sql |
| function | `public.verify_price_version/1` | gleich (roh gleich) | 20261101160000_0015_versions_published.sql |
| function | `public.withdraw/1` | gleich (roh gleich) | 20261101180000_0017_status_machine.sql |

## Nicht ableitbare Constraints


## Warnungen

