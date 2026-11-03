/* global document, createImageBitmap -- laufen im Browser (page.evaluate) */
// Live-Test der Foto-Uploads gegen das Dev-Projekt (echter Ablauf, kein Mock): Staging-Upload → deployte Function quote mit photoIds →
// danach Hinzufügen/Löschen/Ersetzen verweigert → Aufräum-Kandidaten und photo-cleanup.
// Start: npx dotenv -e .env.local -- node scripts/live-uploads.mjs > tmp/proof/s9a4b-live-uploads.log 2>&1; echo EXIT=$? >> tmp/proof/s9a4b-live-uploads.log
// Werte kommen nur aus der Umgebung und werden nie ausgegeben (kein Token, kein Schlüssel, keine URL mit Signatur).
// Alles Angelegte (Nutzer, Anfragen, Dateien) wird im finally gelöscht.
import './dev-guard.mjs'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const cleanupSecret = process.env.CLEANUP_SECRET
const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const service = createClient(url, process.env.SUPABASE_SECRET_KEY, opts)
const anon = createClient(url, pub, opts)
const BUCKET = 'request-photos'
const JPEG = { contentType: 'image/jpeg' }
const CONTACT = { name: 'Test', phone: '+43 660 1234567', email: 'test@movenow.test' }

let failed = 0
const check = (ok, name, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === '' ? '' : `: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`)
}

const users = []
async function newUser(tag) {
  const email = `live-up-${tag}-${Date.now().toString(36)}@movenow.test`
  const password = `${randomUUID()}Aa1!`
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(data.user.id)
  const db = createClient(url, pub, opts)
  const { data: session, error: se } = await db.auth.signInWithPassword({ email, password })
  if (se) throw se
  return { id: data.user.id, db, jwt: session.session.access_token }
}
const pathOf = (user, ref, id) => `${user.id}/${ref}/${id}.jpg`
/** Staging-Upload wie die App: neue UUID, Pfad {user}/{ref}/{id}.jpg, ohne Upsert. */
async function stage(user, ref, body, options = JPEG) {
  const id = randomUUID()
  const path = pathOf(user, ref, id)
  const up = await user.db.storage.from(BUCKET).upload(path, body, options)
  return { id, path, error: up.error }
}
const exists = async (path) => (await service.storage.from(BUCKET).download(path)).error === null
const supabaseCli = (...args) => execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', ...args], { stdio: ['ignore', 'ignore', 'inherit'] })
const backdate = (ids, hours) =>
  supabaseCli('db', 'query', '--linked', `update storage.objects set created_at = now() - interval '${hours} hours' where bucket_id = 'request-photos' and (storage.foldername(name))[1] in (${ids.map((i) => `'${i}'`).join(',')});`)

const small = Uint8Array.from(atob('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='), (c) => c.charCodeAt(0))
const callCleanup = (secret) =>
  fetch(`${url}/functions/v1/photo-cleanup`, { method: 'POST', headers: secret ? { 'x-cleanup-secret': secret } : {} }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }))
const day = new Date(Date.now() + 14 * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' })

/** Echter Aufruf der deployten Function quote, wie die App: Bedingungen und Preis erst abfragen (409), dann mit den gezeigten Werten senden. */
async function quote(user, ref, photoIds, place) {
  const post = async (body) => {
    const res = await fetch(`${url}/functions/v1/quote`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: pub, authorization: `Bearer ${user.jwt}` }, body: JSON.stringify(body) })
    return { status: res.status, json: await res.json().catch(() => null) }
  }
  const base = {
    service: 'clearance', clientRef: ref, inputs: { object: 'flat', area: 60, fill: 'normal', lift: false, floor: 3, special: false, assembly: null },
    from: { label: place.label, point: { lat: place.lat, lon: place.lon } }, preferredDate: day, timeWindow: 'morning', contact: CONTACT, photoIds,
  }
  const shown0 = { kind: 'price', totalCents: 0, lowCents: 0, highCents: 0 }
  const { version } = (await service.from('current_price_version').select('version').single()).data
  const first = await post({ ...base, priceVersion: version, termsHash: 'f'.repeat(64), shown: shown0 })
  if (first.status !== 409 || first.json?.error !== 'terms_changed') return first
  const second = await post({ ...base, priceVersion: version, termsHash: first.json.terms.termsHash, shown: shown0 })
  const snap = second.json?.snapshot
  if (second.status !== 409 || !snap) return second
  return post({ ...base, priceVersion: second.json.priceVersion, termsHash: first.json.terms.termsHash, shown: { kind: 'price', totalCents: snap.totalCents ?? null, lowCents: snap.lowCents, highCents: snap.highCents } })
}

