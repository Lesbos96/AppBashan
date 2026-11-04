# Nacht 04./05.11.2026 · Aufgabe „Audit“ (nur lesen)

Branch `nacht-audit` (von `main` 1630668), Draft-PR gegen `main`. Ergebnis: `docs/AUDIT_NACHT.md`. Geändert werden nur diese beiden Dateien.

## Start

- **Gelesen:** `CLAUDE.md`, `docs/PROGRESS.md` (Kopf, letzte Sessions), `docs/OPEN_ISSUES.md` (ganz), `docs/S9b_PLAN.md` (Kopf und Ist-Stand, nur zum Verständnis; S9b wird nicht bearbeitet).
- **Umgebungsvariablen (nur Namen geprüft, `env | cut -d= -f1`):** keine Supabase-Schlüssel (kein `SERVICE_ROLE`, `SECRET_KEY`, DB-Passwort, `SUPABASE_ACCESS_TOKEN`, `NEXT_PUBLIC_SUPABASE_*`). Vorhanden sind nur Variablen der Cloud-Umgebung (GitHub-, AWS-, gcloud-Token des Containers). Im Repo liegt nur `.env.example`, kein `.env.local`. → kein STOPP.
- **Hinweis für Beks:** In der Werkzeugliste dieser Session steht ein Supabase-MCP-Connector (`mcp__Supabase__*`: `execute_sql`, `apply_migration`, `deploy_edge_function` u. a.). Das ist keine Umgebungsvariable, gibt aber Datenbankzugriff. Ich habe ihn in dieser Nacht nicht geladen und nicht benutzt. Frage 1 unten.

## Entscheidungen

| Nr. | Entscheidung | Begründung |
|---|---|---|
| E1 | Der Auftrag enthält drei Aufgaben (Audit, Testabdeckung, OPEN_ISSUES). Ich bearbeite alle drei nacheinander, je mit eigenem Branch (`nacht-audit`, `nacht-testabdeckung`, `nacht-open-issues`), eigenem Draft-PR und eigener Nachtdatei. | Drei `AUFGABE`-Blöcke, „Branch nacht-<aufgabe>“ und „docs/nacht/<aufgabe>.md“ sind je Aufgabe formuliert. Getrennte Branches verhindern, dass die Nur-Lesen-Regel des Audits oder „Bestehender Code bleibt unverändert“ der Testaufgabe mit den Code-Änderungen der OPEN_ISSUES-Aufgabe kollidiert. |
| E2 | Reihenfolge: Audit zuerst. | Das Audit ändert nichts und liefert Funde, die die beiden anderen Aufgaben nutzen (Testlücken, erledigte OPEN_ISSUES). |
| E3 | Modell: Die Session läuft mit Opus 5.5, `CLAUDE.md` sieht Sonnet 5.5 vor. Ich arbeite trotzdem weiter. | „Niemand beantwortet Rückfragen. Entscheide selbst.“ Die Session wurde so gestartet; ein Warten bis morgen hätte die Nacht ungenutzt gelassen. Ein eingebautes `advisor`-Tool ohne Parameter steht nicht in meiner Werkzeugliste. |
| E4 | Kontextgrenze 150.000 Tokens: Ich stoppe dort nicht, sondern committe nach jedem Teilziel und halte den Stand in dieser Datei fest; der Kontext wird automatisch zusammengefasst. | Der Nachtauftrag verlangt ausdrücklich Weiterarbeit bis kein Durchgang mehr etwas findet und Push nach jedem Teilziel „falls die Session endet“. `PROGRESS.md` ändere ich nicht (Audit: nur zwei Dateien erlaubt). |
| E5 | Das Audit prüft den Stand von `main` (1630668). Die lesenden Subagents arbeiten auf einer abgekoppelten Arbeitskopie von `main` (`git worktree add --detach`, außerhalb des Repos), damit spätere Änderungen der anderen Aufgaben das Audit nicht verfälschen. | Ein Audit braucht einen festen Stand. |
| E6 | Funde der Subagents prüfe ich vor der Übernahme selbst an der genannten Datei und Zeile. Nicht bestätigte Funde kommen nicht in den Bericht oder stehen als „nicht bestätigt“ dort. | Subagents liefern Fehler im selben Ton wie Treffer. Umsetzung: Spalte „Status“ im Bericht, „geprüft“ = nachgeschlagen, „Bericht“ = nur aus dem Prüferbericht (entspricht „nicht bestätigt“). |
| E7 | Sechs Prüfer statt fünf: Phase 1 zusätzlich für `supabase/functions/` (1b). | „Vollständiges Audit“: die Edge Functions tragen Auth, Geld und Gebühr und gehören zu keiner der fünf genannten Phasen. |
| E8 | H-1 (veraltete ARCHITECTURE) als „hoch“ eingestuft, obwohl der Migrations-Prüfer „mittel“ wählte. | Mein Kriterium für alle Prüfer war: „hoch“, wenn ein Doku-Widerspruch zu einer falschen Sicherheitsentscheidung führen kann. Entscheidung 17 beschreibt genau die in S9a-4c als „hoch“ geschlossene Lücke, und S9b baut als Nächstes das Rollenmodell. Im Bericht als „nur Doku, kein Live-Risiko“ gekennzeichnet. |
| E9 | Zwei Funde (N-10 Bruchzahlen im Flow, N-11 HEIC ohne MIME-Typ) stammen aus der Nachtaufgabe „Testabdeckung“ und sind dort behoben; im Audit stehen sie mit Verweis, weil sie den Stand `main` betreffen. | Das Audit beschreibt `main`; die Fixes liegen nur auf dem Branch. |

