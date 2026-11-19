# rl1 Plan und Auflagen (Fable, advisor, 2026-11-19)

Entscheidung: ja mit Änderungen. Keine Migration; Schlüssel je Konto statt je Firma freigegeben.

Plan (Sonnet): `photo-receipt` zählt mit `take_rate_tokens` vor dem Lesen des Bodys; Grenzen 24 je Anfrage und Tag, 20 je Konto und Minute, 300 je Konto und Tag; 429 ohne Wirkung; 503 fail closed; Dedupe aus 0073 unberührt.

Auflagen (bindend, umgesetzt):
1. Zwei `takeTokens`-Aufrufe: `receipt:min:<hmac(user)>` VOR dem Tor (`photo_receipt_check` sperrt `service_requests` mit `for update`, 0073:24), danach das Tor, danach `[receiptreq:day, receipt:day]` in dieser Reihenfolge. Grund: ein vom Minuten-Zähler abgelehnter Aufruf soll das Tagesbudget der Anfrage nicht verbrauchen (0008 zählt vor dem Vergleich); der Anfrage-Zähler steht nach dem Tor, damit fremde Konten ihn nicht verbrauchen.
2. Unit-Tests: Minuten-429 verbraucht weder Anfrage- noch Tageszähler und ruft das Tor nicht auf; Tor-Fehler verbraucht nur den Minuten-Zähler; Anfrage-429 lässt `receipt:day` unberührt. Grenzen als exportierte Konstante `RECEIPT_LIMITS`.
3. `RATE_LIMIT_SECRET` Pflicht in `photo-receipt/index.ts`; 503 mit festem Logtext ohne IDs und Eimer; 429 ohne Log.
4. Live-Test: Schleife bis 429 (höchstens 45 Aufrufe), dann gültiges JPEG: 429, keine Zeile, kein Objekt; als letzter Block der Datei; Konten je Lauf neu (`makeUser` mit Lauf-Kennung).
5. Deploy der vier Functions, die `photo/handlers.ts` laden. OFFEN S9d-4 schließen; `job-photo` ohne Zähler als OFFEN mit Empfehlung; `admin-photo` und `photo-publish` brauchen keine Grenze.
6. Der Client wiederholt 429 nicht automatisch (Uploads laufen nacheinander, `Absage.tsx`, `Nachtrag.tsx`).
