Modell: claude-fable-5-2

# DB-Freigabe 1, Schritt mail2 (R3)

Datum: 2026-11-19
Antrag: `tmp/proof/mail2/db-antrag-1.json` (eine Migration)
Geprüft: die Migration vollständig (78 Zeilen), gegen `.claude/rules/daten.md`, `.claude/rules/geld.md`, den Plan `tmp/proof/mail2-plan.md`, die bindenden Auflagen der Planprüfung aus dem Auftrag und die Bezugsmigrationen 0023, 0030, 0031, 0033, 0034, 0036, 0054, 0063, 0070, 0071, 0074, 0075. Dazu gelesen: `supabase/functions/_shared/jobs/handlers.ts:223-376`, `supabase/functions/_shared/jobs/db.ts:110-152`, `tests/rls/outbox.test.ts:1-20, 120-204`, `tests/support/positiv.ts:452-467`; Suche nach Abhängigkeiten in `supabase/migrations`, `supabase/functions`, `tests`, `scripts`, `src`.

SHA256: 02f20d6be94bc750a82252e27cc41b71ee5ae55980836c9679d383220fbbcc67 supabase/migrations/20261119031957_0076_mail2_konto_empfaenger.sql

Der Hash ist aus dem Antrag abgeschrieben und stimmt mit dem Hash im Auftrag überein. Selbst nachgerechnet habe ich ihn nicht (kein Werkzeug dafür); das Gate vergleicht ihn beim Push mit der Datei.

Urteil: frei

Die Freigabe gilt mit der Auflage aus M1 (Reihenfolge Push, dann sofort Deploy von `outbox-send`).

Nicht ausgeführt: Ich habe die Migration nur gelesen, nicht gegen eine Datenbank laufen lassen. Aussagen zu Dev-Daten (205 Kunden- und 251 Firmen-Zeilen) stützen sich auf die Angabe im Auftrag und im Plan, nicht auf eine eigene Abfrage. Den heute auf Dev deployten Stand von `outbox-send` kenne ich nur aus den Fakten des Plans (Zeilen 4 bis 8), nicht aus dem Deployment.

## Findings

### Hoch
Keine.

### Mittel
- M1 · `0076:59` zusammen mit `0076:12` – Fenster zwischen Push und Deploy. Der bisher deployte Versand liest die Spalte `partner_email`, die es nach dem Push nicht mehr gibt: jede Firmen-Zeile, die er in diesem Fenster holt, endet bei ihm in `no_recipient`, und das neue `outbox_mark` macht sie sofort endgültig `failed` (unter 0075 wäre es nur ein verbrauchter Versuch gewesen). Dasselbe gilt für Kunden-Zeilen, bei denen der alte Code einen vorübergehenden Lesefehler der Auth-API als „kein Empfänger“ wertet (Plan, Fakt 1). Der Cron läuft jede Minute. Auf Dev trifft es nach heutigem Stand nur die 251 Alt-Zeilen, die ohnehin endgültig werden sollen; eine echte Firmen-Mail, die im Fenster entsteht, ginge aber ohne Wiederholung verloren. Die Regel „dazwischen fail closed“ (`daten.md`, Datenbank-Weg) gilt hier also nicht. – Fix (Auflage, kein Umbau der Migration): `outbox-send` unmittelbar nach `npm run db:push` deployen; dazwischen kein Testlauf, der Outbox-Zeilen anlegt (`flow-live`, rls-Läufe mit committeten Zeilen). Im Bericht festhalten, wie viele Zeilen zwischen Push und Deploy `failed` wurden (aus `npm run outbox`), und ob darunter andere als die 456 Alt-Zeilen sind. Für eine spätere Produktion mit laufendem Versand als Punkt nach OFFEN: bei Migrationen dieser Art den Cron für das Fenster anhalten oder zuerst die Function, dann die Migration.

