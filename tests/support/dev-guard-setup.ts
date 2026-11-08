// Vitest-globalSetup des Projekts rls: bricht den ganzen Lauf ab, wenn die Ref nicht die Dev-Ref ist (A1-M3).
// Der Import führt die Prüfung von scripts/dev-guard.mjs aus (Exit 2 bei falscher Ref, setzt SUPABASE_PROJECT_ID).
import '../../scripts/dev-guard.mjs'
import { committedCoverFirm } from './partner.ts'

// Seit S9c verteilen `quote` und der Cron-Lauf `distribute-pending` jede Anfrage: ohne passende Firma würde sie sofort `unmatched`.
// Eine aktive Testfirma (Bezirke außer 17, 18, 21) hält committete Test-Anfragen offen; die Rückgabe räumt sie nach dem Lauf weg.
export default function setup(): () => void {
  return committedCoverFirm()
}
