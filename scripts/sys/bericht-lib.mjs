// Abnahme-Teil des Berichts (bericht.json und bericht.md): Pfad und SHA-256 der höchsten Runde, dazu die Kopie unter docs/proof.
// `kopie` ist der Rückgabewert von `kopiere` in bericht.mjs (bei abweichendem Inhalt trägt der Name einen Kurz-Hash), nie aus dem Namen gebildet.
export function abnahmeBericht({ abnahme, name, runde, kopie, sha256 }) {
  if (!abnahme) return { json: null, zeile: 'Abnahme: keine' }
  const quelle = `tmp/proof/${name}`
  const kopiePfad = kopie.replace(/\\/g, '/')
  return {
    json: { datei: kopiePfad, quelle, sha256, runde, hoch: abnahme.hoch, modell: abnahme.modell },
    zeile: `Abnahme: ${quelle} · SHA-256 ${sha256} · Kopie ${kopiePfad} · Runde ${runde} · Offene Findings hoch: ${abnahme.hoch}`,
  }
}
