// Golden-Fixtures für das Preismodul: lädt den Prototyp, ruft globalThis.MoveNowDemo.* mit festen Eingaben auf
// und schreibt Eingabe + Ergebnis nach tests/unit/fixtures/prototype-golden.json.
// Aufruf: npm run fixtures:pricing (nur nötig, wenn Fälle geändert werden; die JSON-Datei ist eingecheckt).
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

const proto = fileURLToPath(new URL('../docs/reference/MoveNow_Prototyp.html', import.meta.url))
const out = fileURLToPath(new URL('../tests/unit/fixtures/prototype-golden.json', import.meta.url))

const T = { service: 'transport' }
const M = { service: 'move' }
const cases = []
const add = (name, patch) => cases.push({ name, patch })

// Transport / Umzug: Team, Fahrzeuge, Mindestdauer
for (const crew of [1, 2, 3, 4, 5, 6, 7, 8]) add(`transport ${crew} Pers 1 Fzg 4 h`, { ...T, crew, vehicles: 1, hours: 4 })
for (const [crew, vehicles] of [[2, 2], [3, 3], [2, 3], [4, 2]]) add(`transport ${crew} Pers ${vehicles} Fzg 3.5 h`, { ...T, crew, vehicles, hours: 3.5 })
add('transport unter Mindestdauer (1 h)', { ...T, hours: 1 })
add('transport 0.5 h = Mindestdauer', { ...T, hours: 0.5 })
add('umzug unter Mindestdauer (2 h)', { ...M, hours: 2 })
add('umzug 7.5 h 3 Pers', { ...M, crew: 3, hours: 7.5 })
add('umzug README: 3 Pers 1 Fzg 5 h Wien Montage 3 lfm 20 Kartons 1 Halteverbot', { ...M, crew: 3, vehicles: 1, hours: 5, mount: true, kind: 'standard', lm: 3, boxes: 20, parking: 1 })
add('umzug Montage unter Mindest-lfm', { ...M, hours: 4, mount: true, lm: 1 })
add('umzug Küche', { ...M, hours: 6, crew: 3, mount: true, kind: 'kitchen', lm: 3.2, upper: 2.4, tall: 0.6 })
add('umzug 2 Halteverbote 200 Kartons', { ...M, hours: 8, crew: 4, boxes: 200, parking: 2 })
// Außerhalb Wiens, mehrere Fahrzeuge
add('transport Österreich 120 km 1,5 h Fahrt', { ...T, moveRegion: 'austria', outsideKm: 120, driveHours: 1.5, hours: 3 })
add('transport Österreich 2 Fzg 3 Pers', { ...M, moveRegion: 'austria', outsideKm: 210.4, driveHours: 2.7, hours: 5, crew: 3, vehicles: 2 })
add('transport Österreich 1 Pers', { ...T, moveRegion: 'austria', outsideKm: 33.3, driveHours: 0.6, hours: 2, crew: 1 })
// Angebotspflicht
add('transport international', { ...T, moveRegion: 'international' })
add('transport Klavier', { ...T, goods: 'piano', fromFloor: 3, fromLift: false })
add('transport Flügel', { ...T, goods: 'grand' })
add('transport Tresor', { ...T, goods: 'safe' })
add('transport Groß-LKW', { ...T, vehicleType: 'large' })
add('transport Einpackservice', { ...T, packing: true })
add('transport mehr Fzg als Pers', { ...T, crew: 1, vehicles: 2 })
add('transport mehrere Gründe', { ...M, goods: 'piano', packing: true, vehicleType: 'large', crew: 1, vehicles: 3 })
add('transport ohne Route', { ...T, route: null })

// Entrümpelung
for (const fill of ['light', 'normal', 'full']) add(`clear Wohnung 60 m² ${fill}`, { service: 'clear', object: 'flat', area: 60, fill, lift: true, floor: 0 })
add('clear README: 60 m² normal 3. Stock ohne Lift', { service: 'clear', object: 'flat', area: 60, fill: 'normal', lift: false, floor: 3 })
add('clear Mindestpreis (10 m² wenig)', { service: 'clear', object: 'cellar', area: 10, fill: 'light', lift: true, floor: 0 })
add('clear EG ohne Lift (kein Zuschlag)', { service: 'clear', object: 'house', area: 120, fill: 'full', lift: false, floor: 1 })
add('clear 5. Stock ohne Lift mit Montage', { service: 'clear', object: 'attic', area: 45, fill: 'normal', lift: false, floor: 5, mount: true, kind: 'standard', lm: 4 })
add('clear mit Küchendemontage', { service: 'clear', object: 'flat', area: 80, fill: 'full', lift: true, floor: 2, mount: true, kind: 'kitchen', lm: 2.8, upper: 1.8, tall: 0.6 })
add('clear Gewerbe (Besichtigung)', { service: 'clear', object: 'office', area: 200, fill: 'normal', lift: true, floor: 0 })
add('clear stark belastet (Besichtigung)', { service: 'clear', object: 'heavy', area: 30, fill: 'full', lift: true, floor: 0 })
add('clear Sonderfall (Besichtigung)', { service: 'clear', object: 'flat', area: 50, fill: 'normal', lift: true, floor: 0, special: true })

