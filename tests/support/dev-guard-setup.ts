// Vitest-globalSetup des Projekts rls: bricht den ganzen Lauf ab, wenn die Ref nicht die Dev-Ref ist (A1-M3).
// Der Import führt die Prüfung von scripts/dev-guard.mjs aus (Exit 2 bei falscher Ref, setzt SUPABASE_PROJECT_ID).
import '../../scripts/dev-guard.mjs'

export default function setup(): void {}