### Niedrig
- N1 · `0076:65` gegen `0076:60`, `0076:68` – Bei `p_ok = null` mit dem Code `smtp_account` laufen die drei Fälle auseinander: Status `pending` und `claimed_at = now()`, aber der Zähler sinkt nicht (`not p_ok` ist dann null). Stand die Zeile bei fünf Versuchen, bleibt sie `pending` mit fünf Versuchen: nie fällig (`0076:47`) und nie aufgeräumt (`0036:16-17` greift nur bei `sending`). Nicht erreichbar über den einzigen Aufrufer (`db.ts:130` übergibt immer einen Wahrheitswert, EXECUTE nur für service_role). – Fix (optional, nächste Outbox-Migration): `p_ok is not true and p_error = 'smtp_account'` in Zeile 65.
- N2 · `0076:60-68` – Eine mit `smtp_account` zurückgegebene Zeile hat keine Altersgrenze: solange der Kontofehler anhält, wartet sie unbegrenzt (gewollt, sie geht nicht verloren und ist als `pending` mit Code sichtbar). Nach einem langen Ausfall gehen dadurch auch veraltete Mails hinaus (z. B. `listing_new` nach Ablauf der Annahmefrist); nur `en_route` verfällt im Handler vor dem Versand (`handlers.ts:335`). – Kein Fix in dieser Migration; gehört zum Rest in GOLIVE 48 (Alarm bei Kontofehler), als Punkt nach OFFEN.
- N3 · `0076:5` und `handlers.ts:299` gegen Plan Zeile 30 – Migration und Handler nennen als Kontofehler 401, 402, 403, 429; der freigegebene Plan nennt 401, 403, 429. Sachlich passend (402 = Kontingent leer), aber eine Abweichung vom Plan. – In Bericht und Abnahme benennen; kein Fix an der Migration (nur Kommentar).
- N4 · `supabase/functions/_shared/database.types.ts:1890` – Die Typen nennen noch `partner_email`, `db.ts:127` liest schon `owner_id`. Löst sich mit `db:types` nach dem Push; bis dahin ist `check` rot. – Kein Fix, Reihenfolge einhalten.

## Prüffragen aus dem Auftrag

1. Bindende Auflagen der Planprüfung
   - Fall-Reihenfolge in `outbox_mark`: erfüllt (`0076:57-63`): Erfolg, dann `expired`/`no_recipient` (endgültig), dann `smtp_account` (zurück), dann fünfter Versuch, sonst `pending`. `claimed_at` in derselben Reihenfolge (`0076:66-71`).
   - `smtp_account`: `pending`, Versuch − 1 mit Untergrenze 0, auch bei fünf Versuchen: erfüllt (`0076:60`, `0076:65`). Alle Ausdrücke im SET lesen den alten Zeilenwert; der Fall steht vor der Prüfung auf fünf Versuche.
   - `smtp_account` im CHECK: erfüllt (`0076:40`), sonst dieselbe Liste wie `0075:38`; die Liste in `outbox_mark` (`0076:74`) ist dieselbe ohne `lease_expired` (den Code setzt nur das Aufräumen, `0036:16`).
   - `outbox_is_due` behält das Limit und die Lease: erfüllt (`0076:47`, `0076:49`, zeichengleich mit `0075:9`, `0075:11`).
   - Pause 15 Min. × 4^(Versuche − 1) mit den verbleibenden Versuchen: erfüllt (`0076:48`). Die Klausel „null Versuche ist immer fällig“ aus `0075:10` entfällt, der Exponent hat die Untergrenze 0. Verbleibende Versuche 0 und 1: 15 Min., 2: 1 Std., 3: 4 Std., 4: 16 Std. Neue Zeilen (ohne `claimed_at`) bleiben sofort fällig. `power` mit zwei Ganzzahlen löst auf die float8-Fassung auf, der Cast bindet vor der Multiplikation.
   - Inhaber deterministisch: erfüllt (`0076:28-30`): nur Rolle `owner`, ältester zuerst, bei gleicher Zeit die kleinere Konto-ID; `staff` wird nie gewählt; ohne Inhaber null. Die Wahl trifft die Datenbank, nicht der Versand.
   - EXECUTE von `outbox_claim` nur für service_role: erfüllt (`0076:36`), siehe 2.

2. Funktionsrechte (`daten.md`)
   - `outbox_claim`: nach `drop` plus `create` gibt es kein automatisches EXECUTE (0070:7 für anon, authenticated, service_role im Schema public; 0071:7 für PUBLIC). Genau ein Grant, nur service_role (`0076:36`). Stand vorher: nur service_role (`0031:242-247`, danach keine Rechteänderung in den Migrationen). Keine Ausweitung, keine Lücke (ohne das Grant: 42501 im Versand).
   - `outbox_mark`, `private.outbox_is_due`: `create or replace` mit unveränderter Signatur und unverändertem Rückgabetyp, Rechte bleiben (`outbox_mark` nur service_role; `outbox_is_due` ohne Grant, wie in `0075:4` begründet: Aufrufer sind nur `outbox_claim` als Eigentümer und `outbox_dispatch` im Cron).
   - `outbox_dispatch` wird nicht angefasst; der Entzug aus 0063:3 bleibt.
   - SECURITY DEFINER mit `set search_path = ''` bei `outbox_claim` (`0076:13`) und `outbox_mark` (`0076:54`); `outbox_is_due` liegt in `private`, ohne DEFINER, mit festem Pfad (`0076:45`). Alle Objekte schemaqualifiziert.
   - Keine neue Tabelle, keine Policy, kein Tabellen-Grant. Register `positiv.ts:458-462` nennt die neuen Spalten; der rls-Test misst die Rechte der drei Rollen (`outbox.test.ts:197-202`).

