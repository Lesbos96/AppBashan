// Wiener Ortszeit für Mietzeiten (S8a). Das Preismodul zählt Miettage nach Wanduhrzeit `YYYY-MM-DDTHH:mm`;
// ISO-Zeitpunkte mit Z oder Offset werden vor der Berechnung in Wiener Wanduhrzeit umgerechnet.
import { InputError } from '../pricing/index.ts'

const ZONE = 'Europe/Vienna'
const WALL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

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

/** Wanduhrzeit (Wien) oder ISO-Zeitpunkt → Wanduhrzeit (Wien). Alles andere bleibt unverändert, `parseRentalInput` lehnt es ab. */
export function toViennaWall(value: unknown): unknown {
  if (typeof value !== 'string' || WALL.test(value) || !INSTANT.test(value)) return value
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? wallOf(ms) : value
}

/**
 * Zeitpunkt (ms) einer Wiener Wanduhrzeit. Wien liegt bei UTC+1 oder UTC+2: Passt keine der beiden Möglichkeiten,
 * gibt es die Uhrzeit nicht (Sommerzeit-Beginn). In der doppelten Stunde im Herbst gilt der frühere Zeitpunkt.
 */
export function viennaWallToInstant(wall: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(wall)
  if (!m) throw new InputError('Zeit: Format YYYY-MM-DDTHH:mm erwartet')
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number]
  const asUtc = Date.UTC(y, mo - 1, d, h, mi)
  const hit = [2, 1].map((hours) => asUtc - hours * 3_600_000).find((ms) => wallOf(ms) === wall)
  if (hit === undefined) throw new InputError('Zeit: diese Uhrzeit gibt es wegen der Zeitumstellung nicht')
  return hit
}

/** Zeitpunkt (ISO, UTC) für die Spalte: ISO-Eingaben unverändert (auch in der doppelten Herbststunde), Wanduhrzeit über `viennaWallToInstant`. */
export function instantOf(raw: unknown, wall: string): string {
  return new Date(typeof raw === 'string' && INSTANT.test(raw) ? Date.parse(raw) : viennaWallToInstant(wall)).toISOString()
}

/** Heutiges Datum in Wien (`YYYY-MM-DD`). */
export const viennaToday = (now = Date.now()): string => wallOf(now).slice(0, 10)
