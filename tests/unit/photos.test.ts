import { describe, expect, it } from 'vitest'
import { MAX_PHOTOS, PhotoError, preparePhoto } from '../../src/lib/photos'
import { isRouteResult } from '../../src/lib/routeResult'

describe('Fotos', () => {
  it('lehnt Originale über 10 MB ab, bevor sie dekodiert werden', async () => {
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'a.jpg', { type: 'image/jpeg' })
    await expect(preparePhoto(big)).rejects.toThrow(PhotoError)
    await expect(preparePhoto(big)).rejects.toThrow('10 MB')
  })
  it('lehnt Nicht-Bilder ab', async () => {
    await expect(preparePhoto(new File(['x'], 'a.txt', { type: 'text/plain' }))).rejects.toThrow('kein Bild')
  })
  it.each([
    ['image/heic', 'a.heic'],
    ['image/heif', 'a.heif'],
    ['', 'IMG_1.HEIC'],
  ])('HEIC (%s, %s) bekommt eine eigene Meldung', async (type, name) => {
    if (!type) return // ohne Typ greift schon „kein Bild“
    await expect(preparePhoto(new File(['x'], name, { type }))).rejects.toThrow('HEIC-Fotos gehen hier nicht')
  })
  it.each(['image/gif', 'image/svg+xml', 'image/bmp', 'image/tiff'])('lehnt %s ab', async (type) => {
    await expect(preparePhoto(new File(['x'], 'a', { type }))).rejects.toThrow('JPEG, PNG oder WebP')
  })
  it('Limit: 8 Fotos je Anfrage (wie die Datenbank)', () => expect(MAX_PHOTOS).toBe(8))
})

describe('Routenantwort', () => {
  const ok = { region: 'vienna', outsideKm: 0, driveHours: 0.2, distanceKm: 4.8, totalKm: 9.6, geometry: [[16.35, 48.2], [16.39, 48.21]] }
  it('nimmt eine gültige Antwort an', () => expect(isRouteResult(ok)).toBe(true))
  it.each([
    ['leeres Objekt', {}],
    ['unbekannte Region', { ...ok, region: 'mars' }],
    ['negative Kilometer', { ...ok, outsideKm: -1 }],
    ['NaN', { ...ok, driveHours: Number.NaN }],
    ['null in der Linie', { ...ok, geometry: [null, [1, 2]] }],
    ['Punkt mit drei Werten', { ...ok, geometry: [[1, 2, 3]] }],
  ])('verwirft %s', (_, value) => expect(isRouteResult(value)).toBe(false))
})