3. Blockiert etwas das `drop function`, bricht etwas am neuen Rückgabetyp?
   - Abhängige Objekte: keine. `outbox_claim` kommt in den Migrationen nur als Funktionsdefinition und in Rechte-Anweisungen vor (0031, 0034, 0036, 0074, 0075, 0076). Die zwei Views (0004:9, 0010:21) nutzen sie nicht; keine Policy, kein Trigger, kein Default. Der Cron ruft `outbox_dispatch`, nicht `outbox_claim` (0033:25). Das `drop` läuft ohne CASCADE durch.
   - Aufrufer: nur `db.ts:126-127`, bereits auf `owner_id` umgestellt; `handlers.ts:226`, `:330` nutzen `ownerId`. Unit-Tests (`accept.test.ts:140-142`, `photo-handlers.test.ts:285`, `outbox-handler.test.ts`) und das Register sind umgestellt. `partner_email` steht nur noch in den erzeugten Typen (N4). `scripts/` und `src/` rufen die Funktion nicht auf.
   - Rumpf: Spalten der Rückgabe 1 bis 5 unverändert; Spalte 6 ist `uuid` aus `partner_members.user_id` (0023:42). Alle Spalten im Rumpf sind mit Alias qualifiziert, keine Kollision mit den Ausgabenamen.
   - Der deployte alte Versand bricht am neuen Typ, bis er neu deployt ist: M1.

4. Bestehende Zeilen (Dev, 205 Kunde und 251 Firma, `pending` mit `no_recipient`)
   - Sie haben 1 bis 4 Versuche (unter 0075 wäre der fünfte `failed`). Fällig werden sie wie bisher: sofort, wenn `claimed_at` leer ist, sonst nach dem Abstand, spätestens 16 Std. nach dem letzten Versuch. Die Änderung in `0076:48` verschiebt für sie nichts (null Versuche mit gesetztem `claimed_at` gab es vor 0076 nicht).
   - Kunde: Konto fehlt (404 laut Plan, Fakt 2) → `no_recipient` → `0076:59`: sofort `failed`, `claimed_at` leer, Code bleibt. Firma: der Code entstand bisher nur, wenn die Firmenzeile fehlt (`contact_email` ist NOT NULL, 0023:26); ohne Firma gibt es keine Mitglieder (0023:41, Löschsperre), also `owner_id` null → `handlers.ts:330-333` → `no_recipient` → endgültig, ohne Aufruf der Auth-API.
   - Jede Zeile braucht genau einen weiteren Lauf, 25 je Minute. Ausnahme: liefert die Auth-API bei einer Kunden-Zeile einen anderen Fehler (429, 5xx), zählt das als normaler Fehlversuch; die Zeile endet dann später, im ungünstigen Fall mit dem allgemeinen Fehlercode statt `no_recipient`. Endgültig wird sie in jedem Fall.
   - CHECK: `drop` plus `add` prüft die Altzeilen; die alte Liste ist eine Teilmenge der neuen, kein Datenupdate nötig.

5. Kreisen, stiller Verlust, Fehlversand
   - Kreisen: Eine Zeile unter Kontofehler bleibt `pending`, bis der Fehler behoben ist; je Zeile höchstens ein Holen je Abstand, je Lauf höchstens ein Aufruf beim Anbieter (Abbruch nach dem ersten Kontofehler, `handlers.ts:353-360`). Der Cron ruft die Function nicht auf, solange keine Zeile fällig ist (`0075:63`). Begrenzt, aber ohne Altersgrenze (N2).
   - Stiller Verlust: nein. `no_recipient` und `expired` enden sichtbar als `failed` mit Code; `smtp_account` bleibt `pending` mit Code. Stürzt der Lauf zwischen Holen und Markieren ab, greift wie bisher die Lease (`0076:49`, `0036:16-17`).
   - Ein Ergebnis für eine Zeile, die nicht `sending` ist, ändert weiter nichts (`0076:77`).

6. Sicherheit
   - `owner_id` verlässt die Datenbank nur an service_role. Die Adresse steht nicht mehr im Ergebnis und nicht in der Outbox.
   - Wer Inhaber ist, kann kein Konto beeinflussen: `partner_members` hat für Konten nur SELECT (0023:238-241), einziger Einfügeweg ist `register_partner` mit der eigenen ID (0023:281), ein Konto gehört höchstens einer Firma (0023:46). Die frei änderbare `contact_email` (0023:242) bestimmt den Empfänger nicht mehr.
   - Kein Secret in der Migration.

