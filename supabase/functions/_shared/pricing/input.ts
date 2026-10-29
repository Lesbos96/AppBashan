// Strikte Prüfung von Kundeneingaben (Grundlage für die `inputs`-Prüfung in `quote`, S8a).
// Die parse*-Funktionen lesen nur die Preisfelder; alle anderen Schlüssel werden verworfen und können den Preis nicht beeinflussen.
// Serverfakten (Region, Kilometer, Mietangebot) kommen nie hierüber, sondern als eigene Parameter der compute*-Funktionen.

export class InputError extends Error {}

export type Raw = Readonly<Record<string, unknown>>

export function rec(raw: unknown, what = 'Eingabe'): Raw {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new InputError(`${what}: Objekt erwartet`)
  return raw as Raw
}

export function dec(r: Raw, key: string, min: number, max: number): number {
  const v = r[key]
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new InputError(`${key}: Zahl zwischen ${min} und ${max} erwartet`)
  return v
}

export function int(r: Raw, key: string, min: number, max: number): number {
  const v = dec(r, key, min, max)
  if (!Number.isInteger(v)) throw new InputError(`${key}: ganze Zahl erwartet`)
  return v
}

export function bool(r: Raw, key: string): boolean {
  const v = r[key]
  if (typeof v !== 'boolean') throw new InputError(`${key}: true oder false erwartet`)
  return v
}

export function oneOf<T extends string>(r: Raw, key: string, values: readonly T[]): T {
  const v = r[key]
  if (typeof v !== 'string' || !(values as readonly string[]).includes(v)) throw new InputError(`${key}: einer von ${values.join(', ')} erwartet`)
  return v as T
}
