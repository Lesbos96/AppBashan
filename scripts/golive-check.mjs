// Nur lesende Prüfung öffentlich sichtbarer Dinge eines Supabase-Projekts vor dem Livegang. Ändert nichts, schreibt nichts, liest keine .env-Dateien.
// GOLIVE_URL              https://<ref>.supabase.co (Pflicht)
// GOLIVE_ORIGIN           echte App-Origin, z. B. https://app.example.at (Pflicht)
// GOLIVE_PUBLISHABLE_KEY  Publishable Key, ist öffentlich (optional; schaltet die REST-Prüfungen frei)
// Aufruf: GOLIVE_URL=... GOLIVE_ORIGIN=... node scripts/golive-check.mjs   (Exit 1 bei jedem FAIL)
import { readFileSync } from 'node:fs'

const base = process.env.GOLIVE_URL?.replace(/\/+$/, '')
const appOrigin = process.env.GOLIVE_ORIGIN
const key = process.env.GOLIVE_PUBLISHABLE_KEY
if (!base?.startsWith('https://') || !appOrigin?.startsWith('https://')) {
  console.error('GOLIVE_URL und GOLIVE_ORIGIN müssen gesetzt sein und mit https:// beginnen.')
  process.exit(2)
}

const foreign = 'https://fremd.example'
let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`)
}
// Partnerbedingungen: Solange die App den Entwurfs-Platzhalter trägt, darf die Partner-Registrierung nicht live gehen (GOLIVE 30)
const terms = /TERMS_VERSION = '([^']+)'/.exec(readFileSync(new URL('../src/lib/partner.ts', import.meta.url), 'utf8'))?.[1]
check('Partnerbedingungen: App trägt keine Entwurfsversion', !!terms && !/entwurf/i.test(terms), terms ?? 'TERMS_VERSION nicht gefunden')
const call = (path, { method = 'GET', headers = {}, body } = {}) =>
  fetch(`${base}${path}`, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body && JSON.stringify(body) })
const acao = (res) => res.headers.get('access-control-allow-origin')

for (const fn of ['route', 'quote']) {
  const path = `/functions/v1/${fn}`
  const preflight = (origin) => call(path, { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST' } })

  const own = await preflight(appOrigin)
  check(`${fn}: Preflight echte Origin erlaubt`, own.status === 204 && acao(own) === appOrigin, `${own.status} ${acao(own)}`)
  const app = await preflight('capacitor://localhost')
  check(`${fn}: Preflight capacitor://localhost erlaubt`, app.status === 204 && acao(app) === 'capacitor://localhost', `${app.status} ${acao(app)}`)
  for (const origin of [foreign, 'http://localhost:5173', 'http://localhost:4173']) {
    const res = await preflight(origin)
    check(`${fn}: Preflight ${origin} ohne Allow-Origin`, acao(res) === null, `${res.status} ${acao(res)}`)
  }
  const post = await call(path, { method: 'POST', headers: { origin: foreign, apikey: 'falsch', authorization: 'Bearer falsch.falsch.falsch' }, body: {} })
  check(`${fn}: POST fremde Origin und falsche Zugangsdaten`, post.status === 401 && acao(post) === null, `${post.status} ${acao(post)}`)
}

const noJwt = await call('/functions/v1/quote', { method: 'POST', headers: { origin: appOrigin }, body: {} })
check('quote: 401 ohne JWT', noJwt.status === 401, String(noJwt.status))
const junk = await call('/functions/v1/quote', { method: 'POST', headers: { origin: appOrigin, authorization: 'Bearer müll' }, body: {} })
check('quote: 401 mit Müll-Token', junk.status === 401, String(junk.status))
const noKey = await call('/functions/v1/route', { method: 'POST', headers: { origin: appOrigin }, body: {} })
check('route: 401 ohne apikey', noKey.status === 401, String(noKey.status))

if (key) {
  const anon = { apikey: key }
  const rows = async (table, query = '') => {
    const res = await call(`/rest/v1/${table}?select=*${query}`, { headers: anon })
    return { status: res.status, data: res.ok ? await res.json() : null }
  }
  const tariffs = await rows('price_config', '&limit=1')
  check('price_config öffentlich lesbar', tariffs.status === 200 && tariffs.data.length === 1, String(tariffs.status))
  const leak = await rows('price_config', '&key=ilike.*fee*')
  check('price_config enthält keinen Gebührenschlüssel', leak.status === 200 && leak.data.length === 0, `${leak.data?.length ?? leak.status}`)
  for (const table of ['platform_settings', 'commission_entries','service_requests', 'price_revisions', 'request_contacts', 'status_events', 'rental_bookings', 'profiles', 'geocode_cache', 'geo_districts']) {
    const res = await rows(table, '&limit=1')
    check(`${table}: anonym keine Zeilen`, (res.status === 200 && res.data.length === 0) || res.status === 401 || res.status === 403, `${res.status} ${res.data?.length ?? ''}`)
  }
  const demo = await rows('rental_offers', '&is_demo=eq.true&limit=1')
  check('rental_offers: keine Demo-Angebote', demo.status === 200 && demo.data.length === 0, `${demo.status} ${demo.data?.length ?? ''}`)
} else {
  console.log('SKIP REST- und Auth-Prüfungen (GOLIVE_PUBLISHABLE_KEY nicht gesetzt)')
}

console.log(failed ? `${failed} Prüfung(en) fehlgeschlagen` : 'bestanden')
process.exit(failed ? 1 : 0)
