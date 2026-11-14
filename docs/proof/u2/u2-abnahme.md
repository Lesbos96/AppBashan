Modell: claude-fable-5-2

# Abnahme Schritt u2 (Doku-Umbau), Kontrollrunde

Datum: 2026-11-14 · Berater: advisor-report · Kontrollrunde, Runde 1 in `u2-runde1-bericht.md`

Umfang: die zehn Dateien unten, jede ganz gelesen. Geprüft ist nur, ob die eingearbeiteten Punkte aus Runde 1 richtig und vollständig behoben sind und ob die Änderungen etwas Neues gebrochen haben. Dazu gelesen: `scripts/sys/fertig.mjs`, `bericht.mjs`, `stufe.mjs`, `start-schritt.mjs`, `run.mjs`, `gate-db.mjs`, `gate-db-lib.mjs`, `gate-loesch.mjs`, `gate-loesch-lib.mjs` (alle ganz), `.claude/hooks/guard.mjs`, `.claude/hooks/session.mjs`, `scripts/scan-proof.mjs`, `docs/OFFEN.md`; aus `package.json`, `playwright.config.ts`, `.claude/settings.json` und `docs/SYSTEM_VORSCHLAG.md` nur die Stellen der Stichproben. Keine neue Vollprüfung der Fragen aus Runde 1.

Zu den Hashes: Ich habe kein Hash-Werkzeug (nur Read, Grep, Glob, Write). Die Zeilen sind wörtlich aus dem Auftrag abgeschrieben; gelesen habe ich den Stand der Dateien zum Zeitpunkt dieser Prüfung. Ob Hash und gelesener Stand übereinstimmen, vergleicht das Gate (`fertig.mjs:136`). Plausibel: Die Hashes von `karten.md` und `ui.md` sind dieselben wie in Runde 1, und beide Dateien sind inhaltlich unverändert.

SHA256: f2ffd7f5440981d41adf3beecd32c4df50426e825850441e6c697911e477e771 CLAUDE.md
SHA256: f7bff72ac7514c8c72cce15cd88446bc56d419d1ed557bf9c1d7689cbc3d036e .claude/rules/daten.md
SHA256: 8171c4d84ca74958481a436c468faf8fd859aaa2f59b1d873e6c0c6a5effcb4d .claude/rules/geld.md
SHA256: 938b465528c4ff56e8c2689078488cab420d63d7474a41f00bbb72f91eefc675 .claude/rules/karten.md
SHA256: 6c8f570c789456cf842c0776baacad4feb1235b95bed5a9d916cedd4b2695615 .claude/rules/tests.md
SHA256: 89c6ed0c7b4b96b448dc3bfc2c44d47350d12c75974692173d485405896bf186 .claude/rules/ui.md
SHA256: d66697d5cb8505059e6bd3c8c84b6c4ce85c5fb763550b1e8dd3a9fae7b5bdf1 .claude/skills/schritt/SKILL.md
SHA256: 93181476a07b9fbb26b16ff246863cdd1fe0bfcb9421e13d27ccfc89cc7e2d78 .claude/agents/advisor-report.md
SHA256: 660853f1a92cd6e5cbe79b80174660baf3ee10f4e6d42210b83e3afdf8f56895 .claude/agents/advisor.md
SHA256: f7320787ff18cdc8d5f0db86312ad82a332a172e1d55386446876162a07abe3a .claude/agents/reviewer.md

Ergebnis in einem Satz: H1 und H2 sind behoben, alle eingearbeiteten mittleren und niedrigen Punkte stehen im Wortlaut der Runde 1 an der richtigen Stelle; kein Gate ist abgeschwächt. Zwei neue mittlere Lücken stammen aus meinem eigenen Fix-Wortlaut der Runde 1 (K1, K2); beide blockieren fail-closed und sperren die Abnahme nicht.

---

## Punkte aus Runde 1

