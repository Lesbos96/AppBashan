import { beforeEach, describe, expect, it } from 'vitest'
import type { Photo } from '../../src/lib/photos'
import { discardStaging, forgetStaging, uploadAll } from '../../src/lib/uploads'

type Err = { message: string; statusCode?: string }
const photo = (id: string, size = 4): Photo => ({ id, blob: new Blob([new Uint8Array(size)]), url: 'blob:x' })
const P1 = 'a0b1c2d3-0000-4000-8000-000000000001'
const P2 = 'a0b1c2d3-0000-4000-8000-000000000002'
const none = () => undefined

/** Minimaler Ersatz für den Client: `upload` liefert die vorgegebenen Fehler der Reihe nach, `remove` zeichnet die Pfade auf, `log` hält die Reihenfolge. */
function fakeDb(...errors: (Err | null)[]) {
  const calls = { upload: [] as { path: string; upsert: unknown }[], remove: [] as string[][], log: [] as string[] }
  const db = {
    storage: {
      from: () => ({
        upload: async (path: string, _blob: Blob, options: { upsert: boolean }) => {
          calls.upload.push({ path, upsert: options.upsert })
          calls.log.push(`upload:${path}`)
          return { error: errors[calls.upload.length - 1] ?? null }
        },
        remove: async (paths: string[]) => (calls.remove.push(paths), calls.log.push(`remove:${paths.join(',')}`), { error: null }),
      }),
    },
  }
  return { db: db as never, calls }
}

beforeEach(() => forgetStaging())

describe('uploadAll: ein Foto', () => {
  const one = (db: never, ref: string, p: Photo) => uploadAll(db, 'u', ref, [p], none)

  it('Erfolg: Staging-Pfad {user}/{clientRef}/{id}.jpg, ohne Upsert, keine Zeile in der Datenbank', async () => {
    const { db, calls } = fakeDb()
    expect(await one(db, 'ref-ok', photo(P1))).toBeNull()
    expect(calls.upload).toEqual([{ path: `u/ref-ok/${P1}.jpg`, upsert: false }])
  })

  it('zu groß: kein Aufruf an den Server', async () => {
    const { db, calls } = fakeDb()
    expect(await one(db, 'ref-big', photo(P1, 10 * 1024 * 1024 + 1))).toBe('too_big')
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
    expect(await one(db, `ref-${name}`, photo(P1))).toBe(expected)
  })
})

describe('uploadAll', () => {
  it('lädt nacheinander hoch und meldet den Fortschritt; der erste Fehler bricht ab', async () => {
    const ok = fakeDb()
    const seen: number[] = []
    expect(await uploadAll(ok.db, 'u', 'ref-all', [photo(P1), photo(P2)], (n) => seen.push(n))).toBeNull()
    expect(seen).toEqual([1, 2])

    const failing = fakeDb({ statusCode: '500', message: 'boom' })
    expect(await uploadAll(failing.db, 'u', 'ref-fail', [photo(P1), photo(P2)], none)).toBe('failed')
    expect(failing.calls.upload).toHaveLength(1)
  })
})

describe('Staging-Stand (M-2)', () => {
  it('Ref-Wechsel im selben Konto: erst die Dateien der alten Ref entfernen, dann hochladen', async () => {
    const { db, calls } = fakeDb()
    await uploadAll(db, 'u', 'ref-1', [photo(P1), photo(P2)], none)
    await uploadAll(db, 'u', 'ref-2', [photo(P2)], none)
    expect(calls.log).toEqual([`upload:u/ref-1/${P1}.jpg`, `upload:u/ref-1/${P2}.jpg`, `remove:u/ref-1/${P1}.jpg,u/ref-1/${P2}.jpg`, `upload:u/ref-2/${P2}.jpg`])
  })

  it('gleiche Ref: nichts entfernt, nichts doppelt', async () => {
    const { db, calls } = fakeDb()
    await uploadAll(db, 'u', 'ref-1', [photo(P1)], none)
    await uploadAll(db, 'u', 'ref-1', [photo(P1), photo(P2)], none)
    expect(calls.log).toEqual([`upload:u/ref-1/${P1}.jpg`, `upload:u/ref-1/${P2}.jpg`])
  })

  it('Kontowechsel: alte Dateien nicht mit der neuen Sitzung löschen', async () => {
    const { db, calls } = fakeDb()
    await uploadAll(db, 'u1', 'ref-1', [photo(P1)], none)
    await uploadAll(db, 'u2', 'ref-1', [photo(P1)], none)
    expect(calls.remove).toEqual([])
    expect(calls.upload.map((c) => c.path)).toEqual([`u1/ref-1/${P1}.jpg`, `u2/ref-1/${P1}.jpg`])
  })

  it('nach dem Absenden (forgetStaging): der nächste Entwurf entfernt nichts', async () => {
    const { db, calls } = fakeDb()
    await uploadAll(db, 'u', 'ref-1', [photo(P1)], none)
    forgetStaging()
    await uploadAll(db, 'u', 'ref-2', [photo(P2)], none)
    expect(calls.remove).toEqual([])
  })

  it('discardStaging entfernt den aktuellen Stand; danach wird dasselbe Foto neu hochgeladen', async () => {
    const { db, calls } = fakeDb()
    await uploadAll(db, 'u', 'ref-1', [photo(P1)], none)
    await discardStaging(db)
    expect(calls.remove).toEqual([[`u/ref-1/${P1}.jpg`]])
    await uploadAll(db, 'u', 'ref-1', [photo(P1)], none)
    expect(calls.upload).toHaveLength(2)
  })
})
