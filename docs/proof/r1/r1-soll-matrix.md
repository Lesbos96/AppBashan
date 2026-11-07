# Soll-Matrix (Kurztabelle aus Dev, nur Selects)

| Art | Name | Rechte / Policy |
|---|---|---|
| funktion | `admin_create_price_version(p_actor uuid, p_version integer, p_e` | definer true | {postgres=X/postgres,service_role=X/postgres} |
| funktion | `admin_grant_role(p_user uuid, p_role user_role)` | definer true | {postgres=X/postgres} |
| funktion | `admin_set_price_config(p_actor uuid, p_version integer, p_key t` | definer true | {postgres=X/postgres,service_role=X/postgres} |
| funktion | `admin_set_setting(p_actor uuid, p_key text, p_value numeric, p_` | definer true | {postgres=X/postgres,service_role=X/postgres} |
| funktion | `booking_terms()` | definer true | {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres} |
| funktion | `photo_cleanup()` | definer false | {postgres=X/postgres,service_role=X/postgres} |
| funktion | `photo_orphans()` | definer false | {postgres=X/postgres,service_role=X/postgres} |
| funktion | `photo_staging_interval()` | definer false | {postgres=X/postgres,service_role=X/postgres} |
| funktion | `price_version_hold(p_version integer)` | definer false | {postgres=X/postgres,service_role=X/postgres} |
| funktion | `publish_version(p_actor uuid, p_version integer)` | definer true | {postgres=X/postgres,service_role=X/postgres} |
| funktion | `quote_district(p_lon double precision, p_lat double precision)` | definer false | {postgres=X/postgres,service_role=X/postgres} |
| funktion | `quote_save_booking(p_customer uuid, p_client_ref uuid, p_offer ` | definer false | {postgres=X/postgres,service_role=X/postgres} |
| funktion | `quote_save_request(p_customer uuid, p_client_ref uuid, p_servic` | definer false | {postgres=X/postgres,service_role=X/postgres} |
| funktion | `route_cleanup()` | definer false | {postgres=X/postgres,service_role=X/postgres} |
| funktion | `route_geo_facts(line_geojson text, from_lat double precision, f` | definer false | {postgres=X/postgres,service_role=X/postgres} |
| funktion | `take_rate_tokens(checks jsonb)` | definer false | {postgres=X/postgres,service_role=X/postgres} |
| funktion | `verify_price_version(p_version integer)` | definer true | {postgres=X/postgres,service_role=X/postgres} |
| funktion | `withdraw(p_request uuid)` | definer true | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres} |
| policy | `audit_log.audit_log_select` | SELECT | {authenticated} |
| policy | `fee_splits.fee_splits_select` | SELECT | {authenticated} |
| policy | `platform_settings.platform_settings_select` | SELECT | {authenticated} |
| policy | `price_config.price_config_select` | SELECT | {anon,authenticated} |
| policy | `price_config.price_config_select_admin` | SELECT | {authenticated} |
| policy | `price_revisions.price_revisions_select` | SELECT | {authenticated} |
| policy | `price_versions.price_versions_select` | SELECT | {anon,authenticated} |
| policy | `price_versions.price_versions_select_admin` | SELECT | {authenticated} |
| policy | `profiles.profiles_select` | SELECT | {authenticated} |
| policy | `profiles.profiles_update` | UPDATE | {authenticated} |
| policy | `rental_bookings.rental_bookings_select` | SELECT | {authenticated} |
| policy | `rental_bookings.rental_bookings_update` | UPDATE | {authenticated} |
| policy | `rental_offers.rental_offers_insert` | INSERT | {authenticated} |
| policy | `rental_offers.rental_offers_select` | SELECT | {authenticated} |
| policy | `rental_offers.rental_offers_select_anon` | SELECT | {anon} |
| policy | `rental_offers.rental_offers_update` | UPDATE | {authenticated} |
| policy | `request_contacts.request_contacts_select` | SELECT | {authenticated} |
| policy | `request_photos.request_photos_select` | SELECT | {authenticated} |
| policy | `service_requests.service_requests_select` | SELECT | {authenticated} |
| policy | `status_events.status_events_select` | SELECT | {authenticated} |
| tabelle | `audit_log` | RLS true | force false | {postgres=arwdDxtm/postgres,service_role=arxtm/postgres,authenticated=r/postgres} |
| tabelle | `current_fee_rates` | RLS false | force false | {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres} |
| tabelle | `current_price_version` | RLS false | force false | {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,anon=r/postgres,authenticated=r/postgres} |
| tabelle | `fee_splits` | RLS true | force false | {postgres=arwdDxtm/postgres,service_role=rxtm/postgres,authenticated=r/postgres} |
| tabelle | `geo_boundaries` | RLS true | force false | {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres} |
| tabelle | `geo_districts` | RLS true | force false | {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres} |
| tabelle | `geocode_cache` | RLS true | force false | {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres} |
| tabelle | `platform_settings` | RLS true | force false | {postgres=arwdDxtm/postgres,service_role=arwdxtm/postgres,authenticated=r/postgres} |
| tabelle | `price_config` | RLS true | force false | {postgres=arwdDxtm/postgres,service_role=arwdxtm/postgres,anon=r/postgres,authenticated=r/postgres} |
| tabelle | `price_revisions` | RLS true | force false | {postgres=arwdDxtm/postgres,service_role=arxtm/postgres,authenticated=r/postgres} |
| tabelle | `price_versions` | RLS true | force false | {postgres=arwdDxtm/postgres,service_role=arwdxtm/postgres,anon=r/postgres,authenticated=r/postgres} |
| tabelle | `profiles` | RLS true | force false | {postgres=arwdDxtm/postgres,service_role=arwDxtm/postgres,authenticated=r/postgres} |
| tabelle | `rental_bookings` | RLS true | force false | {postgres=arwdDxtm/postgres,service_role=arxtm/postgres,authenticated=r/postgres} |
| tabelle | `rental_offers` | RLS true | force false | {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,anon=r/postgres,authenticated=r/postgres} |
| tabelle | `request_contacts` | RLS true | force false | {postgres=arwdDxtm/postgres,service_role=arxtm/postgres,authenticated=r/postgres} |
| tabelle | `request_photos` | RLS true | force false | {postgres=arwdDxtm/postgres,service_role=arxtm/postgres,authenticated=r/postgres} |
| tabelle | `route_cache` | RLS true | force false | {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres} |
| tabelle | `route_rate_limits` | RLS true | force false | {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres} |
| tabelle | `service_requests` | RLS true | force false | {postgres=arwdDxtm/postgres,service_role=arxtm/postgres,authenticated=r/postgres} |
| tabelle | `status_events` | RLS true | force false | {postgres=arwdDxtm/postgres,authenticated=r/postgres} |
