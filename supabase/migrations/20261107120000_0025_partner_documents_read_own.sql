-- 0025 Dokumenten-Bucket: die Firma darf ihre eigenen Dateien lesen (Korrektur zu 0024).
-- Die Storage-API führt den Upload als INSERT ... RETURNING aus; Postgres verlangt dafür, dass auch die Select-Policy die neue Zeile zulässt
-- (Test in tests/rls/partner-admin.test.ts: ohne diese Policy scheitert der Upload mit 42501). Lesen darf nur, wer den Pfad über
-- partner_document_slot als eigene Zeile nachweist (aal2, Firma pending/active/payment_hold) sowie admin (aal2).
alter policy partner_documents_objects_select on storage.objects
using (bucket_id = 'partner-documents' and ((select private.is_admin()) or (select private.partner_document_slot(name))));
