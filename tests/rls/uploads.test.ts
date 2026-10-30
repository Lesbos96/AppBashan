// Foto-Upload (src/lib/uploads.ts) gegen das Dev-Projekt: privater Bucket, Eintrag vor Datei, Rollback, Limit 8, signierte Links.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { photoUrls, uploadPhotos } from '../../src/lib/uploads.ts'
import type { Photo } from '../../src/lib/photos.ts'
import { deleteUsers, makeUser, must, service, type TestUser } from '../support/db.ts'

const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))
const photo = (size = 0): Photo => ({ id: crypto.randomUUID(), blob: new Blob([size ? new Uint8Array(size) : png], { type: 'image/jpeg' }), url: 'blob:test' })

let a: TestUser
let b: TestUser
let requestA: string

const newRequest = async (user: TestUser) =>
  must(
    await service
      .from('service_requests')
      .insert({ customer_id: user.id, service: 'move', inputs: {}, price_snapshot: {}, price_version: 1, estimate_cents: 1 })
      .select('id')
      .single(),
  ).id

const entries = async (id: string) => must(await service.from('request_photos').select('storage_path').eq('request_id', id))
const objects = async (user: TestUser, id: string) => must(await service.storage.from('request-photos').list(`${user.id}/${id}`))

beforeAll(async () => {
  a = await makeUser('upload-a')
  b = await makeUser('upload-b')
  requestA = await newRequest(a)
})

afterAll(async () => {
  const files = (await service.storage.from('request-photos').list(`${a.id}/${requestA}`)).data ?? []
  if (files.length) await service.storage.from('request-photos').remove(files.map((f) => `${a.id}/${requestA}/${f.name}`))
  await deleteUsers()
})

describe('Foto-Upload', () => {
  it('Eintrag und Datei im Pfad {user}/{request}/{id}.jpg, signierte Links nur für den Eigentümer', async () => {
    const p = photo()
    const result = await uploadPhotos(a.db, a.id, requestA, [p])
    expect(result).toEqual({ uploaded: [`${a.id}/${requestA}/${p.id}.jpg`], failed: [] })
    expect((await entries(requestA)).map((e) => e.storage_path)).toEqual(result.uploaded)
    const urls = await photoUrls(a.db, requestA)
    expect(urls).toHaveLength(1)
    expect(urls[0]).toContain('/object/sign/request-photos/')
    expect((await fetch(urls[0]!)).ok).toBe(true)
    // der Bucket ist privat: ohne Token kein Zugriff
    expect((await fetch(urls[0]!.split('?')[0]!.replace('/object/sign/', '/object/public/'))).ok).toBe(false)
    // fremde Anfrage: keine Einträge, keine Links
    expect(await photoUrls(b.db, requestA)).toEqual([])
  })

  it('Datei zu groß: lehnt der Client vor dem Eintrag ab', async () => {
    const before = await entries(requestA)
    const big = photo(11 * 1024 * 1024)
    expect(await uploadPhotos(a.db, a.id, requestA, [big])).toEqual({ uploaded: [], failed: [big] })
    expect(await entries(requestA)).toEqual(before)
  })

  it('Upload scheitert nach dem Eintrag (Pfad belegt): der Eintrag verschwindet wieder', async () => {
    const before = await entries(requestA)
    const p = photo()
    const path = `${a.id}/${requestA}/${p.id}.jpg`
    must(await service.storage.from('request-photos').upload(path, png, { contentType: 'image/jpeg' }))
    try {
      expect(await uploadPhotos(a.db, a.id, requestA, [p])).toEqual({ uploaded: [], failed: [p] })
      expect(await entries(requestA)).toEqual(before)
    } finally {
      await service.storage.from('request-photos').remove([path])
    }
  })

  it('höchstens 8 Fotos je Anfrage: das neunte scheitert, die ersten acht bleiben, keine Reste', async () => {
    const photos = Array.from({ length: 9 }, () => photo())
    const result = await uploadPhotos(a.db, a.id, requestA, photos)
    expect(result.uploaded.length + 1).toBe(8) // eines liegt schon aus dem ersten Test dort
    expect(result.failed).toHaveLength(2)
    expect(await entries(requestA)).toHaveLength(8)
    expect(await objects(a, requestA)).toHaveLength(8)
  })

  it('fremde Anfrage und fremder Pfad werden abgelehnt', async () => {
    const result = await uploadPhotos(b.db, b.id, requestA, [photo()])
    expect(result.uploaded).toEqual([])
    expect(result.failed).toHaveLength(1)
    const own = await newRequest(b)
    const wrongUser = await uploadPhotos(b.db, a.id, own, [photo()]) // Pfad im Ordner eines anderen Nutzers
    expect(wrongUser.uploaded).toEqual([])
  })

  it('geschlossene Anfrage (nicht mehr „angefragt“): kein Upload', async () => {
    const closed = await newRequest(a)
    must(await service.from('service_requests').update({ status: 'confirmed' }).eq('id', closed).select())
    expect((await uploadPhotos(a.db, a.id, closed, [photo()])).uploaded).toEqual([])
  })
})
