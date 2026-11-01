import { describe, expect, it } from 'vitest'
import type { Photo } from '../../src/lib/photos'
import { getUploads, queueUploads, removeUpload, uploadPhoto } from '../../src/lib/uploads'

type Err = { code?: string; message: string; statusCode?: string }
const photo = (size = 4): Photo => ({ id: 'a0b1c2d3-0000-4000-8000-000000000001', blob: new Blob([new Uint8Array(size)]), url: 'blob:x' })

/** Minimaler Ersatz für den Client: `insert` und `upload` liefern die vorgegebenen Fehler. */
function fakeDb(insert: Err | null, upload: Err | null) {
  const calls = { insert: [] as unknown[], upload: [] as string[] }
  const db = {
    from: () => ({
      insert: async (row: unknown) => {
        calls.insert.push(row)
        return { error: insert }
      },
    }),
    storage: {
      from: () => ({
        upload: async (path: string) => {
          calls.upload.push(path)
          return { error: upload }
        },
      }),
    },
  }
  return { db: db as never, calls }
}

describe('uploadPhoto', () => {
  it('Erfolg: Zeile mit id und request_id, dann Datei im Pfad {user}/{request}/{id}.jpg', async () => {
    const { db, calls } = fakeDb(null, null)
    expect(await uploadPhoto(db, 'u', 'r', photo())).toBeNull()
    expect(calls.insert).toEqual([{ id: photo().id, request_id: 'r' }])
    expect(calls.upload).toEqual([`u/r/${photo().id}.jpg`])
  })

  it('zu groß: kein Aufruf an den Server', async () => {
    const { db, calls } = fakeDb(null, null)
    expect(await uploadPhoto(db, 'u', 'r', photo(10 * 1024 * 1024 + 1))).toBe('too_big')
    expect(calls.insert).toEqual([])
  })

  it.each([
    ['Zeile schon da (23505)', { code: '23505', message: 'dup' }, null, null],
    ['Datei schon da (409)', null, { statusCode: '409', message: 'The resource already exists' }, null],
    ['Limit (23514)', { code: '23514', message: 'Höchstens 8 Fotos je Anfrage' }, null, 'limit'],
    ['Datei zu groß (413)', null, { statusCode: '413', message: 'The object exceeded the maximum allowed size' }, 'too_big'],
    ['Netz bei der Zeile', { message: 'TypeError: Failed to fetch' }, null, 'offline'],
    ['Netz bei der Datei', null, { message: 'Failed to fetch' }, 'offline'],
    ['anderer Fehler bei der Zeile', { code: '42501', message: 'rls' }, null, 'failed'],
    ['anderer Fehler bei der Datei', null, { statusCode: '500', message: 'boom' }, 'failed'],
  ])('%s', async (_, insert, upload, expected) => {
    const { db, calls } = fakeDb(insert, upload)
    expect(await uploadPhoto(db, 'u', 'r', photo())).toBe(expected)
    if (expected === 'limit' || expected === 'offline' || expected === 'failed') {
      if (insert) expect(calls.upload).toEqual([]) // ohne Zeile keine Datei
    }
  })
})

describe('Warteschlange', () => {
  const settled = async (request: string, status: string) => {
    for (let i = 0; i < 50 && getUploads(request).some((e) => e.status !== status); i++) await new Promise((r) => setTimeout(r, 10))
  }
  const queueDb = (rowDelete: { message: string } | null) => {
    const removed: string[][] = []
    const db = {
      from: () => ({ insert: async () => ({ error: null }), delete: () => ({ eq: async () => ({ error: rowDelete }) }) }),
      storage: { from: () => ({ upload: async () => ({ error: null }), remove: async (paths: string[]) => (removed.push(paths), { error: null }) }) },
    }
    return { db: db as never, removed }
  }

  it('lädt nacheinander hoch; Entfernen bei Serverfehler lässt das Foto stehen und meldet es, danach klappt es', async () => {
    const failing = queueDb({ message: 'offline' })
    queueUploads(failing.db, 'u', 'req-1', [photo()])
    await settled('req-1', 'done')
    expect(getUploads('req-1').map((e) => e.status)).toEqual(['done'])
    await removeUpload('req-1', photo().id)
    expect(getUploads('req-1')[0]).toMatchObject({ status: 'error', failure: 'remove_failed' })
    expect(failing.removed).toEqual([]) // Datei bleibt, solange die Zeile bleibt

    const working = queueDb(null)
    queueUploads(working.db, 'u', 'req-2', [photo()])
    await settled('req-2', 'done')
    await removeUpload('req-2', photo().id)
    expect(getUploads('req-2')).toEqual([])
    expect(working.removed).toEqual([[`u/req-2/${photo().id}.jpg`]])
  })
})