| Punkt aus Runde 1 | behoben | Datei:Zeile, Befund |
|---|---|---|
| H1 `.env`-Regel ohne Dateibezug | ja | `CLAUDE.md:52`, wortgleich mit `.claude/rules/daten.md:21`; steht im Abschnitt „Werkzeuge und Ausgaben“ und lädt damit immer. `CLAUDE.md` hat 55 Zeilen (Grenze 60, `docs/SYSTEM_VORSCHLAG.md:196`). |
| H2 Secret-Scan „vorher“, kein Verhalten bei Treffer | ja | `.claude/rules/tests.md:15` (Kopie, danach Scan, Exit 0 nötig, bei Treffer nichts committen, kein `fertig`, anhalten); `.claude/skills/schritt/SKILL.md:21` (Schlusssatz). Passt zu `bericht.mjs:89-90` (Scan vor `bericht.json`). Die Skill-Zeile lädt auch im R0-Schritt, in dem `tests.md` nicht lädt. |
| H2-Folgepunkt (`fertig` scannt nicht selbst) | vermerkt | `docs/OFFEN.md:11` (`u2-1`), Inhalt wie in Runde 1 verlangt. Hinweis: Der Eintrag hat keine Frist; siehe K5. |
| M1 `paths:` von `daten.md` | ja | `.claude/rules/daten.md:2-13`, alle elf Muster wie vorgegeben; 31 Zeilen (Grenze 40). |
| M2 `paths:` von `geld.md` | ja | `.claude/rules/geld.md:2-6`. |
| M3 Obergrenze der Berateraufrufe | ja, mit Lücke | `.claude/skills/schritt/SKILL.md:50`, wortgleich. Die Liste der Zusatzaufrufe nennt die Lösch-Freigabe nicht: K2. |
| M4 Herabstufen | ja | `.claude/skills/schritt/SKILL.md:12`; passt zu `stufe.mjs:2` und `docs/OFFEN.md:125`. |
| M5 `advisor` bietet Abnahme an | ja | `.claude/agents/advisor.md:10` („Eine Art“), `:12`, `:24`. Kein Verweis auf eine Abnahme im Chat mehr. |
| M6 Suche nach festen Staffelsätzen | ja | `.claude/agents/reviewer.md:17`, wortgleich. |
| M7 `shots:all` in den Ziellisten | ja | `CLAUDE.md:45`, `.claude/rules/tests.md:10`, `.claude/skills/schritt/SKILL.md:17`; passt zu `run.mjs:12`, `package.json:55-56`, `playwright.config.ts:55-56`. |
| M8 Fortsetzung nach 150.000 Tokens | ja | `.claude/skills/schritt/SKILL.md:56`, wortgleich. |
| M9 Herkunft der Hashes, Pflichtmenge | ja, mit Lücke | `.claude/skills/schritt/SKILL.md:18`: Die Pflichtmenge deckt jeden Zweig von `MUSS_ABNAHME` (`fertig.mjs:15`). `.claude/agents/advisor-report.md:23` wortgleich; dabei ging die wörtliche Form der Urteilszeile verloren: K1. |
| M10 Effort ohne Prüfer | ja | `.claude/skills/schritt/SKILL.md:54`; passt zu `CLAUDE.md:12` und `session.mjs:19-22`. |
| M11 `git mv` in Nachweisordnern | ja | `CLAUDE.md:53`. |
| N1 `sweep.ts`, Weg der Lösch-Freigabe | ja | `.claude/rules/daten.md:18`; passt zu `gate-loesch.mjs:22-38`, `gate-loesch-lib.mjs:36-44`. |
| N6 Referenz-Screens in der Spec | ja | `.claude/skills/schritt/SKILL.md:51`. |
| N7 Ort für Hinweise zu Nachweisen | ja | `.claude/rules/tests.md:15` (Schlusssatz). |
| N8 Name des Reviewer-Berichts | ja | `.claude/skills/schritt/SKILL.md:17`; der Name trifft keine der beiden Namenssperren (`guard.mjs:11-12`, `:284-285`) und wird von `bericht.mjs:51` mitkopiert. Passt zu `.claude/agents/reviewer.md:8`. |
| N11 (`run.mjs` und Shot-Datei, Kommentar in `fee.ts`) | vermerkt | `docs/OFFEN.md:12` (`u2-2`). |
| N2, N3, N4, N5, N9, N10 | bewusst offen | unverändert (`SKILL.md:27-30`, `:40`, `:41`, `:54`; Frontmatter der Berater; `daten.md:29`). Ohne Folge wie in Runde 1 begründet; das Gate ist jeweils maßgeblich oder strenger. |

## Neue Findings

### hoch

Keine.

### mittel

