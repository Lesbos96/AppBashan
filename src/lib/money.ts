const number = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const nbsp = String.fromCharCode(160)

// ponytail: de-AT trennt Tausender mit Leerzeichen, die Referenz zeigt "1.175,00 €" (österreichische Schreibweise); Gruppen-Trenner daher auf Punkt gesetzt.
const parts = (cents: number) => number.formatToParts(cents / 100).map((p) => (p.type === 'group' ? '.' : p.value)).join('')

/** Integer-Cent → "1.175,00 €" mit geschütztem Leerzeichen, damit Zahl und € nie umbrechen. */
export const formatEuro = (cents: number) => `${parts(cents)}${nbsp}€`
