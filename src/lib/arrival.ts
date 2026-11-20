const NBSP = String.fromCharCode(160)

/** Die einzige Quelle der Fensterzeiten: Name und Stunden (von, bis) je Zeitfenster. */
const WINDOWS: Record<string, { name: string; from: number; to: number }> = {
  morning: { name: 'Vormittag', from: 8, to: 11 },
  midday: { name: 'Mittag', from: 11, to: 14 },
  afternoon: { name: 'Nachmittag', from: 14, to: 18 },
}
const FLEXIBLE = ['ganzer', 'Tag', 'ab', '8', 'Uhr'].join(NBSP)

const own = (w: string | null | undefined) => (w && Object.hasOwn(WINDOWS, w) ? WINDOWS[w] : undefined)

/** „8 bis 11 Uhr“, bei „Flexibel“ „ganzer Tag ab 8 Uhr“ (geschützte Leerzeichen: die Angabe bricht nie mittendrin um); `null` bei unbekanntem oder fehlendem Fenster. */
export function windowTimes(timeWindow: string | null | undefined): string | null {
  if (timeWindow === 'flexible') return FLEXIBLE
  const w = own(timeWindow)
  return w ? `${w.from} bis ${w.to}${NBSP}Uhr` : null
}

/** „Vormittag, 8 bis 11 Uhr“, bei „Flexibel“ „ganzer Tag ab 8 Uhr“; `null` bei unbekanntem oder fehlendem Fenster. */
export function windowLabel(timeWindow: string | null | undefined): string | null {
  const w = own(timeWindow)
  return w ? `${w.name}, ${windowTimes(timeWindow)}` : windowTimes(timeWindow)
}

const clock = new Intl.DateTimeFormat('de-AT', { hour: 'numeric', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Vienna' })

/** „Ankunft ca. 9:40 Uhr“ nach „Unterwegs“ (Wiener Zeit, Stunde ohne führende Null); die Zeit rechnet der Server. */
export function enRouteText(eta: Date, side: 'kunde' | 'firma'): string {
  const parts = Object.fromEntries(clock.formatToParts(eta).map((p) => [p.type, p.value]))
  return `${side === 'kunde' ? 'Die Firma ist unterwegs' : 'Du bist unterwegs'}, Ankunft ca.${NBSP}${Number(parts.hour)}:${parts.minute}${NBSP}Uhr`
}

/** Ankunftsfenster = das vom Kunden gewählte und von der Firma angenommene Zeitfenster. „Flexibel“ hat keins: nur ein Hinweis, je nach Seite. `null` bei unbekanntem oder fehlendem Fenster. */
export function arrivalText(timeWindow: string | null | undefined, side: 'kunde' | 'firma'): string | null {
  if (timeWindow === 'flexible') return side === 'kunde' ? 'Die Firma nennt dir die genaue Uhrzeit.' : 'Kunde ist flexibel – Uhrzeit mit dem Kunden abstimmen.'
  const w = own(timeWindow)
  return w ? `Ankunft zwischen ${w.from} und ${w.to}${NBSP}Uhr` : null
}