7. Geld (`geld.md`): kein Geldweg berührt. Keine Betragsspalte, keine Gebühr, kein Journal; `outbox_claim` liefert nur Art, Empfänger, Anfrage-ID und Konto-ID.

8. Schema und Nebenläufigkeit
   - `for update skip locked` unverändert (`0076:21`); die Unterabfrage auf `partner_members` läuft über den Primärschlüssel (0023:45) und sperrt nichts.
   - Der CHECK-Tausch sperrt die Tabelle kurz; kein Rewrite.
   - Keine Anweisung, die außerhalb einer Transaktion laufen muss. Liefe die Datei wider Erwarten nicht in einer Transaktion, fehlte `outbox_claim` zwischen Zeile 9 und 11 nur für einen Augenblick; ein Cron-Lauf scheiterte einmal und käme in der nächsten Minute wieder.
   - Kein Seed, kein Datenupdate.

9. Folgepflichten im selben Schritt (Prüfung in der Abnahme): Deploy von `outbox-send` direkt nach dem Push (M1), `db:types` (N4), Vorher/Nachher der Alt-Zeilen aus `npm run outbox`, Rot- und Grün-Lauf von `tests/rls/outbox.test.ts`.

## Stichproben

| Stelle | Ergebnis |
|---|---|
| `0076:9-36` | `drop`, `create`, genau ein Grant (service_role); Rumpf bis auf die sechste Spalte zeilengleich mit `0075:14-32` |
| `0076:28-30` | Inhaber: Rolle `owner`, Reihenfolge `created_at`, `user_id`, eine Zeile |
| `0076:40` gegen `0075:38` | Liste um genau einen Code erweitert, nichts entfernt |
| `0076:47-49` gegen `0075:9-11` | Limit und Lease gleich; Klausel für null Versuche entfernt, Exponent mit Untergrenze |
| `0076:57-75` gegen `0075:44-51` | Fälle in der verlangten Reihenfolge; `expired` unverändert endgültig |
| `0076:77` | wirkt nur auf `sending` (wie `0075:52`) |
| `0031:242-247` | bisherige Rechte von `outbox_claim` und `outbox_mark`: nur service_role |
| `0033:20-25`, `0063:3` | `outbox_dispatch`: Cron jede Minute, service_role ohne EXECUTE |
| `0036:13-20` | `outbox_expire`: nur `sending` mit fünf Versuchen nach der Lease |
| `0070:7`, `0071:7` | kein automatisches EXECUTE für neue Funktionen von postgres |
| `0023:12`, `0023:40-47` | Rollen `owner`, `staff`; Primärschlüssel, ein Konto je Firma, Löschsperre zur Firma, Kaskade vom Konto |
| `0023:238-242`, `0023:281` | Mitglieder nur lesbar; einziger Einfügeweg `register_partner`; `contact_email` frei änderbar |
| `0054:39-40` | Trigger auf `partner_members` nur beim Einfügen, berührt die Auswahl nicht |
| `0030:101-113`, `0030:120-124`, `0030:140` | Outbox: RLS an, kein DML für Konten und service_role, Lesen nur admin |
| `0034:179-181` | `claimed_at` ohne Bindung an den Status: `pending` mit gesetztem `claimed_at` ist zulässig |
| `0004:9`, `0010:21` | einzige Views, keine nutzt die Outbox-Funktionen |
| `db.ts:126-130` | einziger Aufrufer; liest `owner_id`, übergibt `p_ok` als Wahrheitswert |
| `db.ts:145-152` | nur 404 mit dem Code für „Konto fehlt“ ergibt null, jeder andere Fehler wirft |
| `handlers.ts:329-333` | Firma über `ownerId`, ohne Inhaber `no_recipient` |
| `handlers.ts:353-360` | Kontofehler: Abbruch, Rest des Laufs mit `smtp_account` zurück |
| `handlers.ts:299` | Kontofehler-Status mit 402 (N3) |
| `outbox.test.ts:134-163` | misst `no_recipient` endgültig, `smtp_account` bei 0, 1, 3, 5 Versuchen, Erfolg vor Code |
| `outbox.test.ts:165-181` | misst die Abstände für 0, 1, 2, 4 verbleibende Versuche beidseitig |
| `outbox.test.ts:183-203` | misst ältesten Inhaber vor jüngerem, `staff` nie, ohne Inhaber leer, Rechte der drei Rollen |
| `positiv.ts:458-462` | Register mit `owner_id`, ohne `partner_email` |
| `database.types.ts:1890` | noch `partner_email` (N4) |

Offene Findings hoch: 0
