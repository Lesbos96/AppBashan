// Foto-Upload (src/lib/uploads.ts) und Storage-Policies gegen das Dev-Projekt: je Regel erlaubt UND verweigert, mit genauem Fehler.
// Start: npm run test:rls. Nie gegen das Produktivprojekt.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { deletePhoto, uploadPhoto } from '../../src/lib/uploads.ts'
import type { Photo } from '../../src/lib/photos.ts'
import { anon, deleteUsers, makeUser, must, service, type TestUser } from '../support/db.ts'

const BUCKET = 'request-photos'
const bytes = Uint8Array.from(atob('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='), (c) => c.charCodeAt(0))
const photo = (size = 0): Photo => ({ id: crypto.randomUUID(), blob: new Blob([size ? new Uint8Array(size) : bytes], { type: 'image/jpeg' }), url: 'blob:test' })
const JPEG = { contentType: 'image/jpeg' }

let a: TestUser
let b: TestUser
let requestA: string
const requests: string[] = []

const newRequest = async (user: TestUser, status = 'requested') => {
  const id = must(
    await service
      .from('service_requests')
      .insert({ customer_id: user.id, service: 'move', inputs: {}, price_snapshot: {}, price_version: 1, estimate_cents: 1, status: status as 'requested' })
      .select('id')
      .single(),
  ).id
  requests.push(id)
  return id
}
const rows = async (id: string) => must(await service.from('request_photos').select('id, storage_path').eq('request_id', id))
const exists = async (path: string) => (await service.storage.from(BUCKET).download(path)).error === null
const pathOf = (user: TestUser, request: string, id: string) => `${user.id}/${request}/${id}.jpg`

beforeAll(async () => {
  a = await makeUser('upload-a')
  b = await makeUser('upload-b')
  requestA = await newRequest(a)
})

afterAll(async () => {
  for (const id of requests) {
    const files = (await service.from('request_photos').select('storage_path').eq('request_id', id)).data ?? []
    if (files.length) await service.storage.from(BUCKET).remove(files.map((f) => f.storage_path))
  }
  await deleteUsers()
})

describe('Zeile und Pfad (request_photos)', () => {
  it('erlaubt: der Server setzt den Pfad {user}/{request}/{id}.jpg', async () => {
    const id = crypto.randomUUID()
    const row = must(await a.db.from('request_photos').insert({ id, request_id: requestA }).select('storage_path').single())
    expect(row.storage_path).toBe(pathOf(a, requestA, id))
  })

  it('verweigert: ein vom Client gewählter Pfad (Spalte storage_path ist nicht beschreibbar)', async () => {
    const r = await a.db.from('request_photos').insert({ request_id: requestA, storage_path: `${a.id}/${requestA}/../x.jpg` })
    expect(r.error).toMatchObject({ code: '42501', message: 'permission denied for table request_photos' })
  })

  it('verweigert: fremde Anfrage', async () => {
    const r = await b.db.from('request_photos').insert({ request_id: requestA })
    expect(r.error).toMatchObject({ code: '42501', message: 'new row violates row-level security policy for table "request_photos"' })
  })

  it('verweigert: anon', async () => {
    const r = await anon.from('request_photos').insert({ request_id: requestA })
    expect(r.error).toMatchObject({ code: '42501' })
    expect((await anon.from('request_photos').select('id')).data ?? []).toEqual([])
  })

  it('verweigert: geschlossene Anfrage (nicht mehr „angefragt“), auch Löschen', async () => {
    const closed = await newRequest(a)
    const p = photo()
    must(await a.db.from('request_photos').insert({ id: p.id, request_id: closed }).select())
    must(await service.from('service_requests').update({ status: 'confirmed' }).eq('id', closed).select())
    expect((await a.db.from('request_photos').insert({ request_id: closed })).error).toMatchObject({ code: '42501' })
    expect((await a.db.from('request_photos').delete().eq('id', p.id).select()).data).toEqual([])
    expect(await rows(closed)).toHaveLength(1)
  })

  it('Limit: 12 parallele Einträge ergeben genau 8, der Rest scheitert mit dem Limit-Fehler', async () => {
    const request = await newRequest(a)
    const results = await Promise.all(Array.from({ length: 12 }, () => a.db.from('request_photos').insert({ request_id: request })))
    const failed = results.filter((r) => r.error)
    expect(await rows(request)).toHaveLength(8)
    expect(failed).toHaveLength(4)
    for (const r of failed) expect(r.error).toMatchObject({ code: '23514', message: 'Höchstens 8 Fotos je Anfrage' })
  })
})

