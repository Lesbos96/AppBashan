# rl3 Plan und Auflagen (Fable-Planprüfung, eine Frage, Kennung rl3-2011-a)

Modell: claude-fable-5-2
Entscheidung: ja mit Änderungen. Keine Zählergrenze, keine Migration, keine Edge Function; Struktur-Tests plus Doku.

Begründung: Fakten gegengelesen (0023, 0024, 0026, `src/lib/partnerDocs.ts`): je Konto bleibend höchstens 1 Firma, 23 Bezirke, 1 Audit-Zeile, 5 Dokumentzeilen, 5 Objekte à 10 MiB; Fehlaufrufe schreiben nichts. Ein Zähler in der SQL-Funktion rollt bei `raise` mit zurück; ein vorgeschalteter Weg wäre ein Rechteumbau ohne verhinderten Schaden. Nicht belegt: „Aufrufrate begrenzt das Supabase-API-Gateway“.

Auflagen (bindend):
1. Gateway-Satz nirgends als Tatsache. Formulierung: Aufrufrate je Konto auf PostgREST und Storage ist projektseitig nicht begrenzt und für die Plattform nicht belegt; betrifft alle RPCs. Nach OFFEN mit Empfehlung (erst bei Bedarf, dann global), kein Bau in rl3.
2. GOLIVE 26 nicht still als „Rate-Limit gebaut“ schließen: „durch Strukturgrenzen erledigt, Zählergrenze bewusst nicht gebaut (ENTSCHEIDUNGEN Nr.)“, Eintrag in `docs/BEKS.md`; bis zu Beks' Bestätigung gilt der Punkt für `booking_open` als offen.
3. Neuer rls-Test mit Zeilenzählung vorher/nachher (`partners`, `partner_members`, `partner_regions`, `audit_log`): 24 Werte, Duplikat, 0, NULL-Element, genau 23 erlaubt, Textfelder an Ober- und Untergrenze, `p_small_business` null. Nichts doppeln. Rot-Beweis per Mutation.
4. `tests/rls/partner-documents.test.ts` läuft unter `describe.skipIf`: im Nachweis belegen, dass die Suite nicht übersprungen wurde.
5. Gesamtgrenze je Konto als Zahl in die Doku (1 Firma, 23 Bezirke, 5 Zeilen, 50 MiB) mit Datei:Zeile. Kein Client-Umbau, keine Änderung an Rechten oder Policies.
6. Zu dokumentieren: Gesamtwirkung = Konten × 50 MiB (Bremse: Kontenanlage); Admin-Zyklus `admin_remove_partner_document` (Datei im selben Zug entfernen); Konto löschen und neu anlegen für Mitglieder gesperrt (0053), verwaiste Firma schon offen (S9h4-1); GOLIVE-Prüfpunkt Auth-Rate-Limits im Produktivprojekt plus Bucket-Größe; signierte Upload-URL auf Pfad ohne Zeile prüfen.