**K1** · `.claude/agents/advisor-report.md:23` – Die wörtliche Form der Urteilszeile fehlt jetzt in der Agent-Datei. Vorher stand dort die Zeile im Wortlaut (Schlüsselwort, Doppelpunkt, `frei` oder `gesperrt`); jetzt steht nur „die Zeile mit dem Urteil (frei oder gesperrt)“. Das Gate liest streng zeilenverankert (`gate-db-lib.mjs:41`, `:46`); fehlt die Zeile oder weicht sie ab, ist das Urteil leer und `db:push` bzw. das Lösch-Gate blockiert (`gate-db-lib.mjs:59`). Der Antrag hilft nicht: Er ist eine JSON-Liste aus Pfad und Hash ohne Formatangabe (`gate-db.mjs:57`), und der Berater bekommt laut `SKILL.md:16` nur ihn. Die Form steht nur noch in `.claude/rules/daten.md:29`. Ursache ist mein Fix-Wortlaut aus Runde 1 (M9), nicht die Einarbeitung. Wirkung: fail-closed, schlimmstenfalls ein blockierter Push und ein weiterer Fable-Aufruf; keine Lockerung. Nebenbei ungenau: Für Lösch-Freigaben gibt es keinen Antrag (`docs/OFFEN.md:123`, u1-3), der Hash kommt dort aus dem Auftrag.
Fix, neuer Wortlaut des Halbsatzes nach dem Semikolon: „bei Abnahmen und Lösch-Freigaben den Hash aus dem Auftrag, bei DB-Freigaben den Hash aus dem Antrag abschreiben; DB- und Lösch-Freigaben brauchen zusätzlich genau eine Zeile `Urteil: frei` oder `Urteil: gesperrt`“.
Zeitpunkt: nicht in u2 (jede Änderung an der Datei macht diese Abnahme ungültig, `fertig.mjs:54`), sondern als Eintrag in `docs/OFFEN.md` mit Frist „vor der ersten echten Migration, zusammen mit u1b-6/AM5“. Bis dahin nennt der Auftrag einer DB- oder Lösch-Freigabe die Zeile wörtlich.

**K2** · `.claude/skills/schritt/SKILL.md:50` gegen `.claude/rules/daten.md:18` – „Zusätzlich nur: …“ zählt Kontrollrunde, weitere DB-Freigabe und Frage an `advisor` auf. Die Lösch-Freigabe fehlt, obwohl `daten.md:18` und das Gate sie verlangen (`gate-loesch.mjs:53-56`) und sie nur `advisor-report` schreiben darf (`guard.mjs:285`). Dem Wortlaut nach ist ein Aufruf verboten, den Regel und Gate fordern. Der alte Text („höchstens drei Aufrufe“) hatte dieselbe Lücke; mein Wortlaut zu M3 hat sie nicht geschlossen. Wirkung: Die Session hält an oder ruft den Berater gegen den Skill; das Gate bleibt zu. Fällig wird das bei der ersten Freigabe eines Registerskripts (`docs/OFFEN.md:9`, u1b-1).
Fix: in der Aufzählung nach „eine weitere DB-Freigabe je weiterem Antrag,“ einfügen „eine Lösch-Freigabe je freizugebendem Registerskript,“. Zeitpunkt wie K1: Eintrag in `docs/OFFEN.md`, Frist „vor der ersten Freigabe eines Registerskripts“.

### niedrig

- **K3** · `.claude/agents/advisor.md:11` – Die Datei nennt als Einzelfrage nur „Fehler nach 2 Runden rot“; `SKILL.md:50` erlaubt sie auch für eine Geld- oder Sicherheitsentscheidung, die der Plan nicht abdeckt. Ohne Folge (der Berater antwortet ohnehin). Fix bei Gelegenheit: „… wenn ein Fehler nach 2 Runden rot bleibt oder eine Entscheidung auftaucht, die der Plan nicht abdeckt.“
- **K4** · `.claude/hooks/guard.mjs:195`, `scripts/sys/run.mjs:2` (außerhalb der zehn Dateien) – Die Sperrmeldung des Guards und der Kopfkommentar des Start-Programms nennen das Ziel `shots:all` nicht, das die drei Textstellen seit M7 nennen. Nur Anzeige; die Sperre des Direktaufrufs greift (`guard.mjs:194`), das Ziel gibt es (`run.mjs:12`). Fix im nächsten Schritt, der die Gates ohnehin berührt.
- **K5** · `docs/OFFEN.md:11` (außerhalb der zehn Dateien) – `u2-1` hat keine Frist. Bis dahin ist die Textregel in `tests.md:15` und `SKILL.md:21` die einzige Sperre nach einem Treffer im zweiten Berichtslauf. Vorschlag: Frist „vor u3 und vor dem Entfall der `ask`-Regel für commit“ ergänzen (`docs/OFFEN.md` steht nicht in der Hash-Liste, die Änderung berührt die Abnahme nicht).

## Neu gebrochen?