describe('Objekte (storage.objects)', () => {
  let req: string
  beforeEach(async () => {
    req = await newRequest(a)
  })

  it('erlaubt: Eigentümer lädt hoch, liest per signiertem Link, der Bucket ist privat', async () => {
    const p = photo()
    expect(await uploadPhoto(a.db, a.id, req, p)).toBeNull()
    const signed = must(await a.db.storage.from(BUCKET).createSignedUrl(pathOf(a, req, p.id), 60))
    expect((await fetch(signed.signedUrl)).ok).toBe(true)
    const publicUrl = signed.signedUrl.split('?')[0]!.replace('/object/sign/', '/object/public/')
    expect((await fetch(publicUrl)).ok).toBe(false)
    expect((await b.db.storage.from(BUCKET).createSignedUrl(pathOf(a, req, p.id), 60)).error).toMatchObject({ message: 'Object not found' })
  })

  it('idempotent: zweimal hochladen ergibt ein Foto; Zeile ohne Datei wird nachgeholt', async () => {
    const request = await newRequest(a)
    const p = photo()
    expect(await uploadPhoto(a.db, a.id, request, p)).toBeNull()
    expect(await uploadPhoto(a.db, a.id, request, p)).toBeNull()
    expect(await rows(request)).toHaveLength(1)
    const q = photo()
    must(await a.db.from('request_photos').insert({ id: q.id, request_id: request }).select())
    expect(await exists(pathOf(a, request, q.id))).toBe(false)
    expect(await uploadPhoto(a.db, a.id, request, q)).toBeNull()
    expect(await exists(pathOf(a, request, q.id))).toBe(true)
    expect(await rows(request)).toHaveLength(2)
  })

  it('Limit im Client-Pfad: das neunte Foto scheitert mit „limit“, es entsteht keine Datei', async () => {
    const request = await newRequest(a)
    for (let i = 0; i < 8; i++) expect(await uploadPhoto(a.db, a.id, request, photo())).toBeNull()
    const ninth = photo()
    expect(await uploadPhoto(a.db, a.id, request, ninth)).toBe('limit')
    expect(await exists(pathOf(a, request, ninth.id))).toBe(false)
  })

  it('Wiederholen beim achten Foto: Zeile da, Datei fehlt, Wiederholen legt nur die Datei an (kein Limit-Fehler)', async () => {
    const request = await newRequest(a)
    for (let i = 0; i < 7; i++) expect(await uploadPhoto(a.db, a.id, request, photo())).toBeNull()
    const eighth = photo()
    must(await a.db.from('request_photos').insert({ id: eighth.id, request_id: request }).select())
    expect(await exists(pathOf(a, request, eighth.id))).toBe(false)
    expect(await uploadPhoto(a.db, a.id, request, eighth)).toBeNull()
    expect(await exists(pathOf(a, request, eighth.id))).toBe(true)
    expect(await rows(request)).toHaveLength(8)
  })

  it('zu groß: der Client lehnt ab, der Bucket auch (413)', async () => {
    const big = photo(11 * 1024 * 1024)
    expect(await uploadPhoto(a.db, a.id, req, big)).toBe('too_big')
    const own = photo()
    must(await a.db.from('request_photos').insert({ id: own.id, request_id: req }).select())
    const r = await a.db.storage.from(BUCKET).upload(pathOf(a, req, own.id), big.blob, JPEG)
    expect(r.error).toMatchObject({ statusCode: '413', message: 'The object exceeded the maximum allowed size' })
  })

  it('falscher Typ: der Bucket lehnt PNG, WebP und HEIC ab (415)', async () => {
    for (const type of ['image/png', 'image/webp', 'image/heic', 'text/plain']) {
      const own = photo()
      must(await a.db.from('request_photos').insert({ id: own.id, request_id: req }).select())
      const r = await a.db.storage.from(BUCKET).upload(pathOf(a, req, own.id), bytes, { contentType: type })
      expect(r.error, type).toMatchObject({ statusCode: '415', message: `mime type ${type} is not supported` })
    }
  })

  it('verweigert: Upload ohne vorherige Zeile, mit Großbuchstaben oder anderer Endung', async () => {
    const id = crypto.randomUUID()
    const denied = { statusCode: '403', message: 'new row violates row-level security policy' }
    expect((await a.db.storage.from(BUCKET).upload(pathOf(a, req, id), bytes, JPEG)).error).toMatchObject(denied)
    must(await a.db.from('request_photos').insert({ id, request_id: req }).select())
    expect((await a.db.storage.from(BUCKET).upload(pathOf(a, req, id).toUpperCase(), bytes, JPEG)).error).toMatchObject(denied)
    expect((await a.db.storage.from(BUCKET).upload(`${a.id}/${req}/${id}.png`, bytes, JPEG)).error).toMatchObject(denied)
    expect((await a.db.storage.from(BUCKET).upload(`${a.id}/${req}/../${id}.jpg`, bytes, JPEG)).error).not.toBeNull()
  })

  it('verweigert: fremder Nutzer liest, überschreibt, löscht, verschiebt nicht; anon bekommt nichts', async () => {
    const p = photo()
    expect(await uploadPhoto(a.db, a.id, req, p)).toBeNull()
    const path = pathOf(a, req, p.id)
    const before = must(await service.storage.from(BUCKET).download(path))

    expect((await b.db.storage.from(BUCKET).download(path)).error).not.toBeNull()
    expect((await b.db.storage.from(BUCKET).upload(path, bytes, { ...JPEG, upsert: true })).error).toMatchObject({ statusCode: '403' })
    expect((await b.db.storage.from(BUCKET).update(path, bytes, JPEG)).error).not.toBeNull()
    expect(must(await b.db.storage.from(BUCKET).remove([path]))).toEqual([])
    expect((await b.db.storage.from(BUCKET).move(path, `${b.id}/x.jpg`)).error).not.toBeNull()
    expect((await b.db.storage.from(BUCKET).copy(path, `${b.id}/x.jpg`)).error).not.toBeNull()
    expect((await b.db.storage.from(BUCKET).list(`${a.id}/${req}`)).data ?? []).toEqual([])
    expect(must(await b.db.from('request_photos').delete().eq('id', p.id).select())).toEqual([])

    expect((await anon.storage.from(BUCKET).download(path)).error).not.toBeNull()
    expect((await anon.storage.from(BUCKET).upload(`${a.id}/${req}/${crypto.randomUUID()}.jpg`, bytes, JPEG)).error).toMatchObject({ statusCode: '403' })
    expect((await anon.storage.from(BUCKET).remove([path])).data ?? []).toEqual([])

    // unverändert vorhanden
    expect(Buffer.from(await must(await service.storage.from(BUCKET).download(path)).arrayBuffer())).toEqual(Buffer.from(await before.arrayBuffer()))
  })

  it('verweigert: der Eigentümer überschreibt seine eigene Datei nicht (kein UPDATE-Recht)', async () => {
    const p = photo()
    expect(await uploadPhoto(a.db, a.id, req, p)).toBeNull()
    const r = await a.db.storage.from(BUCKET).upload(pathOf(a, req, p.id), bytes, { ...JPEG, upsert: true })
    expect(r.error).toMatchObject({ statusCode: '403' })
  })

  it('verweigert: Upload nach dem Zurückziehen (Anfrage nicht mehr offen)', async () => {
    const request = await newRequest(a)
    const p = photo()
    must(await a.db.from('request_photos').insert({ id: p.id, request_id: request }).select())
    must(await service.from('service_requests').update({ status: 'withdrawn' }).eq('id', request).select())
    const r = await a.db.storage.from(BUCKET).upload(pathOf(a, request, p.id), bytes, JPEG)
    expect(r.error).toMatchObject({ statusCode: '403', message: 'new row violates row-level security policy' })
  })

  it('verweigert: Datei löschen, sobald die Anfrage nicht mehr offen ist', async () => {
    const p = photo()
    expect(await uploadPhoto(a.db, a.id, req, p)).toBeNull()
    must(await service.from('service_requests').update({ status: 'confirmed' }).eq('id', req).select())
    expect(must(await a.db.storage.from(BUCKET).remove([pathOf(a, req, p.id)]))).toEqual([])
    expect(await exists(pathOf(a, req, p.id))).toBe(true)
  })

  it('Entfernen: erst Zeile, dann Datei', async () => {
    const request = await newRequest(a)
    const p = photo()
    expect(await uploadPhoto(a.db, a.id, request, p)).toBeNull()
    await deletePhoto(a.db, a.id, request, p.id)
    expect(await rows(request)).toEqual([])
    expect(await exists(pathOf(a, request, p.id))).toBe(false)
  })
})

