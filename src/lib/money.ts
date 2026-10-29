// ponytail: 'de-DE' statt 'de-AT' für die Zahl, weil de-AT "€ 1 175,00" liefert, die Referenz aber "1.175,00 €" zeigt (OPEN_ISSUES).
const number = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const nbsp = String.fromCharCode(160)

/** Integer-Cent → "1.175,00 €" mit geschütztem Leerzeichen, damit Zahl und € nie umbrechen. */
export const formatEuro = (cents: number) => `${number.format(cents / 100)}${nbsp}€`