Nein. Geprüft an den geänderten Stellen:
- `CLAUDE.md:52` und `daten.md:21` sind wortgleich; kein Widerspruch zur Übergangsregel `CLAUDE.md:15`.
- `CLAUDE.md:53` ist strenger als der Guard (der sperrt `git mv` nur für `docs/freigaben`, `guard.mjs:261`), kein Widerspruch.
- `tests.md:15` und `SKILL.md:21` trennen den Scan-Treffer vom blockierten Gate; beides endet in `bericht.mjs` mit Exit ungleich 0, aber nur beim blockierten Gate entsteht `bericht.json` (`bericht.mjs:89-90`, `:115`). Nach einem Treffer liegen die Kopien unversioniert im Arbeitsbaum, `fertig` blockiert dann schon am unsauberen Baum (`fertig.mjs:33`).
- `SKILL.md:18`: Die Zeilenform aus dem Auftrag passt auf das Muster des Gates (`gate-db-lib.mjs:45`: 64 Hex-Zeichen, Leerraum, Pfad ohne Leerzeichen).
- `SKILL.md:56` (Fortsetzung) umgeht kein Gate: `start-schritt` prüft nur die Ausgangslage, alle Pflichten prüft `fertig` am Ende erneut (`fertig.mjs:33-35`, `:184-194`).
- `SKILL.md:12`, `:54` und `CLAUDE.md:12` widersprechen sich nicht; Stufe und Modell bleiben Sache von `stufe.mjs` und `session.mjs`.
- Grenzen: `SKILL.md` 59 Zeilen (Grenze 80, `docs/SYSTEM_VORSCHLAG.md:198`), Regeln 13 bis 31 Zeilen (Grenze 40).
- Kein Verweis auf `test-runner` oder archivierte Doku in `.claude/**/*.md` (Grep, null Treffer).
- Pflichtmenge der Abnahme: Laut Git-Status zu Beginn sind weder `.claude/hooks/`, `.claude/settings.json`, `.githooks/`, `scripts/sys/` noch `package.json` geändert; `.claude/settings.json` enthält keinen `env`-Block (Grep), der Eintrag aus `docs/OFFEN.md:14` liegt also nicht in der Projektdatei. Die zehn genannten Dateien decken die Mindestmenge. Selbst nachgerechnet habe ich den Diff gegen `origin/main` nicht (kein Git-Werkzeug); das prüft `fertig.mjs:137`.

## Stichproben

| Datei:Zeile | Ergebnis |
|---|---|
| `scripts/sys/fertig.mjs:15` gegen `SKILL.md:18` | zehn Zweige des Musters, zehn Nennungen im Skill |
| `scripts/sys/fertig.mjs:49-55`, `:118`, `:136-137` | Abnahme-Pfad, Fable, genau eine Schlusszeile, Hash je Datei gegen den Arbeitsstand, Mindestmenge |
| `scripts/sys/bericht.mjs:47-51`, `:89-90`, `:115` | Abnahme und Schrittdateien werden kopiert; Scan vor `bericht.json`; Exit 1 bei blockiertem Gate |
| `scripts/sys/gate-db-lib.mjs:41-47`, `:58-60` | Urteil und Schlusszeile je genau einmal, zeilenverankert; Beleg K1 |
| `scripts/sys/gate-db.mjs:57` | Antrag enthält nur Pfad und Hash; Beleg K1 |
| `scripts/sys/gate-loesch.mjs:22-38`, `:53-56` | Übernahme und Freigabeprüfung wie in `daten.md:18`; Beleg K2 |
| `scripts/sys/gate-loesch-lib.mjs:36-44` | `sweep.ts` prüft Register und Freigabe selbst, nur im Lauf des Start-Programms |
| `scripts/sys/run.mjs:12`, `:28` | Ziel `shots:all` vorhanden; Shot-Datei geht an `test:e2e` (`u2-2`) |
| `scripts/sys/stufe.mjs:2`, `:7-10` | kein Herabstufen; `.claude/**`, `CLAUDE.md`, `package.json` sind R3 |
| `scripts/sys/start-schritt.mjs:10`, `:22` | verlangt `main`, legt den Branch neu an; die Fortsetzung braucht deshalb den Weg aus `SKILL.md:56` |
| `.claude/hooks/guard.mjs:11-12`, `:194`, `:261`, `:284-286` | Namenssperren, Direktaufruf der Tests samt `shots:all`, `git mv` in `docs/freigaben`, vorhandene Nachweise unveränderlich für Schreibwerkzeuge |
| `.claude/hooks/session.mjs:19-22` | prüft nur das Modell, nicht den Effort |
| `scripts/scan-proof.mjs:14`, `:44` | scannt `docs/proof`, Exit 1 bei Treffer |
| `package.json:55-56`, `:58`, `:68-73` | `shots`, `shots:all`, `scan:proof`, `db:antrag`, `db:push`, `loesch`, `t`, `bericht`, `fertig` wie in `CLAUDE.md:44-48` |
| `docs/OFFEN.md:11-12` | `u2-1` und `u2-2` vorhanden |
| `docs/SYSTEM_VORSCHLAG.md:196-198` | Zeilengrenzen 60, 40, 80 eingehalten |

Offene Findings hoch: 0
