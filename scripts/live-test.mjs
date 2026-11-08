// Live-Test gegen die deployten Functions `quote` und `route` (nur Dev-Projekt).
// Start: npx dotenv -e .env.local -- node scripts/live-test.mjs | tee tmp/proof/live-test.log
// Werte kommen nur aus der Umgebung und werden nie ausgegeben. Testnutzer und ihre Daten werden am Ende gelöscht.
import './dev-guard.mjs'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const service = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const quoteUrl = `${url}/functions/v1/quote`
const routeUrl = `${url}/functions/v1/route`
const ALLOWED = 'http://localhost:5173'
const EVIL = 'https://evil.example'

let failed = 0
const check = (ok, name, detail) => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
}

// Zähler (Nutzer 6/min, IP 10/min) sind Minutenfenster: Tests beginnen kurz nach Minutenanfang.
const nextMinute = async () => {
  const s = new Date().getSeconds()
  await new Promise((r) => setTimeout(r, ((s < 3 ? 3 - s : 63 - s) * 1000)))
}

const post = async (target, headers, body) => {
  const res = await fetch(target, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* keine JSON-Antwort */ }
  return { status: res.status, json, headers: res.headers }
}

const move = (over = {}) => ({
  service: 'move',
  clientRef: randomUUID(),
  inputs: { goods: 'normal', crew: 3, vehicles: 1, vehicleType: 'van', hours: 5, fromFloor: 0, toFloor: 0, fromLift: true, toLift: true, boxes: 20, parking: 1, packing: false, assembly: { kind: 'standard', lm: 3 } },
  from: { label: 'Stephansplatz 1, Wien', postcode: '1010', point: { lat: 48.208164, lon: 16.373477 } },
  to: { label: 'Hauptplatz, Graz', postcode: '8010', point: { lat: 47.0707, lon: 15.4395 } },
  returnTrip: false,
  preferredDate: new Date(Date.now() + 14 * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' }),
  ...over,
})

const users = []
async function newUser() {
  const email = `live-${Date.now().toString(36)}-${users.length}@movenow.test`
  const password = `${randomUUID()}Aa1!`
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  const app = createClient(url, pub, { auth: { persistSession: false } })
  const { error: se } = await app.auth.signInWithPassword({ email, password })
  if (se) throw se
  const jwt = (await app.auth.getSession()).data.session.access_token
  users.push(data.user.id)
  return { id: data.user.id, auth: { authorization: `Bearer ${jwt}` } }
}

const count = async (table, column, value) => {
  const { count: n, error } = await service.from(table).select('*', { count: 'exact', head: true }).eq(column, value)
  if (error) throw error
  return n
}

try {
  // 1. Rennen: 10 parallele Aufrufe mit gleicher clientRef gegen die deployte quote
  await nextMinute()
  const u = await newUser()
  const body = move()
  const results = await Promise.all(Array.from({ length: 10 }, () => post(quoteUrl, u.auth, body)))
  const statuses = results.map((r) => r.status).sort()
  const ids = new Set(results.filter((r) => r.status === 200).map((r) => r.json?.id))
  const rows = (await service.from('service_requests').select('id').eq('customer_id', u.id).eq('client_ref', body.clientRef)).data ?? []
  check(statuses.every((s) => s === 200 || s === 429) && statuses.includes(200), 'Rennen: Statuscodes', statuses.join(' '))
  check(rows.length === 1, 'Rennen: genau eine Anfrage in der Datenbank', rows.length)
  check(ids.size === 1 && ids.has(rows[0]?.id), 'Rennen: alle 200er liefern dieselbe id', ids.size)
  check((await count('commission_entries', 'request_id', rows[0]?.id)) === 0, 'Rennen: quote bucht nichts ins Journal', 'commission_entries')

  // 2. CORS an route: fremde Origin bekommt keinen Allow-Origin-Header
  const pre = async (origin) => {
    const res = await fetch(routeUrl, { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST' } })
    return `${res.status} ${res.headers.get('access-control-allow-origin')}`
  }
  check((await pre(ALLOWED)) === `204 ${ALLOWED}`, 'CORS route erlaubte Origin (Preflight)', await pre(ALLOWED))
  const evilPre = await pre(EVIL)
  check(evilPre.endsWith(' null'), 'CORS route fremde Origin (Preflight): kein Allow-Origin', evilPre)
  const evilPost = await post(routeUrl, { apikey: pub, origin: EVIL }, { mode: 'x' })
  check(evilPost.headers.get('access-control-allow-origin') === null, 'CORS route fremde Origin (POST): kein Allow-Origin', `${evilPost.status} ${evilPost.headers.get('access-control-allow-origin')}`)

  // 3. quote mit ungültiger Adresse: höchstens 6 Aufrufe je Minute und Nutzer
  await nextMinute()
  const v = await newUser()
  const bad = {
    'leere Bezeichnung': { from: { label: '', point: { lat: 48.2, lon: 16.37 } } },
    'Punkt außerhalb Europas': { from: { label: 'Irgendwo', point: { lat: 10, lon: 100 } } },
    'Koordinate als Text': { from: { label: 'Irgendwo', point: { lat: 'a', lon: 'b' } } },
    'ungültige PLZ': { from: { label: 'Irgendwo', postcode: '<script>', point: { lat: 48.2, lon: 16.37 } } },
  }
  for (const [name, over] of Object.entries(bad)) {
    const r = await post(quoteUrl, v.auth, move(over))
    check(r.status === 400, `quote ${name}: 400`, `${r.status} ${r.json?.error ?? ''}`)
  }
  const ocean = await post(quoteUrl, v.auth, move({ from: { label: 'Atlantik', point: { lat: 45, lon: -20 } } }))
  check(ocean.status !== 200 || ocean.json?.snapshot?.kind !== 'price', 'quote unerreichbarer Punkt: kein Preis', `${ocean.status} needsQuote=${ocean.json?.needsQuote} kind=${ocean.json?.snapshot?.kind}`)
  check((await count('service_requests', 'customer_id', v.id)) <= 1, 'quote ungültig: höchstens die Anfrage ohne Preis gespeichert', await count('service_requests', 'customer_id', v.id))

  // 4. R1: 12 gleiche Routenaufrufe (Wien-Wien) mit wechselndem x-forwarded-for, erwartet 429 ab dem 11.
  await nextMinute()
  const codes = []
  for (let i = 1; i <= 12; i++) {
    const r = await post(routeUrl, { apikey: pub, 'x-forwarded-for': `10.0.${i}.${i}` }, { mode: 'route', from: { lat: 48.208164, lon: 16.373477 }, to: { lat: 48.1854, lon: 16.3126 }, returnTrip: true })
    codes.push(r.status)
  }
  check(codes.slice(0, 10).every((c) => c === 200) && codes.slice(10).every((c) => c === 429), 'R1: 10 × 200, dann 429 (wechselnder Header umgeht das Limit nicht)', codes.join(' '))
} finally {
  const left = []
  for (const id of users) {
    await service.auth.admin.deleteUser(id)
    left.push(await count('service_requests', 'customer_id', id))
  }
  check(left.every((n) => n === 0), 'Aufräumen: Testnutzer und Anfragen gelöscht', `${users.length} Nutzer, Reste ${left.join(',')}`)
}
console.log(failed ? `${failed} Prüfung(en) rot` : 'alle Prüfungen bestanden')
process.exit(failed ? 1 : 0)
