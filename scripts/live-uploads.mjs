/* global document, createImageBitmap -- laufen im Browser (page.evaluate) */
// Live-Test der Foto-Uploads gegen das Dev-Projekt (Storage-Policies, Bucket-Grenzen, Aufräumen).
// Start: npx dotenv -e .env.local -- node scripts/live-uploads.mjs | tee tmp/proof/live-uploads.log
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

let failed = 0
const check = (ok, name, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === '' ? '' : `: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`)
}

const users = []
const requests = []
async function newUser(tag) {
  const email = `live-up-${tag}-${Date.now().toString(36)}@movenow.test`
  const password = `${randomUUID()}Aa1!`
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(data.user.id)
  const db = createClient(url, pub, opts)
  const { error: se } = await db.auth.signInWithPassword({ email, password })
  if (se) throw se
  return { id: data.user.id, db }
}
async function newRequest(user) {
  // einziger Weg: dieselbe SQL-Funktion wie quote (direkte Inserts gibt es nicht mehr)
  const { version } = (await service.from('current_price_version').select('version').single()).data
  const day = new Date(Date.now() + 14 * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' })
  const snapshot = { kind: 'price', totalCents: 100, lowCents: 100, highCents: 100, lines: [{ key: 'a', cents: 100 }] }
  const { data, error } = await service.rpc('quote_save_request', {
    p_customer: user.id, p_client_ref: randomUUID(), p_service: 'move', p_inputs: {}, p_snapshot: snapshot, p_price_version: version, p_total: 100, p_low: 100, p_high: 100,
    p_from_address: null, p_from_postcode: null, p_from_lon: null, p_from_lat: null, p_to_address: null, p_to_postcode: null, p_to_lon: null, p_to_lat: null,
    p_route: null, p_region: null, p_preferred_date: day, p_time_window: null, p_description: null, p_volume: null,
  })
  if (error) throw error
  requests.push(data[0].id)
  return data[0].id
}
/** Zeile, dann Datei, wie die App. Liefert den Pfad und den Upload-Fehler. */
async function addPhoto(user, request, body, options = JPEG) {
  const id = randomUUID()
  const row = await user.db.from('request_photos').insert({ id, request_id: request }).select('storage_path').single()
  if (row.error) return { rowError: row.error }
  const path = row.data.storage_path
  const up = await user.db.storage.from(BUCKET).upload(path, body, options)
  return { id, path, uploadError: up.error }
}
const exists = async (path) => (await service.storage.from(BUCKET).download(path)).error === null
const supabaseCli = (...args) => execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', ...args], { stdio: ['ignore', 'ignore', 'inherit'] })
const backdate = (ids) =>
  supabaseCli('db', 'query', '--linked', `update storage.objects set created_at = now() - interval '2 hours' where bucket_id = 'request-photos' and (storage.foldername(name))[1] in (${ids.map((i) => `'${i}'`).join(',')});`)

const small = Uint8Array.from(atob('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='), (c) => c.charCodeAt(0))
const callCleanup = (secret) =>
  fetch(`${url}/functions/v1/photo-cleanup`, { method: 'POST', headers: secret ? { 'x-cleanup-secret': secret } : {} }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }))

