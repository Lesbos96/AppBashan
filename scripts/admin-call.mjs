// Ruft eine Admin-Funktion auf (Phase 1 ohne Oberfläche, Konzept 3 und 4.5): die Edge Functions admin-correct, admin-contact, admin-photo und
// die Liste `reported_jobs` (gemeldete Aufträge). Das JWT eines admin-Kontos mit aal2 steht in der Umgebungsvariable ADMIN_JWT
// (nie als Argument, nie in einer Datei im Repo; nach dem Aufruf die Variable löschen).
// PowerShell: $env:ADMIN_JWT = '<jwt>'; npm run admin:call -- admin-correct '{"requestId":"…","action":"complete","reason":"Begründung, mindestens 10 Zeichen"}'
//             npm run admin:call -- reported_jobs '{}'      ; Remove-Item Env:ADMIN_JWT
// admin-correct mit Gebühr: erst "charge":true,"preview":true (zeigt feeBaseCents), dann "charge":true,"shownFeeCents":<gezeigter Betrag>.
const [fn, json] = process.argv.slice(2)
const jwt = process.env.ADMIN_JWT
const base = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const rpc = fn === 'reported_jobs'
if ((!rpc && !/^admin-[a-z]+$/.test(fn ?? '')) || !json || !jwt || !base || !key) {
  console.error("Aufruf (ADMIN_JWT in der Umgebung, PowerShell: $env:ADMIN_JWT = '<jwt>'): npm run admin:call -- <admin-correct|admin-contact|admin-photo|reported_jobs> '<json>'")
  process.exit(2)
}
const res = await fetch(`${base}/${rpc ? 'rest/v1/rpc' : 'functions/v1'}/${fn}`, {
  method: 'POST',
  headers: { authorization: `Bearer ${jwt}`, apikey: key, 'content-type': 'application/json' },
  body: json,
})
console.log(res.status, await res.text())
process.exit(res.ok ? 0 : 1)
