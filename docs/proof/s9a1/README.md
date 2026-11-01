# Hinweise zu den Nachweisen S9a-1

Nachweisdateien bleiben nach dem Schreiben unverändert; Hinweise stehen hier.

- **`s9a1-rotbeweis.md` ist für sechs Sperren überholt.** „Marker-Prüfung von guard_price_version“, „guard_profile_role: Tausch von profiles.id“, „Trigger guard_role“, „is_admin() ohne aal2“, „price_versions_select für alle“ und „profiles_select: admin ohne aal2“ gelten nur in der Fassung `s9a1-rotbeweis-nachpruefung.md`. Die Rot-Zeilen in `s9a1-rotbeweis.md` zeigten dort einen anderen Fehler (42501, 23503) oder nur `P0001: false`.
- Dieser Hinweis stand zuvor als eingefügter Absatz in `s9a1-rotbeweis.md` (Commit `ef189b0`); er wurde dort entfernt, der Text der Datei ist sonst unverändert.
- Weitere Einschränkung (Nachprüfung, M2): 17 der 23 Rot-Beweise prüfen nur den Schritt, nicht den Ist-Wert; Umstellung in `docs/OPEN_ISSUES.md` (M2, vor Livegang).
