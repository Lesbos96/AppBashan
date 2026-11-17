const NBSP = String.fromCharCode(160)
const WINDOW_MS = 30 * 60 * 1000

const clock = new Intl.DateTimeFormat('de-AT', { hour: 'numeric', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Vienna' })

/** Festes Ankunftsfenster: `termin_at` bis `termin_at` + 30 Minuten, Wiener Zeit. `null`, wenn der Termin fehlt oder unlesbar ist. */
export function arrivalText(terminAt: Date | string | null | undefined): string | null {
  const start = terminAt instanceof Date ? terminAt : terminAt ? new Date(terminAt) : null
  if (!start || Number.isNaN(start.getTime())) return null
  const t = (d: Date) => clock.format(d)
  return `Ankunft zwischen ${t(start)} und ${t(new Date(start.getTime() + WINDOW_MS))}${NBSP}Uhr`
}
