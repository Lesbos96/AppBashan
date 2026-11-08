// Bildverarbeitung der Foto-Pipeline (S9d): kein EXIF/GPS/XMP in der Ausgabe, Orientierung angewendet, Pixelgrenzen vor dem Dekodieren, feste Fehlercodes.
import { createHash } from 'node:crypto'
import { Image } from 'imagescript'
import { describe, expect, it } from 'vitest'
import { MAX_INPUT_BYTES, PhotoError, processPhoto, readSof } from '../../supabase/functions/_shared/photo/process.ts'

const SECRET = 'GPSLatitudeGEHEIM48.2082'

async function jpeg(w: number, h: number): Promise<Uint8Array> {
  const img = new Image(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img.setPixelAt(x, y,Image.rgbToColor((x * 7) % 256, (y * 11) % 256, 128))
  return img.encodeJPEG({ quality: 80 })
}

/** Fügt direkt nach SOI ein APP-Segment ein. */
function withSegment(src: Uint8Array, marker: number, payload: Uint8Array): Uint8Array {
  const len = payload.length + 2
  const seg = new Uint8Array([0xff, marker, len >> 8, len & 255, ...payload])
  return new Uint8Array([...src.subarray(0, 2), ...seg, ...src.subarray(2)])
}

const ascii = (s: string) => new TextEncoder().encode(s)

/** EXIF mit Orientation-Tag und einem Text, der GPS vortäuscht. */
function exif(orientation: number): Uint8Array {
  // TIFF little endian, IFD0 mit einem Eintrag: Tag 0x0112 (Orientation), Typ SHORT
  const tiff = [0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, orientation, 0, 0, 0, 0, 0, 0, 0]
  return new Uint8Array([...ascii('Exif\0\0'), ...tiff, ...ascii(SECRET)])
}

/** Alle Marker bis zum Scan (SOS), ohne Länge der Daten dahinter. */
function markers(b: Uint8Array): number[] {
  const out: number[] = []
  let i = 2
  while (i + 4 <= b.length && b[i] === 0xff) {
    const m = b[i + 1]!
    out.push(m)
    if (m === 0xda) break
    i += 2 + ((b[i + 2]! << 8) | b[i + 3]!)
  }
  return out
}

const contains = (b: Uint8Array, s: string) => Buffer.from(b).includes(s)
const code = async (p: Promise<unknown>) => ((await p.then(() => null, (e: unknown) => e)) as PhotoError | null)?.code

/** Setzt die SOF-Maße (Höhe, Breite) im Kopf, ohne die Pixeldaten anzufassen. */
function patchSof(src: Uint8Array, w: number, h: number, marker?: number, components?: number): Uint8Array {
  const b = new Uint8Array(src)
  let i = 2
  for (;;) {
    const m = b[i + 1]!
    if (m >= 0xc0 && m <= 0xc2) {
      if (marker) b[i + 1] = marker
      b[i + 5] = h >> 8
      b[i + 6] = h & 255
      b[i + 7] = w >> 8
      b[i + 8] = w & 255
      if (components) b[i + 9] = components
      return b
    }
    i += 2 + ((b[i + 2]! << 8) | b[i + 3]!)
  }
}

describe('processPhoto', () => {
  it('entfernt EXIF, GPS und alle Zusatzsegmente und liefert ein gültiges JPEG mit passendem SHA-256', async () => {
    const dirty = withSegment(withSegment(await jpeg(64, 48), 0xe1, exif(1)), 0xe1, ascii(`http://ns.adobe.com/xap/1.0/\0${SECRET}`))
    expect(contains(dirty, SECRET)).toBe(true)
    const out = await processPhoto(dirty)
    expect(contains(out.bytes, SECRET)).toBe(false)
    expect(contains(out.bytes, 'Exif')).toBe(false)
    expect(contains(out.bytes, 'GPS')).toBe(false)
    expect(contains(out.bytes, 'adobe')).toBe(false)
    expect(markers(out.bytes).filter((m) => m >= 0xe1 && m <= 0xef)).toEqual([]) // höchstens APP0 (JFIF), keine APP1 bis APP15
    expect(Array.from(out.bytes.subarray(0, 3))).toEqual([0xff, 0xd8, 0xff])
    expect(out.sha256).toBe(createHash('sha256').update(out.bytes).digest('hex'))
    expect([out.width, out.height]).toEqual([64, 48])
    expect(readSof(out.bytes)).toEqual({ width: 64, height: 48 })
  })

  it('wendet die Orientierung an (Orientation 6 dreht ein Querformat ins Hochformat)', async () => {
    const out = await processPhoto(withSegment(await jpeg(40, 20), 0xe1, exif(6)))
    expect(readSof(out.bytes)).toEqual({ width: 20, height: 40 })
    expect(contains(out.bytes, 'Exif')).toBe(false)
  })

  it('feste Fehlercodes: kein JPEG, zu groß, kaputt, ohne Bildkopf', async () => {
    expect(await code(processPhoto(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])))).toBe('not_jpeg')
    expect(await code(processPhoto(new Uint8Array(0)))).toBe('not_jpeg')
    const big = new Uint8Array(MAX_INPUT_BYTES + 1)
    big.set([0xff, 0xd8, 0xff])
    expect(await code(processPhoto(big))).toBe('too_large')
    expect(await code(processPhoto(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02])))).toBe('decode_failed')
    const noSof = withSegment(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 0xe1, ascii('x'))
    expect(await code(processPhoto(noSof))).toBe('decode_failed')
  })

  it('abgeschnittenes JPEG: entweder fester Fehlercode oder ein gültiges Bild ohne Metadaten, nie eine andere Ausnahme', async () => {
    const whole = withSegment(await jpeg(64, 48), 0xe1, exif(1))
    const cut = whole.subarray(0, Math.floor(whole.length * 0.6))
    const r = await processPhoto(cut).then(
      (p) => p,
      (e: unknown) => e,
    )
    if (r instanceof PhotoError) expect(['decode_failed', 'encode_failed']).toContain(r.code)
    else {
      expect(contains((r as { bytes: Uint8Array }).bytes, SECRET)).toBe(false)
    }
  })

  it('Pixelgrenzen kommen aus dem SOF-Kopf, vor dem Dekodieren: Kante 2048, höchstens 4,2 MP', async () => {
    const base = await jpeg(32, 32)
    expect(await code(processPhoto(patchSof(base, 2049, 100)))).toBe('dimensions')
    expect(await code(processPhoto(patchSof(base, 100, 2049)))).toBe('dimensions')
    expect(await code(processPhoto(patchSof(base, 2048, 2052)))).toBe('dimensions') // 4.202.496 > 4.200.000
    expect(await code(processPhoto(patchSof(base, 0, 100)))).toBe('dimensions')
    expect(await code(processPhoto(patchSof(base, 65535, 65535)))).toBe('dimensions')
    // 2048 × 2048 = 4.194.304 passiert den Kopf; erst das Dekodieren (echte Pixel 32 × 32) entscheidet, hier gelingt es
    expect(await code(processPhoto(patchSof(base, 2048, 2048)))).not.toBe('dimensions')
  })

  it('verkleinert auf eine lange Kante von höchstens 1600 px (Quer- und Hochformat), kleinere Bilder bleiben unverändert', async () => {
    const solid = async (w: number, h: number) => new Image(w, h).fill(Image.rgbToColor(200, 120, 40)).encodeJPEG({ quality: 80 })
    expect(readSof((await processPhoto(await solid(2000, 1000))).bytes)).toEqual({ width: 1600, height: 800 })
    expect(readSof((await processPhoto(await solid(1000, 2000))).bytes)).toEqual({ width: 800, height: 1600 })
    expect(readSof((await processPhoto(await solid(1600, 1200))).bytes)).toEqual({ width: 1600, height: 1200 })
    expect(readSof((await processPhoto(await solid(640, 480))).bytes)).toEqual({ width: 640, height: 480 })
  })

  it('ein zweiter Bildkopf wird abgewiesen, ein EXIF-Vorschaubild mit eigenem Bildkopf nicht', async () => {
    const base = await jpeg(32, 32)
    // zweites SOF direkt hinter dem ersten
    let i = 2
    while (!(base[i + 1]! >= 0xc0 && base[i + 1]! <= 0xc2)) i += 2 + ((base[i + 2]! << 8) | base[i + 3]!)
    const sofEnd = i + 2 + ((base[i + 2]! << 8) | base[i + 3]!)
    const twice = new Uint8Array([...base.subarray(0, sofEnd), ...base.subarray(i, sofEnd), ...base.subarray(sofEnd)])
    expect(await code(processPhoto(twice))).toBe('unsupported')
    // Vorschaubild in APP1 (Länge höchstens 65533): ein kleines JPEG mit eigenem SOF liegt im Segment und zählt nicht
    const thumb = await jpeg(8, 8)
    const withThumb = withSegment(base, 0xe1, new Uint8Array([...ascii('Exif\0\0'), ...thumb]))
    expect(readSof(withThumb)).toEqual({ width: 32, height: 32 })
    expect((await processPhoto(withThumb)).width).toBe(32)
  })

  it('nur SOF0, SOF1 und SOF2 mit 8 Bit und 1 oder 3 Komponenten; sonst unsupported', async () => {
    const base = await jpeg(32, 32)
    for (const m of [0xc3, 0xc5, 0xc9, 0xcf]) expect(await code(processPhoto(patchSof(base, 32, 32, m))), `SOF${m - 0xc0}`).toBe('unsupported')
    expect(await code(processPhoto(patchSof(base, 32, 32, undefined, 4)))).toBe('unsupported') // CMYK
    expect(readSof(patchSof(base, 32, 32, 0xc1))).toEqual({ width: 32, height: 32 })
    expect(readSof(patchSof(base, 32, 32, 0xc2))).toEqual({ width: 32, height: 32 })
  })
})
