// Wiener Ortszeit für Mietzeiten. Das Preismodul zählt Miettage nach Wanduhrzeit `YYYY-MM-DDTHH:mm`;
// ISO-Zeitpunkte mit Z oder Offset lehnt `parseRentalInput` ab.
import { InputError } from '../pricing/index.ts'

const ZONE = 'Europe/Vienna'

const format = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** Wiener Wanduhrzeit eines Zeitpunkts. */
function wallOf(ms: number): string {
  const p = Object.fromEntries(format.formatToParts(ms).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/**
 * Zeitpunkt (ms) einer Wiener Wanduhrzeit. Wien liegt bei UTC+1 oder UTC+2: Passt keine der beiden Möglichkeiten,
 * gibt es die Uhrzeit nicht (Sommerzeit-Beginn). In der doppelten Stunde im Herbst gilt der frühere Zeitpunkt.
 */
export function viennaWallToInstant(wall: string, key: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(wall)
  if (!m) throw new InputError(`${key}: Format YYYY-MM-DDTHH:mm erwartet`)
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number]
  const asUtc = Date.UTC(y, mo - 1, d, h, mi)
  const hit = [2, 1].map((hours) => asUtc - hours * 3_600_000).find((ms) => wallOf(ms) === wall)
  if (hit === undefined) throw new InputError(`${key}: diese Uhrzeit gibt es wegen der Zeitumstellung nicht`)
  return hit
}

/** Zeitpunkt (ISO, UTC) für die Spalte aus der Wiener Wanduhrzeit. */
export const instantOf = (wall: string, key: string): string => new Date(viennaWallToInstant(wall, key)).toISOString()

/** Heutiges Datum in Wien (`YYYY-MM-DD`). */
export const viennaToday = (now = Date.now()): string => wallOf(now).slice(0, 10)