describe('Aufräumen', () => {
  // Ohne Vault-Einträge scheitert photo_cleanup (Migration 0014): klare Meldung statt unverständlichem Fehler, nie überspringen.
  beforeAll(async () => {
    const { error } = await service.rpc('photo_cleanup')
    if (error?.message.includes('nicht eingerichtet')) throw new Error('Vault-Secrets fehlen – npm run setup:photo-cleanup ausführen')
  })

  it('Waisen-Liste und Aufräumjob sind nur für service_role aufrufbar', async () => {
    for (const fn of ['photo_orphans', 'photo_cleanup'] as const) {
      expect((await anon.rpc(fn)).error, `anon ${fn}`).toMatchObject({ code: '42501' })
      expect((await a.db.rpc(fn)).error, `kunde ${fn}`).toMatchObject({ code: '42501' })
      expect((await service.rpc(fn)).error, `service ${fn}`).toBeNull()
    }
  })

  it('Zeilen ohne Datei werden nach 48 Stunden gelöscht, frische bleiben', async () => {
    const request = await newRequest(a)
    const old = crypto.randomUUID()
    const fresh = crypto.randomUUID()
    must(await a.db.from('request_photos').insert([{ id: old, request_id: request }, { id: fresh, request_id: request }]).select())
    must(await service.from('request_photos').update({ created_at: new Date(Date.now() - 49 * 3600_000).toISOString() }).eq('id', old).select())
    expect((await service.rpc('photo_cleanup')).error).toBeNull()
    expect((await rows(request)).map((r) => r.id)).toEqual([fresh])
  })
})
