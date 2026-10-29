const nbsp = String.fromCharCode(160)

/** Integer-Cent → "1.175,00 €" (Tausenderpunkt, Dezimalkomma, geschütztes Leerzeichen vor €). Ohne Intl, damit Node, Deno und Browser dasselbe liefern. */
export function formatEuro(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError(`formatEuro erwartet ganze Cent, erhielt ${cents}`)
  const abs = Math.abs(cents)
  const euros = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const rest = String(abs % 100).padStart(2, '0')
  return `${cents < 0 ? '-' : ''}${euros},${rest}${nbsp}€`
}
