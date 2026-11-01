// Harte Abbruchprüfung für Skripte, die Sperren lockern oder Daten löschen: nur das MoveNow-Dev-Projekt.
// Importieren als erste Zeile (import './dev-guard.mjs'). Prüft vor jeder DB-Aktion die Ref aus der Umgebung
// (SUPABASE_PROJECT_REF), aus der URL (NEXT_PUBLIC_SUPABASE_URL) und aus dem verlinkten Projekt (supabase/.temp/project-ref).
import { existsSync, readFileSync } from 'node:fs'

const DEV_REF = 'vcpbbzdyltvffvzjrzdi'
const refs = {
  SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF ?? '',
  NEXT_PUBLIC_SUPABASE_URL: /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')?.[1] ?? '',
  'supabase/.temp/project-ref': existsSync('supabase/.temp/project-ref') ? readFileSync('supabase/.temp/project-ref', 'utf8').trim() : '',
}
const wrong = Object.entries(refs).filter(([, ref]) => ref !== DEV_REF)
if (wrong.length > 0) {
  console.error(`ABBRUCH: Dieses Skript läuft nur gegen das Dev-Projekt. Abweichend: ${wrong.map(([k]) => k).join(', ')}. Keine DB-Aktion.`)
  process.exit(2)
}