async function purge(uid) {
  const folders = (await service.storage.from(BUCKET).list(uid)).data ?? []
  for (const f of folders) {
    const files = (await service.storage.from(BUCKET).list(`${uid}/${f.name}`)).data ?? []
    if (files.length) await service.storage.from(BUCKET).remove(files.map((x) => `${uid}/${f.name}/${x.name}`))
  }
}

try {
  const a = await newUser('a')
  const b = await newUser('b')
  const ref = randomUUID()

  // 1. Staging: Eigentümer lädt in den eigenen Ordner, liest per signiertem Link; Bucket privat; nur das Pfadformat geht
  const p1 = await stage(a, ref, small)
  const p2 = await stage(a, ref, small)
  check(!p1.error && !p2.error, 'A lädt zwei Fotos ins Staging {user}/{clientRef}/{id}.jpg')
  const signed = await a.db.storage.from(BUCKET).createSignedUrl(p1.path, 60)
  check((signed.data ? await fetch(signed.data.signedUrl) : null)?.ok === true, 'A liest per signierter URL')
  const publicRes = signed.data ? await fetch(signed.data.signedUrl.split('?')[0].replace('/object/sign/', '/object/public/')) : null
  check(publicRes?.ok === false, 'öffentlicher Link funktioniert nicht', publicRes?.status)
  const odd = await a.db.storage.from(BUCKET).upload(`${a.id}/${ref}/foto.jpg`, small, JPEG)
  check(odd.error?.statusCode === '403', 'Dateiname, der keine UUID ist: verweigert', odd.error?.message)
  const foreignFolder = await a.db.storage.from(BUCKET).upload(pathOf(b, ref, randomUUID()), small, JPEG)
  check(foreignFolder.error?.statusCode === '403', 'A kann nicht in B\'s Ordner hochladen', foreignFolder.error?.message)

  // 2. Fremde und anon
  const bRead = await b.db.storage.from(BUCKET).download(p1.path)
  check(bRead.error !== null, 'B kann A\'s Datei nicht lesen', bRead.error?.message)
  const bOver = await b.db.storage.from(BUCKET).upload(p1.path, small, { ...JPEG, upsert: true })
  check(bOver.error?.statusCode === '403', 'B kann A\'s Datei nicht überschreiben', bOver.error?.message)
  const bDel = await b.db.storage.from(BUCKET).remove([p1.path])
  check((bDel.data ?? []).length === 0 && (await exists(p1.path)), 'B kann A\'s Datei nicht löschen', 'Datei unverändert')
  const aOver = await a.db.storage.from(BUCKET).upload(p1.path, small, { ...JPEG, upsert: true })
  check(aOver.error?.statusCode === '403', 'A selbst kann die Datei nicht überschreiben (kein UPDATE)', aOver.error?.message)
  const anonRead = await anon.storage.from(BUCKET).download(p1.path)
  check(anonRead.error !== null, 'anon liest nichts', anonRead.error?.message)
  const anonUp = await anon.storage.from(BUCKET).upload(pathOf(a, ref, randomUUID()), small, JPEG)
  check(anonUp.error?.statusCode === '403', 'anon lädt nichts hoch', anonUp.error?.message)
  const direct = await a.db.from('request_photos').insert({ request_id: randomUUID(), storage_path: p1.path })
  check(direct.error?.code === '42501', 'A kann keine Zeile in request_photos anlegen', direct.error?.message)
  check(((await anon.from('request_photos').select('id')).data ?? []).length === 0, 'anon sieht keine Zeilen')

  // 3. Typ und Größe serverseitig
  for (const type of ['image/png', 'image/webp', 'image/heic']) {
    const r = await stage(a, ref, small, { contentType: type })
    check(r.error?.statusCode === '415', `Server lehnt ${type} ab`, r.error?.message)
  }
  const big = await stage(a, ref, new Uint8Array(11 * 1024 * 1024), JPEG)
  check(big.error?.statusCode === '413', 'Server lehnt 11 MB ab', big.error?.message)

  // 4. Kein Standort in der gespeicherten Datei (Neu-Kodierung wie preparePhoto: Bitmap -> Canvas -> JPEG)
  const browser = await chromium.launch()
  let withoutGps
  let source
  try {
    const page = await browser.newPage()
    const out = await page.evaluate(async () => {
      const c = document.createElement('canvas')
      c.width = c.height = 64
      c.getContext('2d').fillRect(0, 0, 64, 64)
      const jpeg = new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/jpeg'))).arrayBuffer())
      const payload = new TextEncoder().encode('Exif\0\0MM\0*GPS:48.2,16.37')
      const seg = new Uint8Array([0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload])
      const src = new Uint8Array([...jpeg.slice(0, 2), ...seg, ...jpeg.slice(2)])
      const bitmap = await createImageBitmap(new Blob([src], { type: 'image/jpeg' }), { imageOrientation: 'from-image' })
      const c2 = document.createElement('canvas')
      c2.width = bitmap.width
      c2.height = bitmap.height
      c2.getContext('2d').drawImage(bitmap, 0, 0)
      const clean = new Uint8Array(await (await new Promise((r) => c2.toBlob(r, 'image/jpeg', 0.88))).arrayBuffer())
      return { src: Array.from(src), clean: Array.from(clean) }
    })
    source = Buffer.from(out.src)
    withoutGps = Buffer.from(out.clean)
  } finally {
    await browser.close()
  }
  check(source.includes('GPS:48.2'), 'Testbild hat vor der Aufbereitung Standortdaten')
  const gps = await stage(a, ref, withoutGps)
  const stored = Buffer.from(await (await a.db.storage.from(BUCKET).download(gps.path)).data.arrayBuffer())
  check(!gps.error && !stored.includes('GPS') && !stored.includes('Exif'), 'gespeicherte Datei enthält weder GPS noch Exif', `${stored.length} Bytes`)

  // 5. Absenden: deployte Function quote übernimmt die genannte Datei (p1), nicht p2 und nicht gps
  const geo = await fetch(`${url}/functions/v1/route`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: pub, authorization: `Bearer ${a.jwt}` }, body: JSON.stringify({ mode: 'geocode', q: 'Stephansplatz 1, Wien' }) })
  const place = (await geo.json()).candidates?.[0]
  check(!!place, 'route liefert eine Adresse für den Test')
  const sent = await quote(a, ref, [p1.id], place)
  check(sent.status === 200 && typeof sent.json?.id === 'string', 'quote mit photoIds: 200 und Anfrage angelegt', `${sent.status} ${sent.json?.error ?? ''}`.trim())
  const rows = (await service.from('request_photos').select('storage_path').eq('request_id', sent.json?.id ?? randomUUID())).data ?? []
  check(rows.length === 1 && rows[0].storage_path === p1.path, 'genau die genannte Datei ist als request_photos übernommen', rows.map((r) => r.storage_path.split('/').pop()))

  // 6. Fehlende Datei: 422 photo_missing, keine Anfrage (anderer Nutzer, anderes Rate-Limit)
  const refMissing = randomUUID()
  const missing = await quote(b, refMissing, [randomUUID()], place)
  check(missing.status === 422 && missing.json?.error === 'photo_missing', 'quote mit nie hochgeladener ID: 422 photo_missing', `${missing.status} ${missing.json?.error ?? ''}`.trim())
  check(((await service.from('service_requests').select('id').eq('client_ref', refMissing)).data ?? []).length === 0, 'nach photo_missing gibt es keine Anfrage')

  // 7. Nach dem Absenden: Löschen, Ersetzen, Hinzufügen und Umhängen verweigert
  const del = await a.db.storage.from(BUCKET).remove([p1.path])
  check((del.data ?? []).length === 0 && (await exists(p1.path)), 'A kann die übernommene Datei nicht löschen', 'Datei unverändert')
  const over = await a.db.storage.from(BUCKET).upload(p1.path, small, { ...JPEG, upsert: true })
  check(over.error?.statusCode === '403', 'A kann die übernommene Datei nicht ersetzen', over.error?.message)
  const add = await stage(a, ref, small)
  check(add.error?.statusCode === '403', 'A kann nach dem Absenden nichts mehr in den Ordner hochladen', add.error?.message)
  const upd = await service.from('request_photos').update({ storage_path: p2.path }).eq('storage_path', p1.path)
  check(upd.error !== null, 'auch service_role kann die Zeile nicht umhängen', upd.error?.message)
  const rowDel = await service.from('request_photos').delete().eq('storage_path', p1.path)
  check(rowDel.error !== null, 'auch service_role kann die Zeile nicht löschen', rowDel.error?.message)
  check((await service.from('request_photos').select('id').eq('storage_path', p1.path)).data?.length === 1, 'die Zeile ist unverändert da')

  // 8. Aufräumen: p2 (nicht übernommen) ist nach Ablauf Kandidat, p1 (übernommen) nie; Konto gelöscht: Dateien werden zu Waisen
  const c = await newUser('c')
  const photoC = await stage(c, randomUUID(), small)
  await service.auth.admin.deleteUser(c.id)
  users.splice(users.indexOf(c.id), 1)
  check(await exists(photoC.path), 'Datei des gelöschten Kontos liegt bis zum Aufräumen noch da')
  const fresh = await stage(b, randomUUID(), small)
  backdate([a.id, c.id], 30)
  const orphans = ((await service.rpc('photo_orphans')).data ?? []).map((o) => o.name)
  check(orphans.includes(p2.path) && orphans.includes(gps.path) && orphans.includes(photoC.path), 'Waisenliste enthält nicht übernommene Staging-Dateien und die Datei des gelöschten Kontos')
  check(!orphans.includes(p1.path), 'die übernommene Datei steht nicht in der Waisenliste, auch nicht nach 30 Stunden')
  check(!orphans.includes(fresh.path), 'frisches Staging-Foto steht nicht in der Waisenliste')
  check(!!cleanupSecret, 'CLEANUP_SECRET gesetzt (sonst ist die Löschung nicht belegbar: npm run setup:photo-cleanup)')
  if (cleanupSecret) {
    const none = await callCleanup('')
    const wrong = await callCleanup('0'.repeat(64))
    check(none.status === 401 && wrong.status === 401, 'Function ohne und mit falschem Secret: 401', [none.status, wrong.status])
    check((await fetch(`${url}/functions/v1/photo-cleanup`, { method: 'GET', headers: { 'x-cleanup-secret': cleanupSecret } })).status === 405, 'GET: 405')
    check(await exists(p2.path), 'nach den 401 liegt die Datei noch da')
    const ok = await callCleanup(cleanupSecret)
    check(ok.status === 200 && ok.json?.removed >= 3, 'Function mit Secret: 200 und Waisen entfernt', ok.json)
    check(!(await exists(p2.path)) && !(await exists(gps.path)) && !(await exists(photoC.path)), 'nicht übernommene und verwaiste Dateien sind weg')
    check((await exists(p1.path)) && (await exists(fresh.path)), 'Negativkontrolle: die übernommene (30 h alt) und die frische Datei sind geblieben')
  }
} catch (e) {
  failed++
  console.log(`FAIL Abbruch: ${e instanceof Error ? e.message : 'unbekannt'}`)
} finally {
  for (const uid of users) await purge(uid)
  // Anfragen verschwinden mit dem Konto (Kaskade); ein direktes DELETE ist gesperrt
  for (const id of users) await service.auth.admin.deleteUser(id)
  console.log(`Aufgeräumt: Nutzer ${users.length}`)
  console.log(failed === 0 ? 'ALLES BESTANDEN' : `${failed} FEHLER`)
  process.exitCode = failed === 0 ? 0 : 1
}
