// Live-Test der Anmeldung gegen das Dev-Projekt: Code-Weg und Link-Weg (token_hash) gegen die echte Auth-API.
// Start: npx dotenv -e .env.local -- node scripts/live-auth.mjs | tee tmp/proof/live-auth.log
// Kein Mailversand: Code und Hash kommen über auth.admin.generateLink. Ausgabe nur Ergebnisse, Längen und Fehlercodes, nie Werte.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const service = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const app = () => createClient(url, pub, { auth: { persistSession: false } })

let failed = 0
const check = (ok, name, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`)
}
const errInfo = (error) => (error ? `status ${error.status ?? '-'}, code ${error.code ?? '-'}` : 'kein Fehler')

const email = `live-auth-${Date.now().toString(36)}@movenow.test`
let userId = null

const link = async () => {
  const { data, error } = await service.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw new Error(`generateLink: ${errInfo(error)}`)
  return { code: data.properties.email_otp, hash: data.properties.hashed_token }
}

try {
  const created = await service.auth.admin.createUser({ email, email_confirm: true })
  if (created.error) throw new Error(`createUser: ${errInfo(created.error)}`)
  userId = created.data.user.id
  console.log(`Testnutzer angelegt (${email.replace(/^[^@]+/, '…')})`)

  // Code-Weg: so meldet die App mit dem Code aus der Mail an
  const c = await link()
  check(/^\d{6,10}$/.test(c.code), 'Code hat 6 bis 10 Ziffern', `Länge ${c.code.length}`)
  const viaCode = await app().auth.verifyOtp({ email, token: c.code, type: 'email' })
  check(!viaCode.error && viaCode.data.session?.user.email === email, 'Code-Weg: Sitzung für den Testnutzer', errInfo(viaCode.error))
  check(viaCode.data.session?.user.id === userId, 'Code-Weg: dieselbe Nutzer-ID')

  // Wiederverwendung: derselbe Code zum zweiten Mal
  const again = await app().auth.verifyOtp({ email, token: c.code, type: 'email' })
  check(Boolean(again.error), 'Benutzter Code wird abgelehnt', errInfo(again.error))

  // Link-Weg: token_hash wie im Link der Mail
  const l = await link()
  const client = app()
  const viaLink = await client.auth.verifyOtp({ token_hash: l.hash, type: 'email' })
  check(!viaLink.error && viaLink.data.session?.user.email === email, 'Link-Weg: Sitzung für den Testnutzer', errInfo(viaLink.error))
  const out = await client.auth.signOut()
  check(!out.error, 'Abmelden', errInfo(out.error))
  const reuse = await app().auth.verifyOtp({ token_hash: l.hash, type: 'email' })
  check(Boolean(reuse.error), 'Benutzter Link-Hash wird abgelehnt', errInfo(reuse.error))

  // Falscher Code: Fehlercode für das Mapping der App
  await link()
  const wrong = await app().auth.verifyOtp({ email, token: '0'.repeat(c.code.length), type: 'email' })
  check(Boolean(wrong.error), 'Falscher Code wird abgelehnt', errInfo(wrong.error))
} catch (e) {
  failed++
  console.log(`FAIL Abbruch: ${e instanceof Error ? e.message : 'unbekannt'}`)
} finally {
  if (userId) {
    const del = await service.auth.admin.deleteUser(userId)
    check(!del.error, 'Testnutzer gelöscht', errInfo(del.error))
    const left = await service.auth.admin.getUserById(userId)
    check(!left.data?.user, 'Testnutzer nicht mehr vorhanden')
  }
}
console.log(failed === 0 ? 'ALLE BESTANDEN' : `${failed} FEHLGESCHLAGEN`)
process.exit(failed === 0 ? 0 : 1)
