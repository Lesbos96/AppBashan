export interface AbnahmeBericht {
  json: { datei: string; quelle: string; sha256: string; runde: number; hoch: number; modell: string } | null
  zeile: string
}
export function abnahmeBericht(a: {
  abnahme: { hoch: number; modell: string } | null
  name: string | null
  runde: number | null
  kopie: string | null
  sha256: string | null
}): AbnahmeBericht
