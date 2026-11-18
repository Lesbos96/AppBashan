const NBSP = String.fromCharCode(160)

const RANGE: Record<string, [number, number]> = { morning: [8, 11], midday: [11, 14], afternoon: [14, 18] }

const clock = new Intl.DateTimeFormat('de-AT', { hour: 'numeric', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Vienna' })

/** „Ankunft ca. 9:40 Uhr“ nach „Unterwegs“ (Wiener Zeit, Stunde ohne führende Null); die Zeit rechnet der Server. */
export function enRouteText(eta: Date, side: 'kunde' | 'firma'): string {
  const parts = Object.fromEntries(clock.formatToParts(eta).map((p) => [p.type, p.value]))
  return `${side === 'kunde' ? 'Die Firma ist unterwegs' : 'Du bist unterwegs'}, Ankunft ca.${NBSP}${Number(parts.hour)}:${parts.minute}${NBSP}Uhr`
}

/** Ankunftsfenster = das vom Kunden gewählte und von der Firma angenommene Zeitfenster. „Flexibel“ hat keins: nur ein Hinweis, je nach Seite. `null` bei unbekanntem oder fehlendem Fenster. */
export function arrivalText(timeWindow: string | null | undefined, side: 'kunde' | 'firma'): string | null {
  if (timeWindow === 'flexible') return side === 'kunde' ? 'Die Firma nennt dir die genaue Uhrzeit.' : 'Kunde ist flexibel – Uhrzeit mit dem Kunden abstimmen.'
  const r = timeWindow ? RANGE[timeWindow] : undefined
  return r ? `Ankunft zwischen ${r[0]} und ${r[1]}${NBSP}Uhr` : null
}
