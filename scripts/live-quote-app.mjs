// Live-Test der Anfrage-Wege der App gegen das Dev-Projekt (S8b-2): je Flow eine Anfrage über `quote`, Idempotenz,
// Miete mit ISO-Zeit muss 400 ergeben, Antworten ohne Gebührenfelder, geänderte Eingabe = zweite Anfrage mit den neuen Werten,
// Vorschau (Preismodul mit denselben Eingaben, Tarifen und derselben Strecke wie die App) = Serverpreis auf den Cent, Aufräumen des Testnutzers.
// Start: npx dotenv -e .env.local -- node scripts/live-quote-app.mjs | tee tmp/proof/s8b2-live.log
// Ausgabe maskiert (nur Status, Längen, Codes). Rohantworten (ohne E-Mail) in tmp/proof/s8b2-live-raw.json.
// `quote` erlaubt 6 Aufrufe je Nutzer und Minute: zwei Phasen mit Pause, höchstens 5 Aufrufe je Phase.
import './dev-guard.mjs'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import { computeAssembly, computeClearance, computeRental, computeTransport, parseAssembly, parseClearanceInput, parseRentalInput, parseTransportInput } from '../supabase/functions/_shared/pricing/index.ts'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const service = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const app = createClient(url, pub, { auth: { persistSession: false } })