try {
  const a = await newUser('a')
  const b = await newUser('b')
  const reqA = await newRequest(a)

  // 1. Eigentümer: hochladen, lesen per signiertem Link; Bucket privat
  const first = await addPhoto(a, reqA, small)
  check(!first.rowError && !first.uploadError, 'A lädt hoch (Zeile, dann Datei)')
  check(first.path === `${a.id}/${reqA}/${first.id}.jpg`, 'Pfad {user}/{anfrage}/{id}.jpg vom Server gesetzt')
  const signed = await a.db.storage.from(BUCKET).createSignedUrl(first.path, 60)
  const res = signed.data ? await fetch(signed.data.signedUrl) : null
  check(res?.ok === true, 'A liest per signierter URL')
  const publicRes = signed.data ? await fetch(signed.data.signedUrl.split('?')[0].replace('/object/sign/', '/object/public/')) : null
  check(publicRes?.ok === false, 'öffentlicher Link funktioniert nicht', publicRes?.status)

  // 2. Fremde und anon
  const denied = (name, ok, detail) => check(ok, name, detail)
  const bRead = await b.db.storage.from(BUCKET).download(first.path)
  denied('B kann A\'s Datei nicht lesen', bRead.error !== null, bRead.error?.message)
  const bOver = await b.db.storage.from(BUCKET).upload(first.path, small, { ...JPEG, upsert: true })
  denied('B kann A\'s Datei nicht überschreiben', bOver.error?.statusCode === '403', bOver.error?.message)
  const bDel = await b.db.storage.from(BUCKET).remove([first.path])
  denied('B kann A\'s Datei nicht löschen', (bDel.data ?? []).length === 0 && (await exists(first.path)), 'Datei unverändert')
  const bRow = await b.db.from('request_photos').insert({ request_id: reqA })
  denied('B kann keine Zeile in A\'s Anfrage anlegen', bRow.error?.code === '42501', bRow.error?.message)
  const aOver = await a.db.storage.from(BUCKET).upload(first.path, small, { ...JPEG, upsert: true })
  denied('A selbst kann die Datei nicht überschreiben (kein UPDATE)', aOver.error?.statusCode === '403', aOver.error?.message)
  const anonRead = await anon.storage.from(BUCKET).download(first.path)
  denied('anon liest nichts', anonRead.error !== null, anonRead.error?.message)
  const anonUp = await anon.storage.from(BUCKET).upload(`${a.id}/${reqA}/${randomUUID()}.jpg`, small, JPEG)
  denied('anon lädt nichts hoch', anonUp.error?.statusCode === '403', anonUp.error?.message)
  denied('anon sieht keine Zeilen', ((await anon.from('request_photos').select('id')).data ?? []).length === 0)

  // 3. Typ und Größe serverseitig
  for (const type of ['image/png', 'image/webp', 'image/heic']) {
    const r = await addPhoto(a, reqA, small, { contentType: type })
    denied(`Server lehnt ${type} ab`, r.uploadError?.statusCode === '415', r.uploadError?.message)
  }
  const big = await addPhoto(a, reqA, new Uint8Array(11 * 1024 * 1024), JPEG)
  denied('Server lehnt 11 MB ab', big.uploadError?.statusCode === '413', big.uploadError?.message)

  // 4. Limit: 8 je Anfrage (Zeilen werden gezählt, abgelehnte Uploads haben ihre Zeile behalten)
  const reqLimit = await newRequest(a)
  const results = []
  for (let i = 0; i < 9; i++) results.push(await addPhoto(a, reqLimit, small))
  denied('die ersten 8 Fotos gehen durch', results.slice(0, 8).every((r) => !r.rowError && !r.uploadError))
  denied('das 9. Foto wird abgelehnt (23514)', results[8].rowError?.code === '23514', results[8].rowError?.message)
  denied('von 9 Versuchen liegen 8 Dateien im Ordner', ((await service.storage.from(BUCKET).list(`${a.id}/${reqLimit}`)).data ?? []).length === 8)

  // 5. Kein Standort in der gespeicherten Datei (Neu-Kodierung wie preparePhoto: Bitmap -> Canvas -> JPEG)
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
  const gpsReq = await newRequest(a)
  const gps = await addPhoto(a, gpsReq, withoutGps)
  const stored = Buffer.from(await (await a.db.storage.from(BUCKET).download(gps.path)).data.arrayBuffer())
  check(!gps.uploadError && !stored.includes('GPS') && !stored.includes('Exif'), 'gespeicherte Datei enthält weder GPS noch Exif', `${stored.length} Bytes`)

  // 6. Gelöschte Anfrage und gelöschtes Konto: Zeilen verschwinden sofort, Dateien beim Aufräumen
  const c = await newUser('c')
  const reqC = await newRequest(c)
  const photoC = await addPhoto(c, reqC, small)
  const deletedRequestPaths = [gps.path, ...results.filter((r) => r.path).map((r) => r.path)]
  check(((await service.from('request_photos').select('id').in('request_id', [gpsReq, reqLimit])).data ?? []).length === 0, 'Anfrage gelöscht: Foto-Zeilen sind mit weg')
  await service.auth.admin.deleteUser(c.id)
  users.splice(users.indexOf(c.id), 1)
  check(((await service.from('request_photos').select('id').eq('request_id', reqC)).data ?? []).length === 0, 'Konto gelöscht: Anfrage und Foto-Zeilen sind mit weg')
  check(await exists(photoC.path), 'Datei des gelöschten Kontos liegt bis zum Aufräumen noch da')

  // 7. Aufräumen: Waisen sind nach einer Stunde in der Liste, die Function entfernt sie
  const keep = await addPhoto(a, reqA, small)
  const foreign = await addPhoto(b, await newRequest(b), small)
  backdate([a.id, b.id, c.id])
  const orphans = ((await service.rpc('photo_orphans')).data ?? []).map((o) => o.name)
  check(deletedRequestPaths.every((p) => orphans.includes(p)) && orphans.includes(photoC.path), 'Waisenliste enthält alle Dateien gelöschter Anfragen und Konten')
  check(!orphans.includes(keep.path) && !orphans.includes(first.path), 'Dateien mit Zeile stehen nicht in der Waisenliste')
  check(!!cleanupSecret, 'CLEANUP_SECRET gesetzt (sonst ist die Löschung nicht belegbar: npm run setup:photo-cleanup)')
  if (cleanupSecret) {
    const none = await callCleanup('')
    const wrong = await callCleanup('0'.repeat(64))
    check(none.status === 401 && wrong.status === 401, 'Function ohne und mit falschem Secret: 401', [none.status, wrong.status])
    check((await fetch(`${url}/functions/v1/photo-cleanup`, { method: 'GET', headers: { 'x-cleanup-secret': cleanupSecret } })).status === 405, 'GET: 405')
    check(await exists(keep.path), 'nach den 401 liegt die Datei mit Zeile noch da')
    const ok = await callCleanup(cleanupSecret)
    check(ok.status === 200 && ok.json?.removed >= orphans.length, 'Function mit Secret: 200 und Waisen entfernt', ok.json)
    check(!(await exists(photoC.path)) && !(await exists(gps.path)), 'Dateien gelöschter Anfragen und Konten sind weg')
    check((await exists(keep.path)) && (await exists(first.path)) && (await exists(foreign.path)), 'Negativkontrolle: rückdatierte Dateien mit Zeile (A und fremder Nutzer B) sind geblieben')
    const count = async (prefix) => ((await service.storage.from(BUCKET).list(prefix)).data ?? []).length
    check((await count(`${a.id}/${gpsReq}`)) === 0 && (await count(`${a.id}/${reqLimit}`)) === 0, 'Anfrage gelöscht: 0 Dateien unter {user}/{anfrage}')
    check((await count(`${c.id}/${reqC}`)) === 0 && (await count(c.id)) === 0, 'Konto gelöscht: 0 Dateien unter {user}/ und {user}/{anfrage}')
  }
} catch (e) {
  failed++
  console.log(`FAIL Abbruch: ${e instanceof Error ? e.message : 'unbekannt'}`)
} finally {
  const { data } = await service.from('request_photos').select('storage_path').in('request_id', requests)
  const prefixes = [...users]
  for (const uid of prefixes) {
    for (const r of requests) {
      const files = (await service.storage.from(BUCKET).list(`${uid}/${r}`)).data ?? []
      if (files.length) await service.storage.from(BUCKET).remove(files.map((f) => `${uid}/${r}/${f.name}`))
    }
  }
  if (data?.length) await service.storage.from(BUCKET).remove(data.map((d) => d.storage_path))
  // Anfragen verschwinden mit dem Konto (Kaskade); ein direktes DELETE ist gesperrt
  for (const id of users) await service.auth.admin.deleteUser(id)
  const left = await service.from('service_requests').select('id', { count: 'exact', head: true }).in('id', requests)
  console.log(`Aufgeräumt: Nutzer ${users.length}, Anfragen übrig ${left.count ?? 0}`)
  console.log(failed === 0 ? 'ALLES BESTANDEN' : `${failed} FEHLER`)
  process.exitCode = failed === 0 ? 0 : 1
}
