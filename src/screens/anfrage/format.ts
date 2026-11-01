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
