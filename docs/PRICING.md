# MoveNow · Preislogik

Modul: `supabase/functions/_shared/pricing/` (rein, ohne Abhängigkeiten, Importe mit `.ts`). Tarife kommen als Parameter aus `price_config` (Seed: `supabase/seed.sql`), der Gebührensatz aus `platform_settings`. Beträge sind ganze Cent. Intern wird wie im Prototyp in Euro gerechnet (Tarif / 100) und erst am Ende gerundet.

## Aufbau
- `compute*`: Kundenpreis (`price` mit Zeilen, Spanne) oder `offer` mit Gründen. Keine Gebührenfelder.
- `splitFee(totalCents, {feeRate, vatRate})`: einzige Stelle der Gebührenaufteilung.
- `parse*Input`: strikte Prüfung der Kundenwahl (Grundlage für `quote`, S8a). Sie liest nur Preisfelder, andere Schlüssel werden verworfen. Region, Kilometer und Fahrzeit (`RouteFacts`, aus `route`) sowie das Mietangebot (`RentalOffer`, per id aus der DB) sind eigene Parameter und nie Teil der Kundeneingabe.
- Zeilen: Gesamtpreis = Rundung der ungerundeten Summe (wie `cents(total)` im Prototyp); die Zeilen werden nach dem Largest-Remainder-Verfahren so gerundet, dass sie immer das Total ergeben.

## Abweichungen vom Prototyp
| Stelle | Prototyp | Modul | Grund |
| --- | --- | --- | --- |
| Gebührenrundung | Float: `cents(total*.15)`; bei exakten Halb-Cent-Beträgen entscheidet die Binärdarstellung (EPSILON wirkt ab ca. 2 € nicht mehr) | Ganzzahl, half-up; Sätze als Basispunkte | Reproduzierbar und centgenau; Fixture: Total 111,50 € → Prototyp 16,72 €, Modul 16,73 € (16,725 €) |
| Gebühr bei Entrümpelung und Montage | aus der ungerundeten Summe | aus dem gerundeten Gesamtpreis (in Cent) | Gebühr gehört zum gespeicherten Gesamtpreis |
| Miettage | `new Date(...)` in Ortszeit; über die Sommerzeitumstellung entsteht ein Tag zu viel | Wanduhrzeit per `Date.UTC`, angebrochene Tage zählen voll | Kein Fehler bei Zeitumstellung (24.–26.10.2026: 2 Tage, nicht 3) |
| Rückgabe vor Abholung | mindestens 1 Tag | `InputError`; höchstens 90 Tage | Nur gültige Zeiträume, Server prüft |
| Umzug-Klick | ReferenceError `moveRouteHTML` | nicht übernommen | Prototyp-Fehler, siehe OPEN_ISSUES.md; die Preislogik ist nicht betroffen |
| Gründe für „Persönliches Angebot" | deutsche Texte im Code | Codes (`OfferReason`); Texte in der UI (S6, S7) | Modul bleibt textfrei |
| Route fehlt | prüft zusätzlich, ob die Route zu den Adressen passt | `route === null` | Passung prüft der Server beim Aufruf von `route` |
| Mindeststunden | `s.hours \|\| 3` | `hours` muss 0,5–100 sein | Keine stille Vorgabe von 3 h |
| Eingabegrenzen | keine | siehe Abschnitt Eingabegrenzen | Server prüft Kundenwahl (`parse*Input`) |
| Fläche → Volumen | nur mit gesetztem Objekt | immer (Objekt ist Pflichtfeld) | |
| km außerhalb Wiens | Abtasten in ca. 50-m-Schritten gegen die Nominatim-Grenze | PostGIS: `ST_Difference` mit der Wiener Grenze, geodätische Länge, auf 0,1 km gerundet und auf die Gesamtstrecke begrenzt | Exakt statt Näherung; Abweichung höchstens im Bereich der Abtastschritte |
| Region „international" | irgendeine Adresse mit Land ≠ AT (Länderkürzel der Nominatim-Treffer) | Abholung oder Ziel liegt nicht im Österreich-Polygon (serverseitig) | Ländercodes vom Client sind nicht verifizierbar |
| Depot (Partnerstandort) | optionaler Startpunkt der Route | entfällt | Keine Partner in dieser Phase; Rückfahrt zur Abholung bleibt als Flag `returnTrip` |

## Eingabegrenzen
Alle Grenzen stehen an einer Stelle: `limits.ts` (`LIMITS`, exportiert über `@pricing`). Sie sind Obergrenzen gegen unsinnige oder bösartige Eingaben, keine Preisregeln; Änderungen nur dort.

