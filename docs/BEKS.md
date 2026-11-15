# MoveNow · Fragen an Beks

Stand 2026-11-15. Antworte im Chat mit den Nummern, zum Beispiel „1 ja, 2 nein, 3 ja“. Beantwortete Fragen werden hier gelöscht und in `docs/ENTSCHEIDUNGEN.md` eingetragen. Höchstens 15 Fragen; Weiteres steht in `docs/OFFEN.md`.

Die 15 Fragen vom 2026-11-14 sind beantwortet (ENTSCHEIDUNGEN Nr. 148 bis 162); ihre Folgearbeiten stehen in `docs/OFFEN.md`.

Die Fragen 1 bis 3 vom 2026-11-14 (u2b, u3b, s9k-1) sind beantwortet (ENTSCHEIDUNGEN Nr. 173 bis 175).

### 1. Passt die Auswahl der 14 Specs mit dem Tag `@breit` für den Desktop-Lauf von `e2e`?
- Worum es geht: Seit u4 läuft das Projekt `e2e-desktop` (1280 Pixel) nur noch für Specs mit Layoutbezug; das senkt die Zahl der Fälle von 756 auf 680 (302 statt 378 im Desktop-Projekt). Das Gate zählt keine Tests, die Abdeckung der Pflichtsuite sinkt also. Eine neue Spec ohne Tag läuft nur mit 390 Pixel. Viele der Specs setzen in Schleifen ihre Breite selbst (390, 430, 1280); diese Fälle laufen weiter in beiden Projekten.
- Empfehlung: Ja. Die Liste steht in ENTSCHEIDUNGEN Nr. 177.
- Bei „Nein“: `grep` in `playwright.config.ts` entfernen, Laufzeit wieder rund 18 Minuten (R3, klein).
- Aufwand: keiner
- Quelle: u4, Planprüfung Fable

### 2. Soll `rls` doch in zwei Projekte geteilt werden, wenn es dafür einen eigenen Schritt gibt?
- Worum es geht: Du hattest `rls-tx` (zwei Arbeiter) und `rls-live` (nacheinander) beauftragt. Fable hat es in u4 abgelehnt (ENTSCHEIDUNGEN Nr. 176): Die Rollback-Proben halten Tabellensperren und schreiben in globale Zeilen, zwei Arbeiter liefen bei Überlappung in einen Deadlock (`40P01`); parallel bleiben nur sieben Dateien, Ersparnis unter 1 Minute von rund 26. Die Zeit liegt in den LIVE-Dateien (`partner-functions-live` 315 s, `flow-live` 183 s, `uploads` 137 s, zusammen mit den übrigen rund 1290 s).
- Empfehlung: Nein, `rls` bleibt ein Arbeiter. Ein echter Gewinn käme nur aus einer lokalen Supabase-Instanz (`docs/SYSTEM_VORSCHLAG.md` 3 c, Alternative) oder aus weniger Live-Wartezeit in den drei langsamsten Dateien.
- Bei „Ja“: eigener R3-Schritt mit Tabellenliste, `groupOrder`, `globalSetup` je Projekt idempotent; der Satz „sequenziell“ in `.claude/rules/tests.md` braucht deine Zustimmung.
- Aufwand: bei Ja mittel (R3)
- Quelle: u4, Planprüfung Fable

## Hinweise
- Der Satz „rls läuft gegen die lebende Dev-Datenbank“ gilt, weil Dev Testreste behält und sich ändert; `e2e` nutzt Mocks (OFFEN S9i7c2-4).
- Zwei Bestätigungen stehen nur in `docs/OFFEN.md`: Obergrenze für Nachträge je Auftrag und Stunde (S9i7-4) und eine einzige USt.-Regel für alle Firmen bis Phase 2 (S9b0-B).
