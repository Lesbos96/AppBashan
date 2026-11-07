-- 0024 Partner-Verwaltung (S9b-2, docs/S9b_PLAN.md Abschnitt 5).
-- Kategorien, Bezirke, USt.-Regel, Stammdaten und Dokumente ändert nur admin, ausschließlich über Funktionen (Grant nur service_role,
-- p_actor stammt nie aus Anfragedaten, kein Admin ändert die eigene Firma: self_approval). Ein audit_log-Eintrag je Aufruf.
-- Dokumente: private Tabelle partner_documents (höchstens 5 je Firma) und privater Bucket partner-documents; der Partner legt die Zeile an
-- (nur id, kind), der Server setzt Firma und Pfad {partner_id}/{id}; Upload nur auf den Pfad einer eigenen Zeile (aal2).
-- Fehler: SQLSTATE P0001, Meldung = Code (not_found, self_approval, scope_incomplete, rental_not_enabled, vat_rule_not_enabled,
-- vat_rule_backdated, limit_reached, partner_not_active, field_immutable, append_only); fehlende Rechte 42501 (not_admin, not_partner_member).

-- Phase 1 (S1-N1): rental und USt.-Regeln außer standard_20 sind auch an den Tabellen gesperrt; Phase 2 ersetzt beide Constraints.
alter table public.partner_categories add constraint partner_categories_no_rental check (service <> 'rental');
alter table public.partner_vat_rules add constraint partner_vat_rules_phase1 check (rule = 'standard_20');

-- Admin-Funktionen ---------------------------------------------------------------------------------------

create function public.admin_set_partner_scope(
  p_actor uuid, p_partner uuid, p_services public.partner_service[], p_districts smallint[], p_note text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  st public.partner_status;
begin
  perform private.assert_admin(p_actor);
  select status into st from public.partners where id = p_partner for update;
  if not found then raise exception 'not_found'; end if;
  perform private.assert_not_member(p_actor, p_partner);
  if p_services is null or p_districts is null then raise exception 'scope_incomplete'; end if;
  if 'rental' = any (p_services) then raise exception 'rental_not_enabled'; end if;
  if st = 'active' and (coalesce(array_length(p_services, 1), 0) = 0 or coalesce(array_length(p_districts, 1), 0) = 0) then
    raise exception 'scope_incomplete';
  end if;
  delete from public.partner_categories where partner_id = p_partner;
  insert into public.partner_categories (partner_id, service) select distinct p_partner, s from unnest(p_services) s;
  delete from public.partner_regions where partner_id = p_partner;
  insert into public.partner_regions (partner_id, district) select distinct p_partner, d from unnest(p_districts) d;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'admin', 'set_partner_scope', 'partner', p_partner::text,
    jsonb_build_object('services', p_services, 'districts', p_districts, 'note', p_note));
end
$$;

create function public.admin_set_vat_rule(
  p_actor uuid, p_partner uuid, p_rule public.partner_vat_rule, p_valid_from date, p_note text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Vienna')::date;
begin
  perform private.assert_admin(p_actor);
  perform 1 from public.partners where id = p_partner for update;
  if not found then raise exception 'not_found'; end if;
  perform private.assert_not_member(p_actor, p_partner);
  if p_rule is distinct from 'standard_20' then raise exception 'vat_rule_not_enabled'; end if;
  if p_valid_from is null or p_valid_from < today then raise exception 'vat_rule_backdated'; end if;
  insert into public.partner_vat_rules (partner_id, rule, valid_from) values (p_partner, p_rule, p_valid_from);
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'admin', 'set_vat_rule', 'partner', p_partner::text,
    jsonb_build_object('rule', p_rule, 'valid_from', p_valid_from, 'note', p_note));
end
$$;