## Fragen an Beks

1. Soll der Supabase-MCP-Connector in Nachtsessions überhaupt in der Werkzeugliste stehen? Er gibt Schreibzugriff auf Datenbank und Functions, unabhängig von Umgebungsvariablen. Die Prüfung in Schritt 2 des Nachtauftrags erfasst ihn nicht.
2. M-6: Sollen die Startkarte „Transporter mieten“ und die Profilzeile „Für Vermieter“ in Phase 1 ausgeblendet werden (wie der Tab „Miete“ laut `CLAUDE.md`)? Beide führen heute auf den Platzhalter „Dieser Bereich ist noch nicht verfügbar“.
3. M-4: Sollen `import-boundaries`, `db:push` und `db:link` eine ausdrückliche Ref-Freigabe bekommen (z. B. `MOVENOW_ALLOW_REF`), oder bleibt der Schutz für Prod bewusst bei der GOLIVE-Disziplin?
4. N-1/N-5: Mietpfad (direktes Status-UPDATE, Miete über `quote` ohne Bedingungen) bis Phase 2 schließen oder bewusst offen lassen?

## Verlauf

- **Phase 1–5 (parallel):** sechs Prüfer gestartet (`advisor-report` Opus für Migrationen, Functions und `src/`; `reviewer` Sonnet für Tests/Skripte, Code/Doku und OPEN_ISSUES). Rohergebnisse: Migrationen hoch 0 / mittel 1 / niedrig 4; Functions hoch 0 / mittel 1 / niedrig 3; `src/` hoch 0 / mittel 2 / niedrig 3; Tests/Skripte hoch 0 / mittel 3 / niedrig 6; Code/Doku hoch 2 / mittel 8 / niedrig 17; OPEN_ISSUES: erledigt 11, veraltet 13, doppelt 24 Gruppen, fehlt 5. Die Session wurde zweimal neu gestartet (Container); die Berichte lagen danach vollständig in `tmp/proof/`.
- **Nachprüfung durch die Hauptsession** (Grep/Read auf der Arbeitskopie von `main`): ARCHITECTURE `:32/:45/:46/:97/:100/:123`; `0001:383`, `0017:114/142/243`, `0007:4` ohne Revoke; `quote/handler.ts:131-132/176-178/247`, `parse.ts:62/126`; `auth.ts:75-85`, `Termin.tsx:149-151`, `Strecke.tsx:80-131`, Einwilligung in `Zusammenfassung.tsx`; `live-auth.mjs:4`, `import-boundaries.mjs:5`, `rls.test.ts` (neun `data ?? []`), `pricing.test.ts:188`, `photos.test.ts:19`; `PRICING.md:46`, `ROADMAP.md:91/94`, `Shell.tsx:10`, `Start.tsx:56`, `owner.ts:25/45`. Alle bestätigt. Nicht nachgeprüft (Status „Bericht“): N-4, N-7, N-8, N-9, Teile von N-12 bis N-15, Phase-5-Zeilen außer Stichproben.
- **Zusammenführung:** Doppelte Funde der Prüfer (ARCHITECTURE aus drei Berichten, `live-auth` aus zwei) zu je einem Eintrag; Schwere nach den Kriterien oben. Ergebnis `docs/AUDIT_NACHT.md`: hoch 1 (Doku), mittel 7, niedrig 15.