| Feld | Grenze |
| --- | --- |
| Personen | 1–8 |
| Fahrzeuge | 1–3 |
| Stunden | 0,5–100 |
| Etagen | 0–20 |
| Kartons | 0–200 |
| Halteverbotszonen | 0–2 |
| Montage (lfm je Teil) | 0–50 |
| Entrümpelung Fläche | 1–2000 m² |
| Miete Kilometer | 0–10.000 |
| Mietdauer | höchstens 90 Tage |

Tarifvollständigkeit: `REQUIRED_TARIFF_KEYS` (`tariffs.ts`, exportiert über `@pricing`) listet alle Schlüssel, die das Modul liest; `quote` rechnet nur mit einem vollständigen Satz und bricht sonst ab. Ein Test vergleicht die Liste mit den Nicht-`ref`-Schlüsseln aus `supabase/seed.sql`.

Miettage zählen nach Wanduhrzeit (`YYYY-MM-DDTHH:mm` ohne Zeitzone, `Date.UTC`); die Rechnung hängt damit nicht von der Zeitzone des Servers ab. Tests für beide Umstellungen 2026 (29.03. und 25.10.) stehen in `tests/unit/pricing.test.ts`. `quote` nimmt Wiener Wanduhrzeit oder ISO-Zeitpunkte (Z/Offset) und rechnet Letztere vor der Berechnung in Wiener Wanduhrzeit um (`_shared/quote/time.ts`; Folge der Wanduhrzählung: Über die Herbst-Umstellung zählen 24,5 reale Stunden als ein Tag, Tests in `tests/unit/quote.test.ts`: 29.03. 11:00 → 11:30 MESZ = 2 Tage, 25.10. 11:00 MESZ → 10:30 MEZ = 1 Tag, obwohl die UTC-Differenz anders zählen würde).

## Stichproben-Richtwerte und Quellen
Alle Tarife sind Stichproben-Richtwerte (Recherche 28.10.2026), keine Marktdurchschnitte. Einzelquellen, Label und URL stehen je Schlüssel in `supabase/seed.sql` (`price_config.sources`); die App zeigt sie im Info-Sheet „Wie rechnet MoveNow?" (S4).

| Bereich | Schlüssel | Herleitung |
| --- | --- | --- |
| Team 1 / 3 / 4 Personen | `team_rate.1/3/4` | je ein Anbieter (Extraumzug 48 €, Umzugsprinz 70,80 € / 100,80 €) |
| Team 2 Personen | `team_rate.2` | Mittel aus Schindler 42, Delta 50, Alpine 59, Wiener Möbelpacker 72 € = 55,75 €/h |
| Zusatzperson, Zusatzfahrzeug, km, Karton, Halteverbot | `team_rate.extra_person`, `extra_vehicle_rate`, `outside_km_rate`, `box`, `parking_zone` | je ein Anbieter (Schindler, UmzugsPower, Ideal), netto → brutto mit 20 % |
| Mindestdauer | `min_hours.*` | Alpine 2 h, Delta 3 h |
| Klavier | `piano.*` | Runiton; nur Preisorientierung im Angebotspfad, kein Preis |
| Entrümpelung | `clearance.rate*` | Mittel (60 + 65 + 100) / 3 = 75 €/m³, Spanne 60–100 € (Vectura, Kraftpack) |
| Montage | `assembly.rate_per_lfm`, `kitchen.*` | Mittel (42 + 46,60 + 55) / 3 = 47,87 €/lfm; Küchenwerte DasUmzugsteam |
| Ohne Einzelquelle | `clearance.minimum`, `clearance.floor_surcharge`, `assembly.min_lfm`, Teil von 47,87 (46,60 €) | Prototyp v13; siehe OPEN_ISSUES.md |
| Planannahmen | `clearance.volume_factor.*` | Fläche → Volumen, keine Messung |

Miete: Tarife stehen je Fahrzeug in `rental_offers` (Vermieter), nicht in `price_config`. Kaution und Kraftstoff sind nie Teil des Gesamtpreises.

## Tests
- `tests/unit/pricing.test.ts`: fünf README-Beispiele centgenau, 60 Golden-Fälle (`tests/unit/fixtures/prototype-golden.json`, erzeugt aus dem Prototyp mit `npm run fixtures:pricing`), Gebührenaufteilung inkl. Halb-Cent-Fälle, Angebotspflicht, Tarif- und Eingabeprüfung, Sommerzeit.
- `tests/unit/pricing.property.test.ts` (fast-check, je 1000 Läufe): Zeilensumme = Gesamtpreis, Gebühr + Partner = Gesamtpreis, netto + USt. = Gebühr, keine NaN, negativen oder unganzen Beträge, ungültige Eingabe wirft `InputError`.
- Deno: `npm run check:deno` prüft das Modul mit `deno check` und lässt dieselben Golden-Fälle unter Deno laufen (`tests/unit/golden-deno.ts`, Teil von `npm run check`). Deno kommt als npm-Dev-Dependency `deno`.
