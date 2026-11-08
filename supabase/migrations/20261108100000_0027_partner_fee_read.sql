-- 0027 Gebührensatz lesen (S9b-3, docs/S9b_PLAN.md Abschnitt 6, N-10; P2B-Transparenz).
-- Jedes Mitglied einer Partnerfirma (jeder Status, aal2) liest fee_rate und fee_vat_rate, auch künftige Zeilen (angekündigter Satz);
-- admin (aal2) liest alles. Kunden ohne Firma, anon und die Rolle rental_provider (ohne Funktion) lesen nichts.
-- Spalten-Grant: note und created_at bleiben intern (current_fee_rates nutzt nur key, value, effective_from).
revoke select on public.platform_settings from authenticated;
grant select (key, version, value, effective_from) on public.platform_settings to authenticated;

alter policy platform_settings_select on public.platform_settings
using (
  (select private.is_admin())
  or (key in ('fee_rate', 'fee_vat_rate') and (select private.my_member_partner_id()) is not null)
);
