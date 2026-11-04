import { describe, expect, it } from 'vitest'
import { MAX_BYTES, PhotoError, clearPhotos, getPhotos, preparePhoto, renewPhotoIds } from '../../src/lib/photos'
import { failureText, photoRejectedText, photoUrls } from '../../src/lib/uploads'

describe('preparePhoto: Grenzfälle', () => {
  // Chrome unter Windows und manche Android-Galerien liefern für .heic keinen MIME-Typ (`type` leer).
  // Der Namens-Check soll dann die HEIC-Meldung bringen, nicht „Das ist kein Bild.“
  it.each([
    ['', 'IMG_1.HEIC'],
    ['', 'foto.heif'],
    ['application/octet-stream', 'IMG_2.heic'],
  ])('HEIC am Dateinamen erkannt (Typ „%s“, %s)', async (type, name) => {
    await expect(preparePhoto(new File(['x'], name, { type }))).rejects.toThrow('HEIC-Fotos gehen hier nicht')
  })

  it('ohne Typ und ohne HEIC-Namen bleibt es „kein Bild“', async () => {
    await expect(preparePhoto(new File(['x'], 'notiz.txt', { type: '' }))).rejects.toThrow('Das ist kein Bild.')
  })

  it('genau 10 MB passieren die Größenprüfung (erst das Dekodieren scheitert hier ohne Browser)', async () => {
    const exact = new File([new Uint8Array(MAX_BYTES)], 'a.jpg', { type: 'image/jpeg' })
    const error = await preparePhoto(exact).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PhotoError)
    expect((error as Error).message).not.toMatch(/10 MB/)
    expect((error as Error).message).toBe('Dieses Bild lässt sich nicht lesen. Nimm ein JPEG, PNG oder WebP.')
  })
})

describe('Foto-Speicher ohne Fotos', () => {
  it('unbekannter Schlüssel: leere Liste, Leeren und neue IDs ohne Fehler', () => {
    expect(getPhotos('movenow.photos.unbekannt')).toEqual([])
    expect(() => clearPhotos('movenow.photos.unbekannt')).not.toThrow()
    expect(() => renewPhotoIds('movenow.photos.unbekannt')).not.toThrow()
    expect(getPhotos('movenow.photos.unbekannt')).toEqual([])
  })
})

describe('photoUrls: signierte Links der eigenen Anfrage', () => {
  function fakeDb(rows: { data: unknown; error: unknown }, signed?: { data: unknown; error: unknown }) {
    const calls = { eq: [] as unknown[], signed: [] as unknown[][] }
    const db = {
      from: (table: string) => {
        expect(table).toBe('request_photos')
        const q = {
          select: (cols: string) => (expect(cols).toBe('storage_path'), q),
          eq: (col: string, v: unknown) => (calls.eq.push([col, v]), q),
          order: () => Promise.resolve(rows),
        }
        return q
      },
      storage: { from: () => ({ createSignedUrls: (paths: string[], seconds: number) => (calls.signed.push([paths, seconds]), Promise.resolve(signed)) }) },
    }
    return { db: db as never, calls }
  }

  it('filtert auf die Anfrage, signiert 10 Minuten, lässt Einträge ohne Link weg', async () => {
    const { db, calls } = fakeDb({ data: [{ storage_path: 'u/r/a.jpg' }, { storage_path: 'u/r/b.jpg' }], error: null }, { data: [{ signedUrl: 'https://x/a' }, { signedUrl: null }], error: null })
    await expect(photoUrls(db, 'req-1')).resolves.toEqual(['https://x/a'])
    expect(calls.eq).toEqual([['request_id', 'req-1']])
    expect(calls.signed).toEqual([[['u/r/a.jpg', 'u/r/b.jpg'], 600]])
  })

  it('ohne Fotos: kein Signier-Aufruf', async () => {
    const { db, calls } = fakeDb({ data: [], error: null })
    await expect(photoUrls(db, 'req-1')).resolves.toEqual([])
    expect(calls.signed).toEqual([])
  })

  it('Fehler beim Lesen oder Signieren werden geworfen', async () => {
    const e1 = { message: 'denied' }
    await expect(photoUrls(fakeDb({ data: null, error: e1 }).db, 'r')).rejects.toBe(e1)
    const e2 = { message: 'storage' }
    await expect(photoUrls(fakeDb({ data: [{ storage_path: 'p' }], error: null }, { data: null, error: e2 }).db, 'r')).rejects.toBe(e2)
  })
})

describe('Texte der Foto-Fehler', () => {
  it('jede Fehlerart und jeder Foto-Code von quote hat einen Text ohne Code', () => {
    expect(Object.keys(failureText).sort()).toEqual(['denied', 'failed', 'offline', 'too_big'])
    expect(Object.keys(photoRejectedText).sort()).toEqual(['photo_expired', 'photo_missing', 'too_many_photos'])
    for (const t of [...Object.values(failureText), ...Object.values(photoRejectedText)]) expect(t).not.toMatch(/_|\d{3}/)
  })
})
