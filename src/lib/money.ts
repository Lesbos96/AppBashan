const nbsp = ' '

/** Integer-Cent → "1.175,00 €" (Tausenderpunkt, Dezimalkomma, geschütztes Leerzeichen vor €). Ohne Intl, damit Node, Deno und Browser dasselbe liefern. */
export function formatEuro(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError(`formatEuro erwartet ganze Cent, erhielt ${cents}`)
  const abs = Math.abs(cents)
  const euros = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const rest = String(abs % 100).padStart(2, '0')
  return `${cents < 0 ? '-' : ''}${euros},${rest}${nbsp}€`
}

/** Integer-Cent → ganze Euro, half-up: "1.175 €". Für Schätzpreise und Spannen; Festpreise zeigt `formatEuro` mit Cent. Nur für die Anzeige. */
export function formatEuroRounded(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError(`formatEuroRounded erwartet ganze Cent ≥ 0, erhielt ${cents}`)
  const euros = Math.floor(cents / 100) + (cents % 100 >= 50 ? 1 : 0)
  return `${String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${nbsp}€`
}
