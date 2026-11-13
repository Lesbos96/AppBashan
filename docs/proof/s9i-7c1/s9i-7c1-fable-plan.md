Modell: claude-fable-5-2

**Entscheidungen**
1. **Ja: keine Migration, keine Edge Function.** `my_commissions` prüft Anmeldung, aal2 und Mitgliedschaft serverseitig, hat keinen Firmen-Parameter und ist anon entzogen (0042:133-150, 0023:81-86). Die Firma darf das Journal ohnehin per RLS lesen (0028:195-196). Eine Function wäre nur ein zweiter Rechtepfad und löst das Capacitor-Problem nicht.
2. **Spaltenliste in Ordnung, nichts Personenbezogenes.** Die UUID ist vertretbar, weil die Firma sie aus `my_jobs()` kennt. Status, `ended_at`, USt.-Regel, Partner-ID und -Name wegzulassen ist richtig, ebenso die beiden Nicht-Ziele. Die fehlende sichtbare Auftragsnummer gehört in OPEN_ISSUES.
3. **Variante A.** Der Schutz liegt in der strengen Eingabeprüfung von `euro()`; B kommt nur als Unit-Assertion (`^-?\d+,\d{2}$` für alle fünf Betragsspalten) dazu. Die Whitespace-Erweiterung von `text()` ist in Ordnung, auch für den Admin-Export; dessen Test um einen Fall mit führendem Leerzeichen ergänzen.
4. **Web-only jetzt vertretbar.** Die CSV-Erzeugung ist plattformneutral, nativ wird nur die Übergabe getauscht. Das weicht vom Wortlaut „Nichts bauen, was nativ nicht funktioniert“ ab: Beks im Bericht nennen, Eintrag in OPEN_ISSUES/GOLIVE.
5. **Abrechnungsmonat ja, aber die Planaussage ist falsch.** Der Monat ist `greatest(ended_at, created_at)` (0042:113). Eine spätere Gegenbuchung steht also in ihrem eigenen Monat, nicht im Monat der Buchung (completion.test.ts:211, 238: Korrektur vom 05.11. im November). Plan, Tests und Hinweistext korrigieren. Aufträge ohne Endstatus fehlen ganz (0042:112).
6. **Weitere Risiken** stehen in den Auflagen. Die Rundungsbeispiele in Abschnitt 3 stimmen (863/172, 250/50).

**Auflagen**
- **A1 (hoch) Eingabeprüfung in `csv.ts`:** `Number('')` und `Number(null)` ergeben heute „0,00“ statt eines Fehlers (csv.ts:33).
  - Beträge: nur `number` mit `Number.isSafeInteger` oder Zeichenkette `^-?\d+$`, sonst `bad_row`.
  - `fee_rate`: nur `^(0(\.\d{1,5})?|1(\.0{1,5})?)$`, sonst `bad_row`.
  - Unbekannte Art: `bad_row`.
  - Minus ist ASCII 0x2D (der Plan schreibt U+2212); bytegenau testen.
  - Die CSV rechnet nichts und hat keine Summenzeile, nur gespeicherte Werte.
- **A2 (hoch) Paging:** Die Sortierung in der Funktion garantiert die Reihenfolge unter `.range` nicht.
  - Am Aufruf `.order('created_at').order('entry_id')` und `count: 'exact'` setzen.
  - Danach prüfen: Zeilenzahl = count, `entry_id` eindeutig, `billing_month` jeder Zeile = gewählter Monat. Sonst `unavailable`, keine Datei.
  - Test mit 1001 Zeilen.
- **A3 (mittel) Datensparsamkeit:** `.select()` nur mit den 12 benötigten Spalten. `request_status`, `ended_at`, `partner_name`, `partner_id` und `vat_rule` gar nicht abrufen.
- **A4 (mittel) Gesperrte Firmen:** Partner.tsx:69 (`ACCESS`) schließt `suspended` aus, obwohl solche Firmen Journalzeilen haben können. Empfehlung: Karte für `active`, `payment_hold`, `suspended`; nicht für `pending`/`rejected`, die keine Zeilen haben können (0028:158). Das ändert eine bestehende Produktregel, also Beks im Bericht vorlegen; bei Nein als OPEN_ISSUES festhalten, keine stille Lücke.
- **A5 (mittel) CLAUDE.md nicht anfassen:** Die Ergänzung der Anzeigeorte (Fakten C, Option 1) entscheidet nur Beks. Kunden-Screens bleiben per bestehendem E2E ohne „Provision“. Der neue Text `period` muss den Wortfilter in jobs-client.test.ts:182 bestehen.
- **A6 (niedrig) Kleinteile:**
  - Hinweis in der Karte: „Aufträge erscheinen im Monat ihres Abschlusses“.
  - Übergabe in einer eigenen Funktion (Blob), `revokeObjectURL` verzögert, Doppelklick-Sperre per Ref.
  - `<input type="month">` ist in Firefox und Safari am Desktop ein Textfeld: Format-Hinweis und Test.
  - `tsconfig.json:25` um `_shared/commission` erweitern.
  - Download in der iOS-Standalone-PWA von Hand prüfen, sonst OPEN_ISSUES.

Freigabe: mit Auflagen. Rot-Beweise mit Ist-Wert: Firma b sieht 0 Zeilen von a; aal1 liefert `mfa_required`; anon 42501.