// Montage
add('montage Standard 1 lfm (Mindest 2)', { service: 'assembly', kind: 'standard', lm: 1 })
add('montage Standard 5,5 lfm', { service: 'assembly', kind: 'standard', lm: 5.5 })
add('montage README Küche 3,2 / 2,4 / 0,6', { service: 'assembly', kind: 'kitchen', lm: 3.2, upper: 2.4, tall: 0.6 })
add('montage Küche nur Unterschränke', { service: 'assembly', kind: 'kitchen', lm: 4, upper: 0, tall: 0 })
add('montage Küche 0 lfm', { service: 'assembly', kind: 'kitchen', lm: 0, upper: 0, tall: 0 })

// Miete (Hinweis: Daten ohne Sommerzeit-Umstellung, 2026-03-29 und 2026-10-25 liegen nicht dazwischen)
for (const van of ['small', 'medium', 'large']) add(`miete ${van} 1 Tag 50 km`, { service: 'rent', van, days: 1, km: 50 })
add('miete README: Cargo Van 2 Tage 350 km Schutzpaket', { service: 'rent', van: 'medium', days: 2, km: 350, cover: 1 })
add('miete Mehr-km', { service: 'rent', van: 'small', days: 3, km: 600 })
add('miete Fahrer + Schutz', { service: 'rent', van: 'large', days: 4, km: 700, cover: 1, driver: true })
add('miete Einweg + Bereitstellung', { service: 'rent', van: 'medium', days: 1, km: 100, returnStation: 'other' })
add('miete angebrochener Tag 25 h', { service: 'rent', van: 'small', days: 1, km: 100, date: '2026-06-10', pickTime: '09:00', returnDate: '2026-06-11', returnTime: '10:00' })
add('miete exakt 24 h', { service: 'rent', van: 'small', days: 1, km: 100, date: '2026-06-10', pickTime: '09:00', returnDate: '2026-06-11', returnTime: '09:00' })
add('miete Rückgabe vor Abholung (min. 1 Tag)', { service: 'rent', van: 'medium', days: 1, km: 100, date: '2026-06-10', pickTime: '09:00', returnDate: '2026-06-10', returnTime: '08:00' })
add('miete 0 km', { service: 'rent', van: 'large', days: 2, km: 0 })
add('miete 7 Tage mit allem', { service: 'rent', van: 'medium', days: 7, km: 1500, cover: 1, driver: true, returnStation: 'other' })

const browser = await chromium.launch()
const page = await (await browser.newContext({ timezoneId: 'Europe/Vienna' })).newPage()
await page.goto(pathToFileURL(proto).href)
await page.waitForFunction(() => globalThis.MoveNowDemo)

const results = await page.evaluate((cs) => {
  const D = globalThis.MoveNowDemo
  const base = D.snapshot()
  return cs.map(({ name, patch }) => {
    const state = { ...base, ...patch }
    // Route gilt als berechnet, außer der Fall setzt sie ausdrücklich auf null.
    if (!('route' in patch)) state.route = { key: D.routeKey(state), totalKm: 0, seconds: 0 }
    const r = { name, state: { ...state, route: state.route ? {} : null }, expected: {} }
    const service = state.service
    if (service === 'rent') r.expected = { ...D.rentCalc(state) }
    else if (service === 'clear' && ['office', 'heavy'].includes(state.object) || service === 'clear' && state.special) r.expected = { needsVisit: true }
    else {
      r.expected = { ...D.calc(state) }
      if (service === 'transport' || service === 'move') r.expected.needsQuote = D.transportNeedsQuote(state)
      if (service === 'clear') r.expected.volume = Math.round(state.area * { light: 0.12, normal: 0.25, full: 0.45 }[state.fill] * 10) / 10
    }
    return r
  })
}, cases)
await browser.close()

if (results.length < 40) throw new Error(`nur ${results.length} Fälle`)
mkdirSync(fileURLToPath(new URL('../tests/unit/fixtures/', import.meta.url)), { recursive: true })
writeFileSync(out, JSON.stringify(results, null, 1) + '\n')
console.log(`${results.length} Fälle → ${out}`)
