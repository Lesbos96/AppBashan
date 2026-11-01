// Geteilt von Vitest (money.test.ts) und Deno (money-deno.ts): Erwartung als Text mit geschütztem Leerzeichen.
const nbsp = String.fromCharCode(160)

export const moneyCases: [cents: number, expected: string][] = [
  [0, '0,00'],
  [5, '0,05'],
  [99, '0,99'],
  [99999, '999,99'],
  [100000, '1.000,00'],
  [117500, '1.175,00'],
  [1234567, '12.345,67'],
  [68961, '689,61'],
  [100000000, '1.000.000,00'],
  [-1, '-0,01'],
  [-12345, '-123,45'],
  [-100000, '-1.000,00'],
].map(([cents, text]) => [cents as number, `${text}${nbsp}€`])

/** Ganze Euro, half-up (`formatEuroRounded`). */
export const roundedCases: [cents: number, expected: string][] = [
  [0, '0'],
  [49, '0'],
  [50, '1'],
  [149, '1'],
  [150, '2'],
  [117449, '1.174'],
  [117450, '1.175'],
  [117500, '1.175'],
  [117550, '1.176'],
  [99950, '1.000'],
  [155000, '1.550'],
  [100000000, '1.000.000'],
].map(([cents, text]) => [cents as number, `${text}${nbsp}€`])
