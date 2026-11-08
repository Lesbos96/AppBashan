// Bildverarbeitung für Foto-Kopien und Belege (S9d, Konzept 7). Reine Funktion ohne Netz- und DB-Zugriff: JPEG rein, neu kodiertes JPEG raus.
// Neu kodieren ist der Metadatenschutz: Es gelangt nur der Pixelinhalt in die Ausgabe; die Segmente APP1 bis APP15 und Kommentare, die der
// Encoder selbst schreibt (EXIF mit Zeitstempel), werden danach entfernt. Gain-Maps schreibt der Encoder mit `gainMap: false` nicht.
// Die Pixelgrenze gilt vor dem Dekodieren (SOF-Header), damit eine Dekompressionsbombe nie Speicher bekommt.
import { Image } from 'npm:imagescript@3.17.0'

/** Feste Fehlercodes; sie landen in `job_photos.error_code` (CHECK in Migration 0035) und nie mit Details im Log. */
export type PhotoErrorCode = 'not_jpeg' | 'too_large' | 'dimensions' | 'unsupported' | 'decode_failed' | 'encode_failed'

export class PhotoError extends Error {
  constructor(readonly code: PhotoErrorCode) {
    super(code)
  }
}

export const MAX_INPUT_BYTES = 10 * 1024 * 1024
export const MAX_EDGE = 2048
export const MAX_PIXELS = 4_200_000
/** Lange Kante der Kopie. */
export const OUTPUT_EDGE = 1600
/** Grenze des Buckets `job-photos` (4 MiB); größere Ausgaben würden beim Upload scheitern. */
export const MAX_OUTPUT_BYTES = 4 * 1024 * 1024
const QUALITY = 88

export type Processed = { bytes: Uint8Array<ArrayBuffer>; sha256: string; width: number; height: number }

// SOF-Marker, die wir lesen: baseline (C0), extended sequential (C1), progressive (C2). Alles andere mit Bildkopf ist verlustfrei, differenziell
// oder arithmetisch kodiert und wird nicht verarbeitet.
const SOF_OK = new Set([0xc0, 0xc1, 0xc2])
const SOF_OTHER = new Set([0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

/**
 * Liest Breite und Höhe aus dem SOF-Segment, ohne Pixel zu dekodieren. Läuft über die ganze Segmentfolge bis EOI (Entropie-Daten werden
 * übersprungen, Segmente wie ein EXIF-Vorschaubild nach ihrer Länge): ein zweiter Bildkopf, der den Dekoder auf andere Maße lenken könnte,
 * wird abgewiesen (`unsupported`).
 */
export function readSof(b: Uint8Array): { width: number; height: number } {
  let found: { width: number; height: number } | null = null
  let i = 2
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) throw new PhotoError('decode_failed')
    let m = b[i + 1]!
    i += 2
    while (m === 0xff && i < b.length) m = b[i++]! // Füllbytes
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) continue // Marker ohne Länge
    if (m === 0xd9) break
    if (i + 2 > b.length) throw new PhotoError('decode_failed')
    const len = (b[i]! << 8) | b[i + 1]!
    if (len < 2 || i + len > b.length) throw new PhotoError('decode_failed')
    if (SOF_OTHER.has(m)) throw new PhotoError('unsupported')
    if (SOF_OK.has(m)) {
      if (found) throw new PhotoError('unsupported')
      if (len < 8) throw new PhotoError('decode_failed')
      const precision = b[i + 2]!
      const height = (b[i + 3]! << 8) | b[i + 4]!
      const width = (b[i + 5]! << 8) | b[i + 6]!
      const components = b[i + 7]!
      if (precision !== 8 || (components !== 1 && components !== 3)) throw new PhotoError('unsupported')
      found = { width, height }
    }
    if (m === 0xda && !found) throw new PhotoError('decode_failed') // Scan vor dem Bildkopf
    i += len
    if (m === 0xda) {
      // Entropie-Daten bis zum nächsten Marker überspringen (0xFF 0x00 ist gestopft, RSTn und Füllbytes gehören dazu)
      while (i + 1 < b.length && !(b[i] === 0xff && b[i + 1] !== 0 && b[i + 1] !== 0xff && !(b[i + 1]! >= 0xd0 && b[i + 1]! <= 0xd7))) i++
    }
  }
  if (!found) throw new PhotoError('decode_failed')
  return found
}

/** Entfernt APP1 bis APP15 und Kommentare aus der Encoder-Ausgabe (der Encoder schreibt von sich aus ein EXIF mit Zeitstempel und Softwarename). */
export function stripMetadata(b: Uint8Array): Uint8Array<ArrayBuffer> {
  const parts: Uint8Array[] = [b.subarray(0, 2)]
  let i = 2
  while (i + 4 <= b.length && b[i] === 0xff) {
    const m = b[i + 1]!
    if (m === 0xda) break
    const end = i + 2 + ((b[i + 2]! << 8) | b[i + 3]!)
    if (end > b.length) throw new PhotoError('encode_failed')
    if (!((m >= 0xe1 && m <= 0xef) || m === 0xfe)) parts.push(b.subarray(i, end))
    i = end
  }
  parts.push(b.subarray(i))
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

const dimensionsOk = (w: number, h: number) => w > 0 && h > 0 && Math.max(w, h) <= MAX_EDGE && w * h <= MAX_PIXELS

const hex = (d: ArrayBuffer) => Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, '0')).join('')

/** Prüft, dekodiert (Orientierung wird angewendet) und kodiert ohne Metadaten neu. Wirft `PhotoError` mit festem Code. */
export async function processPhoto(input: Uint8Array): Promise<Processed> {
  if (input.length > MAX_INPUT_BYTES) throw new PhotoError('too_large')
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8 || input[2] !== 0xff) throw new PhotoError('not_jpeg')
  const head = readSof(input)
  if (!dimensionsOk(head.width, head.height)) throw new PhotoError('dimensions')

  let image: Image
  try {
    image = await Image.decode(input)
  } catch {
    throw new PhotoError('decode_failed')
  }
  if (!dimensionsOk(image.width, image.height)) throw new PhotoError('dimensions')

  let bytes: Uint8Array<ArrayBuffer>
  try {
    // Konzept 7.1: lange Kante höchstens 1600 px (spart Speicher und Übertragung; die App sendet bis 2000 px)
    if (Math.max(image.width, image.height) > OUTPUT_EDGE) {
      image = image.width >= image.height ? image.resize(OUTPUT_EDGE, Image.RESIZE_AUTO) : image.resize(Image.RESIZE_AUTO, OUTPUT_EDGE)
    }
    bytes = stripMetadata(await image.encodeJPEG({ quality: QUALITY, gainMap: false }))
  } catch {
    throw new PhotoError('encode_failed')
  }
  if (bytes.length > MAX_OUTPUT_BYTES) throw new PhotoError('too_large')
  return { bytes, sha256: hex(await crypto.subtle.digest('SHA-256', bytes)), width: image.width, height: image.height }
}