-- null = unverändert. Das Stripe-Konto steht nicht im Audit (nur der Feldname). verified_at bleibt unberührt.
create function public.admin_set_partner_master(
  p_actor uuid, p_partner uuid, p_name text, p_legal_form text, p_uid text, p_small_business boolean,
  p_street text, p_postcode text, p_city text, p_stripe_account_id text, p_note text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  o public.partners;
  changed text[];
begin
  perform private.assert_admin(p_actor);
  select * into o from public.partners where id = p_partner for update;
  if not found then raise exception 'not_found'; end if;
  perform private.assert_not_member(p_actor, p_partner);
  changed := array_remove(array[
    case when p_name is not null and p_name is distinct from o.name then 'name' end,
    case when p_legal_form is not null and p_legal_form is distinct from o.legal_form then 'legal_form' end,
    case when p_uid is not null and p_uid is distinct from o.uid then 'uid' end,
    case when p_small_business is not null and p_small_business is distinct from o.small_business then 'small_business' end,
    case when p_street is not null and p_street is distinct from o.address_street then 'address_street' end,
    case when p_postcode is not null and p_postcode is distinct from o.address_postcode then 'address_postcode' end,
    case when p_city is not null and p_city is distinct from o.address_city then 'address_city' end,
    case when p_stripe_account_id is not null and p_stripe_account_id is distinct from o.stripe_account_id then 'stripe_account_id' end
  ], null);
  perform set_config('app.mv_partner_master', p_partner::text, true);
  update public.partners set
    name = coalesce(p_name, name), legal_form = coalesce(p_legal_form, legal_form), uid = coalesce(p_uid, uid),
    small_business = coalesce(p_small_business, small_business), address_street = coalesce(p_street, address_street),
    address_postcode = coalesce(p_postcode, address_postcode), address_city = coalesce(p_city, address_city),
    stripe_account_id = coalesce(p_stripe_account_id, stripe_account_id)
  where id = p_partner;
  perform set_config('app.mv_partner_master', '', true);
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'admin', 'set_partner_master', 'partner', p_partner::text,
    jsonb_build_object('fields', to_jsonb(changed), 'note', p_note));
end
$$;

-- Gibt einen Dokumentenplatz frei (z. B. nach abgebrochenem Upload). Die Datei im Bucket entfernt der Eigentümer über die Storage-API.
create function public.admin_remove_partner_document(p_actor uuid, p_document uuid, p_note text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  d record; -- die Tabelle entsteht weiter unten
begin
  perform private.assert_admin(p_actor);
  select * into d from public.partner_documents where id = p_document for update;
  if not found then raise exception 'not_found'; end if;
  perform private.assert_not_member(p_actor, d.partner_id);
  perform set_config('app.mv_partner_doc_delete', d.id::text, true);
  delete from public.partner_documents where id = d.id;
  perform set_config('app.mv_partner_doc_delete', '', true);
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'admin', 'remove_partner_document', 'partner', d.partner_id::text,
    jsonb_build_object('document', d.id, 'kind', d.kind, 'path', d.storage_path, 'note', p_note));
end
$$;

-- Dokumente ----------------------------------------------------------------------------------------------

create table public.partner_documents (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete restrict,
  kind text not null check (kind in ('trade_license', 'company_register', 'other')),
  storage_path text not null unique,
  uploaded_at timestamptz not null default now()
);
create index partner_documents_partner_idx on public.partner_documents (partner_id);

-- Firma und Pfad setzt der Server (SECURITY DEFINER liest partner_documents als Eigentümer, die Zählung ist nicht per RLS verfälschbar);
-- Mitglied mit aal2 nötig, Firma pending/active/payment_hold, höchstens 5 Zeilen je Firma unter Advisory-Lock.
create function private.guard_document_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  pid uuid := private.my_member_partner_id();
  st public.partner_status;
begin
  if pid is null then raise exception 'not_partner_member' using errcode = '42501'; end if;
  select status into st from public.partners where id = pid;
  if st not in ('pending', 'active', 'payment_hold') then raise exception 'partner_not_active'; end if;
  perform pg_advisory_xact_lock(hashtextextended('partner_documents:' || pid::text, 0));
  if (select count(*) from public.partner_documents where partner_id = pid) >= 5 then raise exception 'limit_reached'; end if;
  new.partner_id := pid;
  new.storage_path := pid::text || '/' || new.id::text;
  return new;
