# ts1 Bildsicht-Review (Turnstile-Karte)

Gelesen: CaptchaHost.tsx, Diff Shell.tsx, Anmelden.tsx, route.ts, Button.tsx (plain: h-12 = 48 px, text-accent), acht Screenshots.

## Findings
- [niedrig] CaptchaHost.tsx:33 – Dark: Kartenfläche (bg-background) ist von der Seite darunter nur durch die 0,5-px-Kontur unterscheidbar (anmelden-captcha dark, kein Dim sichtbar). Das Adress-Sheet im selben Dark-Shot trennt sich genauso, also konsistent. Fix optional: bg-surface oder stärkere Kontur.
- [niedrig] CaptchaHost.tsx:37 – Bei 1280 px bricht der Satz mit Einzelwort „können.“ in Zeile 2 um. Fix: `text-balance` an dem `<p>`.
- [niedrig] CaptchaHost.tsx:23 – Dialog hat nur `aria-label`, keinen sichtbaren Titel und keinen Griff wie die Sheets (diese haben Griff, Titel, X). Für eine kurze Systemkarte vertretbar; Fix optional: `aria-describedby` auf den Text.
- [niedrig] CaptchaHost.tsx – Keine Animation/Transition im Quelltext, daher greift `prefers-reduced-motion` nicht und ist auch nicht nötig. Kein Mangel; kein Fade beim Öffnen.

Keine hohen oder mittleren Findings. Nicht per Bild prüfbar und daher nur nach Quelltext belegt: Touch-Ziel „Abbrechen“ = h-12 (48 px) ≥ 44; Fokus beim Öffnen und Fokusfalle durch `showModal()`, Esc über `onCancel` und `cancelCaptcha`, Fokus zurück zum Auslöser durch den Browser; Text de-AT per Du; keine Gebühr, kein Emoji. Die Maße selbst nicht per boundingBox gemessen (Hinweis: Kartenbreite bei 1280 grob 520 CSS-px, zentriert, per Bild nur geschätzt, nicht als Beleg zählen).

## Shot-Tabelle
| Bild | Eigene Beobachtung |
|---|---|
| 390 light anmelden | Karte bündig am unteren Rand, Fläche hellgrau (#F1F3F2-Ton), obere Ecken stark gerundet; Fließtext grau-blau, gut lesbar; „Abbrechen“ in dunklem Teal; Seite dahinter grau abgedunkelt, „Code senden“ ausgegraut sichtbar, nichts verdeckt außer dem unteren Bereich. |
| 390 light umzug | Karte liegt über dem Adress-Sheet „Abholung“ (Sheet-Griff, Titel, X und „Adresse suchen“ dahinter abgedunkelt sichtbar); Karte deckt nur die untere Sheet-Fläche, Eingabefeld und Schalter bleiben unverdeckt, aber nicht bedienbar (modal). |
| 390 dark anmelden | Karte nahezu gleichfarbig mit dem Hintergrund (Petrol-Schwarz), nur dünne helle Kontur oben erkennbar; Text hellgrau, „Abbrechen“ in hellem Mint, Kontrast klar ausreichend. |
| 390 dark umzug | Wie Light über dem Sheet; Karte und Sheet im Dark kaum unterscheidbar, Trennung nur durch die obere Kontur der Karte (Zeile bei ca. y=1287 sichtbar); „Abbrechen“ mint, lesbar. |
| 1280 light anmelden | Karte als zentrierte Spalte (Breite wie Content-Spalte, nicht bildbreit), unten an die Fensterkante gesetzt; Satz bricht mit Einzelwort „können.“ um; Hintergrund gleichmäßig grau abgedunkelt. |
| 1280 light umzug | Karte exakt so breit wie das dahinterliegende Sheet und bündig darunter, Sheet-Inhalt (Toggle in Teal, Hinweistext) dahinter abgedunkelt erkennbar; Karte klar über dem Sheet. |
| 1280 dark anmelden | Karte nur durch feine Kontur und die gerundeten Ecken sichtbar, Fläche = Hintergrund; Text hellgrau, „Abbrechen“ mint; Umbruch „können.“ wie Light. |
| 1280 dark umzug | Sheet dahinter mit Toggle in dunklem Teal, Karte darüber ohne Flächenunterschied, nur Kontur oben trennt; Inhalt lesbar, nichts abgeschnitten. |

Vergleich Stil: Rundung, Kontur und Schatten stimmen mit den vorhandenen Sheets überein (Sheet-Token `rounded-t-sheet-top`, `shadow-sheet`, `bg-sheet-dim`). Ein Referenz-Screen für dieses Sheet existiert nicht.