let failed = 0
const check = (ok, name, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`)
}
const raw = []
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const email = `live-quote-${Date.now().toString(36)}@movenow.test`
let userId = null
const requestIds = []
const bookingIds = []

/** Wiener Datum plus n Tage als YYYY-MM-DD. */
const viennaDay = (plus) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Vienna' }).format(new Date(Date.now() + plus * 86_400_000))

/** Ein Aufruf wie die App: Token der Sitzung, Body mit clientRef. Liefert Status und JSON (bei 4xx/5xx aus dem Fehlerkontext). */
async function call(body) {
  const { data, error } = await app.functions.invoke('quote', { body })
  if (!error) return { status: 200, json: data }
  const response = error.context
  const json = response?.json ? await response.json().catch(() => null) : null
  return { status: response?.status ?? 0, json }
}

/** Alle Schlüssel einer Antwort, rekursiv. */
const keysOf = (v) => (Array.isArray(v) ? v.flatMap(keysOf) : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => [k, ...keysOf(x)]) : [])
// `bookingFeeCents` ist die Buchungsgebühr des Vermieters, eine Preiszeile der Miete (kein Plattformanteil).
const feeKeys = (json) => keysOf(json).filter((k) => k !== 'bookingFeeCents' && /fee|payout|platform|vat|share|anteil/i.test(k))

const record = (name, r) => {
  raw.push({ name, status: r.status, json: r.json })
  return r
}

/** Tarife wie `loadPrices` + `toTariffs` der App: aktuelle Version, ohne Quellenverweise (Einheit ref). */
async function loadTariffs() {
  const current = await app.from('current_price_version').select('version').single()
  const rows = await app.from('price_config').select('key, value, unit').eq('version', current.data.version)
  if (current.error || rows.error) throw new Error('Tarife nicht lesbar')
  return Object.fromEntries(rows.data.filter((r) => r.unit !== 'ref').map((r) => [r.key, Number(r.value)]))
}

/** Streckenaufruf wie `route()` der App. */
async function appRoute(from, to, returnTrip) {
  const { data, error } = await app.functions.invoke('route', { body: { mode: 'route', from, to, returnTrip } })
  if (error) throw new Error('route fehlgeschlagen')
  return data
}

/** Vorschau = Server: gleiche Beträge (Gesamt, Spanne, Zeilen), sonst FAIL mit beiden Werten. */
const samePrice = (name, preview, snapshot) => {
  const same =
    preview.kind === 'price' &&
    snapshot?.kind === 'price' &&
    preview.totalCents === snapshot.totalCents &&
    preview.lowCents === snapshot.lowCents &&
    preview.highCents === snapshot.highCents &&
    JSON.stringify(preview.lines.map((l) => [l.key, l.cents])) === JSON.stringify(snapshot.lines.map((l) => [l.key, l.cents]))
  check(same, `Vorschau = Server (${name})`, `Vorschau ${preview.totalCents ?? '-'} ct, Server ${snapshot?.totalCents ?? '-'} ct`)
}

const transportInputs = (service) => ({ service, goods: 'normal', crew: 2, vehicles: 1, vehicleType: 'van', hours: service === 'move' ? 3 : 2, fromFloor: 0, toFloor: 0, fromLift: false, toLift: false, boxes: 0, parking: 0, packing: false, assembly: null })

try {
  const created = await service.auth.admin.createUser({ email, email_confirm: true })
  if (created.error) throw new Error(`createUser: status ${created.error.status ?? '-'}`)
  userId = created.data.user.id
  const link = await service.auth.admin.generateLink({ type: 'magiclink', email })
  if (link.error) throw new Error('generateLink fehlgeschlagen')
  const signed = await app.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' })
  if (signed.error || signed.data.user?.id !== userId) throw new Error('Anmeldung fehlgeschlagen')
  console.log(`Testnutzer angelegt und angemeldet (${email.replace(/^[^@]+/, '…')})`)

  const date = viennaDay(10)
  const place = { label: 'Teststraße 1, 1010 Wien' }
  const ref = () => crypto.randomUUID()

  // Phase 1: ein Aufruf je Flow (4) plus Wiederholung mit derselben clientRef (5)
  const assemblyRef = ref()
  const assembly = record('montage', await call({ service: 'assembly', inputs: { kind: 'standard', lm: 2 }, from: place, preferredDate: date, timeWindow: 'flexible', clientRef: assemblyRef }))
  check(assembly.status === 200 && assembly.json?.snapshot?.kind === 'price' && assembly.json?.status === 'requested', 'Montage: Anfrage mit Preis aus quote', `Status ${assembly.status}`)
  if (assembly.json?.id) requestIds.push(assembly.json.id)

  const again = record('montage-wiederholung', await call({ service: 'assembly', inputs: { kind: 'standard', lm: 2 }, from: place, preferredDate: date, timeWindow: 'flexible', clientRef: assemblyRef }))
  check(again.status === 200 && again.json?.id === assembly.json?.id, 'Gleiche clientRef: dieselbe Anfrage, keine zweite')

  const clearance = record(
    'entruempelung',
    await call({ service: 'clearance', inputs: { object: 'flat', area: 60, fill: 'normal', lift: false, floor: 3, special: false, assembly: null }, from: place, description: 'Wohnung, 3. Stock', preferredDate: date, timeWindow: 'morning', clientRef: ref() }),
  )
  const c = clearance.json?.snapshot
  check(clearance.status === 200 && c?.kind === 'price' && c.lowCents <= c.totalCents && c.totalCents <= c.highCents && c.lowCents < c.highCents, 'Entrümpelung: Preis mit Spanne', `Status ${clearance.status}`)
  if (clearance.json?.id) requestIds.push(clearance.json.id)

  const move = record(
    'umzug',
    await call({
      service: 'move',
      inputs: transportInputs('move'),
      from: { label: 'Neubaugasse 12, 1070 Wien', point: { lat: 48.2, lon: 16.352 } },
      to: { label: 'Praterstraße 30, 1020 Wien', point: { lat: 48.217, lon: 16.396 } },
      returnTrip: true,
      volume: 12,
      preferredDate: date,
      clientRef: ref(),
    }),
  )
  check(move.status === 200 && (move.json?.snapshot?.kind === 'price' || move.json?.needsQuote === true), 'Umzug mit Route: Preis oder Angebot (Routendienst)', `Status ${move.status}, ${move.json?.snapshot?.kind ?? '-'}`)
  if (move.json?.id) requestIds.push(move.json.id)

  const transport = record('transport', await call({ service: 'transport', inputs: transportInputs('transport'), from: place, to: { label: 'Zielgasse 2, 1020 Wien' }, volume: 8, preferredDate: date, clientRef: ref() }))
  check(transport.status === 200 && transport.json?.needsQuote === true && transport.json?.snapshot?.kind === 'offer', 'Transport ohne bestätigte Koordinaten: Angebot, kein Preis', `Status ${transport.status}`)
  if (transport.json?.id) requestIds.push(transport.json.id)

  for (const r of raw) check(feeKeys(r.json).length === 0, `Antwort ${r.name}: keine Gebührenfelder`)

  // Vorschau gleich Server: dieselben Eingaben, dieselben Tarife, dieselbe Strecke
  const tariffs = await loadTariffs()
  samePrice('Montage', computeAssembly(tariffs, parseAssembly({ kind: 'standard', lm: 2 })), assembly.json?.snapshot)
  samePrice('Entrümpelung', computeClearance(tariffs, parseClearanceInput({ object: 'flat', area: 60, fill: 'normal', lift: false, floor: 3, special: false, assembly: null })), clearance.json?.snapshot)
  const facts = await appRoute({ lat: 48.2, lon: 16.352 }, { lat: 48.217, lon: 16.396 }, true)
  samePrice('Umzug', computeTransport(tariffs, parseTransportInput(transportInputs('move')), { region: facts.region, outsideKm: facts.outsideKm, driveHours: facts.driveHours }), move.json?.snapshot)

  console.log('Pause 62 s (Limit 6 Aufrufe je Minute)')
  await sleep(62_000)

  // Phase 2: Miete
  const offer = await app.from('rental_offers').select('id').limit(1)
  const offerId = offer.data?.[0]?.id
  check(Boolean(offerId), 'Freigegebenes Mietangebot vorhanden (nur Lesen)')
  const wall = (day, time) => `${viennaDay(day)}T${time}`
  const rental = (pickupAt, returnAt) => ({ service: 'rental', offerId, inputs: { pickupAt, returnAt, km: 100, cover: false, driver: false, oneWay: false }, clientRef: ref() })

  const ok = record('miete', await call(rental(wall(20, '09:00'), wall(21, '09:00'))))
  check(ok.status === 200 && ok.json?.snapshot?.kind === 'price', 'Miete mit Wiener Ortszeit: Preis aus quote', `Status ${ok.status}`)
  if (ok.json?.id) bookingIds.push(ok.json.id)
  check(feeKeys(ok.json).length === 0, 'Antwort Miete: keine Gebührenfelder')

  const offerRow = await app.from('rental_offers').select('*').eq('id', offerId).single()
  const o = offerRow.data
  const rentalOffer = { dailyCents: o.daily_cents, kmPerDay: o.km_per_day, extraKmCents: o.extra_km_cents, coverDailyCents: o.cover_daily_cents, driverDailyCents: o.driver_daily_cents, bookingFeeCents: o.booking_fee_cents, oneWayCents: o.one_way_cents, depositCents: o.deposit_cents }
  samePrice('Miete', computeRental(rentalOffer, parseRentalInput({ pickupAt: wall(20, '09:00'), returnAt: wall(21, '09:00'), km: 100, cover: false, driver: false, oneWay: false })), ok.json?.snapshot)

  // Eingabe ändern und erneut senden (die App vergibt dann eine neue clientRef): zweite Anfrage mit den neuen Werten
  const changed = record('montage-geaendert', await call({ service: 'assembly', inputs: { kind: 'standard', lm: 2 }, from: place, preferredDate: date, timeWindow: 'morning', clientRef: ref() }))
  check(changed.status === 200 && changed.json?.id && changed.json.id !== assembly.json?.id, 'Geänderte Eingabe mit neuer clientRef: zweite, andere Anfrage', `Status ${changed.status}`)
  if (changed.json?.id) requestIds.push(changed.json.id)
  const pair = await service.from('service_requests').select('id, time_window').in('id', [assembly.json?.id, changed.json?.id].filter(Boolean))
  const windowOf = (id) => pair.data?.find((r) => r.id === id)?.time_window
  check(pair.data?.length === 2 && windowOf(assembly.json?.id) === 'flexible' && windowOf(changed.json?.id) === 'morning', 'Datenbank: erste Anfrage unverändert (flexible), zweite mit den neuen Werten (morning)')

  for (const [name, pickupAt, returnAt] of [
    ['mit Z', `${viennaDay(20)}T08:00:00Z`, `${viennaDay(21)}T08:00:00Z`],
    ['mit +01:00', `${viennaDay(20)}T09:00:00+01:00`, `${viennaDay(21)}T09:00:00+01:00`],
    ['in der Zeitumstellungslücke', '2027-03-28T02:30', '2027-03-29T02:30'],
  ]) {
    const r = record(`miete-${name}`, await call(rental(pickupAt, returnAt)))
    check(r.status === 400 && r.json?.error === 'invalid_input' && /^(pickupAt|returnAt):/.test(r.json?.message ?? ''), `Miete ${name}: 400 invalid_input mit Feldpräfix`, `Status ${r.status}`)
  }

  // Eigene Zeilen lesbar, Gebührentabelle nicht
  const own = await app.from('service_requests').select('id, service, status').eq('customer_id', userId)
  check(!own.error && own.data.length === requestIds.length, 'Kunde liest seine Anfragen über RLS', `${own.data?.length ?? 0} von ${requestIds.length}`)
  const fees = await app.from('commission_entries').select('id')
  check(Boolean(fees.error) || fees.data.length === 0, 'Kunde liest kein Journal')
  const settings = await app.from('platform_settings').select('key')
  check(Boolean(settings.error) || settings.data.length === 0, 'Kunde liest keine platform_settings')
  const serverFees = await service.from('commission_entries').select('id').in('request_id', requestIds)
  check(!serverFees.error && serverFees.data.length === 0, 'quote bucht nichts ins Journal', `${serverFees.data?.length ?? 0} Zeilen`)
} catch (e) {
  failed++
  console.log(`FAIL Abbruch: ${e instanceof Error ? e.message : 'unbekannt'}`)
} finally {
  fs.mkdirSync('tmp/proof', { recursive: true })
  fs.writeFileSync('tmp/proof/s8b2-live-raw.json', JSON.stringify(raw, null, 2))
  if (userId) {
    const del = await service.auth.admin.deleteUser(userId)
    check(!del.error, 'Testnutzer gelöscht', del.error ? `status ${del.error.status ?? '-'}` : '')
    const gone = await service.auth.admin.getUserById(userId)
    check(!gone.data?.user, 'Testnutzer nicht mehr vorhanden')
    const requests = await service.from('service_requests').select('id').eq('customer_id', userId)
    const bookings = await service.from('rental_bookings').select('id').eq('customer_id', userId)
    const entries = requestIds.length ? await service.from('commission_entries').select('id').in('request_id', requestIds) : { data: [] }
    check(requests.data?.length === 0 && bookings.data?.length === 0 && entries.data?.length === 0, 'Keine Anfragen, Mietanfragen oder Journalzeilen übrig')
  }
}
console.log(failed === 0 ? 'ALLE BESTANDEN' : `${failed} FEHLGESCHLAGEN`)
process.exit(failed === 0 ? 0 : 1)