end
$$;

-- Löschen nur mit Marker an die Zeile (Admin-Funktion) oder an die Firma (Testfirmen löscht nur der Eigentümer); UPDATE und TRUNCATE nie.
create function private.guard_document_delete() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_setting('app.mv_partner_doc_delete', true) is distinct from old.id::text
     and current_setting('app.mv_partner_delete', true) is distinct from old.partner_id::text then
    raise exception 'field_immutable';
  end if;
  return old;
end
$$;

-- Wahr, wenn für den Pfad eine Zeile der eigenen Firma existiert (aal2, Firma pending/active/payment_hold wie beim Anlegen der Zeile).
-- Die Storage-Policy ruft das im Aufrufer-Kontext auf; eine Policy auf storage.objects darf partner_documents nicht selbst lesen
-- (der Partner hat dort nur Spaltenrechte).
create function private.partner_document_slot(p_name text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.partner_documents d join public.partners p on p.id = d.partner_id
    where d.storage_path = p_name and d.partner_id = (select private.my_member_partner_id())
      and p.status in ('pending', 'active', 'payment_hold')
  )
$$;

create trigger guard_document_insert before insert on public.partner_documents
for each row execute function private.guard_document_insert();
create trigger append_only before update on public.partner_documents
for each row execute function private.append_only();
create trigger append_only_truncate before truncate on public.partner_documents
for each statement execute function private.append_only();
create trigger guard_document_delete before delete on public.partner_documents
for each row execute function private.guard_document_delete();

alter table public.partner_documents enable row level security;
revoke all on public.partner_documents from anon, authenticated, service_role;
-- Partner liest Metadaten der eigenen Firma, nie den Pfad; legt nur (id, kind) an. service_role liest alle Spalten (Edge Functions).
grant select (id, partner_id, kind, uploaded_at) on public.partner_documents to authenticated;
grant select on public.partner_documents to service_role;
grant insert (id, kind) on public.partner_documents to authenticated;

create policy partner_documents_select on public.partner_documents for select to authenticated
using (partner_id = (select private.partner_of_user()) or (select private.is_admin()));
create policy partner_documents_insert on public.partner_documents for insert to authenticated
with check (partner_id = (select private.my_member_partner_id()));

-- Bucket: privat, 10 MB, PDF und JPEG. Upload nur auf den Pfad einer eigenen Zeile, lesen nur admin, kein Ändern, kein Löschen durch Nutzer.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partner-documents', 'partner-documents', false, 10485760, array['application/pdf', 'image/jpeg']);

create policy partner_documents_objects_insert on storage.objects for insert to authenticated
with check (bucket_id = 'partner-documents' and (select private.partner_document_slot(name)));
create policy partner_documents_objects_select on storage.objects for select to authenticated
using (bucket_id = 'partner-documents' and (select private.is_admin()));

-- Rechte der Funktionen ----------------------------------------------------------------------------------

revoke all on function
  public.admin_set_partner_scope(uuid, uuid, public.partner_service[], smallint[], text),
  public.admin_set_vat_rule(uuid, uuid, public.partner_vat_rule, date, text),
  public.admin_set_partner_master(uuid, uuid, text, text, text, boolean, text, text, text, text, text),
  public.admin_remove_partner_document(uuid, uuid, text),
  private.guard_document_insert(), private.guard_document_delete(), private.partner_document_slot(text)
from public, anon, authenticated, service_role;

grant execute on function
  public.admin_set_partner_scope(uuid, uuid, public.partner_service[], smallint[], text),
  public.admin_set_vat_rule(uuid, uuid, public.partner_vat_rule, date, text),
  public.admin_set_partner_master(uuid, uuid, text, text, text, boolean, text, text, text, text, text),
  public.admin_remove_partner_document(uuid, uuid, text)
to service_role;
grant execute on function private.partner_document_slot(text) to authenticated;
