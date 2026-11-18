const NBSP = String.fromCharCode(160)

const RANGE: Record<string, [number, number]> = { morning: [8, 11], midday: [11, 14], afternoon: [14, 18] }

/** Ankunftsfenster = das vom Kunden gewählte und von der Firma angenommene Zeitfenster. „Flexibel“ hat keins: nur ein Hinweis, je nach Seite. `null` bei unbekanntem oder fehlendem Fenster. */
export function arrivalText(timeWindow: string | null | undefined, side: 'kunde' | 'firma'): string | null {
  if (timeWindow === 'flexible') return side === 'kunde' ? 'Die Firma nennt dir die genaue Uhrzeit.' : 'Kunde ist flexibel – Uhrzeit mit dem Kunden abstimmen.'
  const r = timeWindow ? RANGE[timeWindow] : undefined
  return r ? `Ankunft zwischen ${r[0]} und ${r[1]}${NBSP}Uhr` : null
}
