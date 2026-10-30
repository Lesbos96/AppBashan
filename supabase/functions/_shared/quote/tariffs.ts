// Tarife für `quote` (S8a). Der Server rechnet nur mit einem vollständigen Tarifsatz: fehlt ein Schlüssel, bricht er ab,
// statt einen Teilpreis zu speichern (das Preismodul würde erst beim ersten Zugriff auf den Schlüssel werfen).
import { REQUIRED_TARIFF_KEYS, type Tariffs } from '../pricing/index.ts'

export class TariffError extends Error {}

export type PriceConfigRow = { key: string; value: unknown; unit: string }

/**
 * Zeilen aus `price_config` → Tarife. Zeilen mit Einheit `ref` (z. B. `rental.reference`) sind Quellenverweise ohne Tarif
 * und gelangen nie in die Tarife. Fehlende oder ungültige Schlüssel wirft `TariffError`.
 */
export function buildTariffs(rows: readonly PriceConfigRow[]): Tariffs {
  const tariffs: Record<string, number> = {}
  for (const r of rows) {
    if (r.unit === 'ref') continue
    const v = typeof r.value === 'string' ? Number(r.value) : r.value
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new TariffError(`Tarif ungültig: ${r.key}`)
    tariffs[r.key] = v
  }
  const missing = REQUIRED_TARIFF_KEYS.filter((k) => !(k in tariffs))
  if (missing.length > 0) throw new TariffError(`Tarife fehlen: ${missing.join(', ')}`)
  return tariffs
}
