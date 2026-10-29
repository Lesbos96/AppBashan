// Geld-Grundlagen. Das Modul rechnet wie der Prototyp in Euro (Tarif / 100) und rundet erst am Ende auf Cent.

/** Tarife aus `price_config`: Schlüssel → Wert (Geldwerte in Cent, sonst Einheit laut Tabelle). */
export type Tariffs = Readonly<Record<string, number>>

/** Rundung wie cents() im Prototyp (Zeile 34), aber als ganze Cent: Euro → Cent. */
export const toCents = (euro: number): number => Math.round((euro + Number.EPSILON) * 100)

const tariff = (t: Tariffs, key: string): number => {
  const v = t[key]
  if (v === undefined || !Number.isFinite(v) || v < 0) throw new Error(`Tarif fehlt: ${key}`)
  return v
}

/** Geldtarif in Euro: ganze Cent / 100 (gleiche Doubles wie die Literale im Prototyp, z. B. 5575 / 100 = 55.75). */
export const money = (t: Tariffs, key: string): number => {
  const v = tariff(t, key)
  if (!Number.isInteger(v)) throw new Error(`Geldtarif ohne ganze Cent: ${key}`)
  return v / 100
}

/** Tarif ohne Geldeinheit (Stunden, m³/m², Laufmeter), ungeteilt. */
export const num = tariff

/** Eine Preiszeile für Kunden, auf Cent gerundet. Die Zeilen ergeben immer den Gesamtpreis. */
export type Line<K extends string = string> = { key: K; cents: number }

/**
 * Das Total ist die Rundung der ungerundeten Summe (wie `cents(total)` im Prototyp). Die Zeilen werden nach dem
 * Largest-Remainder-Verfahren gerundet: abrunden, Restcents an die größten Nachkommareste (Gleichstand: Reihenfolge).
 * Jede Zeile liegt so unter 1 Cent neben ihrem exakten Wert.
 */
export function toLines<K extends string>(euros: ReadonlyArray<readonly [K, number]>): { lines: Line<K>[]; totalCents: number } {
  if (!euros.every(([, v]) => Number.isFinite(v) && v >= 0)) throw new Error('Preiszeile ungültig')
  const totalCents = toCents(euros.reduce((sum, [, v]) => sum + v, 0))
  const rows = euros
    .filter(([, v]) => v !== 0)
    .map(([key, v]) => {
      const exact = v * 100
      const floor = Math.floor(exact + 1e-7)
      return { key, cents: floor, frac: exact - floor }
    })
  const rest = totalCents - rows.reduce((sum, r) => sum + r.cents, 0)
  if (rest < 0 || rest > rows.length) throw new Error('Rundung der Preiszeilen nicht auflösbar')
  const order = [...rows.keys()].sort((a, b) => rows[b]!.frac - rows[a]!.frac || a - b)
  for (const i of order.slice(0, rest)) rows[i]!.cents += 1
  return { lines: rows.map(({ key, cents }) => ({ key, cents })), totalCents }
}
