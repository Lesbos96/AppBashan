const long = new Intl.DateTimeFormat('de-AT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const short = new Intl.DateTimeFormat('de-AT', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

/** `YYYY-MM-DD` → Millisekunden (UTC-Mitternacht); Tage werden nur als Kalenderdatum behandelt, nie als Zeitpunkt. */
export const utc = (date: string) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return Date.UTC(y, m - 1, d)
}

export const longDay = (ms: number) => long.format(ms)
/** „Freitag, 13. November 2026“ */
export const dayText = (date: string | null) => (date ? long.format(utc(date)) : '')
/** „Fr., 13. Nov.“ */
export const shortDayText = (date: string | null) => (date ? short.format(utc(date)) : '')

const nbsp = String.fromCharCode(160)
const km = (v: number) => `${v.toFixed(1).replace('.', ',')}${nbsp}km`
/**
 * „4,8 km · innerhalb Wiens“ bzw. „196,1 km · 186,5 km außerhalb Wiens“ (Termin und Zusammenfassung).
 * Zahl und Einheit sowie „innerhalb/außerhalb Wiens“ bleiben zusammen; umbrechen darf die Zeile nur am Mittelpunkt (OPEN_ISSUES S8b-Abschluss).
 */
export const routeText = (r: { distanceKm: number; outsideKm: number }) =>
  `${km(r.distanceKm)} · ${r.outsideKm > 0 ? `${km(r.outsideKm)} außerhalb${nbsp}Wiens` : `innerhalb${nbsp}Wiens`}`
