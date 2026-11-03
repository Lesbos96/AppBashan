import { describe, expect, it } from 'vitest'
import type { Photo } from '../../src/lib/photos'
import { discardStaging, uploadAll, uploadPhoto } from '../../src/lib/uploads'

type Err = { message: string; statusCode?: string }
const photo = (id: string, size = 4): Photo => ({ id, blob: new Blob([new Uint8Array(size)]), url: 'blob:x' })
const P1 = 'a0b1c2d3-0000-4000-8000-000000000001'
const P2 = 'a0b1c2d3-0000-4000-8000-000000000002'

/** Minimaler Ersatz für den Client: `upload` liefert die vorgegebenen Fehler der Reihe nach, `remove` zeichnet die Pfade auf. */
function fakeDb(...errors: (Err | null)[]) {
  const calls = { upload: [] as { path: string; upsert: unknown }[], remove: [] as string[][] }
  const db = {
    storage: {
      from: () => ({
        upload: async (path: string, _blob: Blob, options: { upsert: boolean }) => {
          calls.upload.push({ path, upsert: options.upsert })
          return { error: errors[calls.upload.length - 1] ?? null }
        },
        remove: async (paths: string[]) => (calls.remove.push(paths), { error: null }),
      }),
    },
  }
  return { db: db as never, calls }
}

describe('uploadPhoto', () => {
  it('Erfolg: Staging-Pfad {user}/{clientRef}/{id}.jpg, ohne Upsert, keine Zeile in der Datenbank', async () => {
    const { db, calls } = fakeDb()
    expect(await uploadPhoto(db, 'u', 'ref-ok', photo(P1))).toBeNull()
    expect(calls.upload).toEqual([{ path: `u/ref-ok/${P1}.jpg`, upsert: false }])
  })

  it('zu groß: kein Aufruf an den Server', async () => {
    const { db, calls } = fakeDb()
    expect(await uploadPhoto(db, 'u', 'ref-big', photo(P1, 10 * 1024 * 1024 + 1))).toBe('too_big')
    expect(calls.upload).toEqual([])
  })

  it.each([
    ['Datei schon da (409)', { statusCode: '409', message: 'The resource already exists' }, null],
    ['Datei zu groß (413)', { statusCode: '413', message: 'The object exceeded the maximum allowed size' }, 'too_big'],
    ['Kontingent oder Policy (403)', { statusCode: '403', message: 'new row violates row-level security policy' }, 'denied'],
    ['Netz', { message: 'Failed to fetch' }, 'offline'],
    ['anderer Fehler', { statusCode: '500', message: 'boom' }, 'failed'],
  ])('%s', async (name, error, expected) => {
    const { db } = fakeDb(error)
    expect(await uploadPhoto(db, 'u', `ref-${name}`, photo(P1))).toBe(expected)
  })

  it('ein Foto, das liegt, wird beim erneuten Senden nicht noch einmal hochgeladen', async () => {
    const { db, calls } = fakeDb()
    await uploadPhoto(db, 'u', 'ref-twice', photo(P1))
    await uploadPhoto(db, 'u', 'ref-twice', photo(P1))
    expect(calls.upload).toHaveLength(1)
  })
})

describe('uploadAll', () => {
  it('lädt nacheinander hoch und meldet den Fortschritt; der erste Fehler bricht ab', async () => {
    const ok = fakeDb()
    const seen: number[] = []
    expect(await uploadAll(ok.db, 'u', 'ref-all', [photo(P1), photo(P2)], (n) => seen.push(n))).toBeNull()
    expect(seen).toEqual([1, 2])

    const failing = fakeDb({ statusCode: '500', message: 'boom' })
    expect(await uploadAll(failing.db, 'u', 'ref-fail', [photo(P1), photo(P2)], () => undefined)).toBe('failed')
    expect(failing.calls.upload).toHaveLength(1)
  })
})

describe('discardStaging', () => {
  it('löscht die Staging-Dateien; danach wird dasselbe Foto wieder hochgeladen', async () => {
    const { db, calls } = fakeDb()
    await uploadPhoto(db, 'u', 'ref-discard', photo(P1))
    await discardStaging(db, 'u', 'ref-discard', [photo(P1)])
    expect(calls.remove).toEqual([[`u/ref-discard/${P1}.jpg`]])
    await uploadPhoto(db, 'u', 'ref-discard', photo(P1))
    expect(calls.upload).toHaveLength(2)
  })
})
