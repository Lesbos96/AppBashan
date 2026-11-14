// Geltende Gebühr für Tests (s9p-1): Staffel (Stufen), USt.-Satz und die beiden Versionen, wie sie `private.current_fee()` liefert.
// Nur als Datenbank-Eigentümer lesbar; Kunden und Tests über die API sehen sie nie.
import type { FeeTier } from '@pricing'
import { ownerSql } from './owner.ts'

export type CurrentFee = { tiers: FeeTier[]; vr: number; fsv: number; vrv: number }

export function currentFee(): CurrentFee {
  const r = ownerSql('select fee_tiers::text as tiers, fee_vat_rate::float8 as vr, fee_schedule_version as fsv, fee_vat_rate_version as vrv from private.current_fee()')[0] as {
    tiers: string
    vr: number
    fsv: number
    vrv: number
  }
  return { tiers: JSON.parse(r.tiers) as FeeTier[], vr: r.vr, fsv: r.fsv, vrv: r.vrv }
}
