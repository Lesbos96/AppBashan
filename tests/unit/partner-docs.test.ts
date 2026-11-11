import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDocument, DocError, docErrorText, loadDocuments, MAX_DOC_BYTES, MAX_DOCS, prepareDocument, uploadDocument } from '../../src/lib/partnerDocs'

const calls: { table?: string; op?: string; args?: unknown[] }[] = []
const db = {
  select: vi.fn(),
  insert: vi.fn(),
  list: vi.fn(),
  upload: vi.fn(),
}
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: (...a: unknown[]) => {
        calls.push({ table, op: 'select', args: a })
        const chain = { eq: () => chain, order: () => db.select(), then: undefined as unknown }
        return chain
      },
      insert: (...a: unknown[]) => {
        calls.push({ table, op: 'insert', args: a })
        return { select: (...s: unknown[]) => (calls.push({ table, op: 'insert.select', args: s }), db.insert(...a)) }
      },
    }),
    storage: {
      from: (bucket: string) => ({
        list: (...a: unknown[]) => db.list(bucket, ...a),
        upload: (...a: unknown[]) => db.upload(bucket, ...a),
      }),
    },
  },
}))

const pg = (code: string, message: string) => ({ data: null, error: { code, message } })
const storageErr = (statusCode: string, message = 'x') => ({ data: null, error: Object.assign(new Error(message), { statusCode, status: Number(statusCode) }) })

beforeEach(() => {
  calls.length = 0
  Object.values(db).forEach((f) => f.mockReset())
})

describe('prepareDocument', () => {
  const file = (bytes: BlobPart, name: string, type: string) => new File([bytes], name, { type })

  it('PDF: nur mit Typ application/pdf (oder leerem Typ und .pdf) und Kopfzeile %PDF-', async () => {
    const ok = await prepareDocument(file('%PDF-1.7 rest', 'gewerbe.pdf', 'application/pdf'))
    expect(ok.contentType).toBe('application/pdf')
    expect(ok.blob.size).toBe(13)
    await expect(prepareDocument(file('%PDF-1.4', 'scan.pdf', ''))).resolves.toMatchObject({ contentType: 'application/pdf' })
    await expect(prepareDocument(file('kein pdf', 'x.pdf', 'application/pdf'))).rejects.toMatchObject({ kind: 'bad_type' })
  })

  it('zu groß: über 10 MB wird abgelehnt, genau 10 MB nicht', async () => {
    expect(MAX_DOC_BYTES).toBe(10 * 1024 * 1024)
    const head = new TextEncoder().encode('%PDF-')
    const big = new Uint8Array(MAX_DOC_BYTES + 1)
    big.set(head)
    await expect(prepareDocument(file(big, 'a.pdf', 'application/pdf'))).rejects.toMatchObject({ kind: 'too_big' })
    await expect(prepareDocument(file(big.slice(0, MAX_DOC_BYTES), 'a.pdf', 'application/pdf'))).resolves.toBeDefined()
  })

  it('zu große Bilder werden vor der Neu-Kodierung abgelehnt (nicht erst am Text der Bildprüfung erkannt)', async () => {
    await expect(prepareDocument(file(new Uint8Array(MAX_DOC_BYTES + 1), 'foto.png', 'image/png'))).rejects.toMatchObject({ kind: 'too_big' })
  })

  it('andere Typen werden abgelehnt (HEIC, Word, Text, unbekannt)', async () => {
    for (const [n, t] of [['a.heic', 'image/heic'], ['a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ['a.txt', 'text/plain'], ['a', '']] as const) {
      await expect(prepareDocument(file('x', n, t))).rejects.toMatchObject({ kind: 'bad_type' })
    }
  })
})

describe('createDocument', () => {
  it('sendet nur id und kind und liest nur die id zurück (storage_path hat kein Spaltenrecht)', async () => {
    db.insert.mockResolvedValue({ data: [{ id: 'ignored' }], error: null })
    const id = await createDocument('trade_license')
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    const ins = calls.find((c) => c.op === 'insert')!
    expect(ins.args).toEqual([{ id, kind: 'trade_license' }])
    expect(calls.find((c) => c.op === 'insert.select')?.args).toEqual(['id'])
  })

  it.each([
    [pg('P0001', 'limit_reached'), 'limit_reached'],
    [pg('P0001', 'partner_not_active'), 'not_active'],
    [pg('P0001', 'slot_taken'), 'unavailable'],
    [pg('42501', 'not_partner_member'), 'denied'],
    [pg('42501', 'permission denied for table partner_documents'), 'denied'],
    [pg('23514', 'check'), 'unavailable'],
  ])('Fehler %# wird %s', async (answer, kind) => {
    db.insert.mockResolvedValue(answer)
    await expect(createDocument('other')).rejects.toMatchObject({ kind })
  })

  it('Netzfehler ist offline', async () => {
    db.insert.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(createDocument('other')).rejects.toMatchObject({ kind: 'offline' })
  })
})

describe('uploadDocument', () => {
  const blob = new Blob(['%PDF-'], { type: 'application/pdf' })

  it('lädt auf {firma}/{id} im Bucket partner-documents, ohne upsert', async () => {
    db.upload.mockResolvedValue({ data: { path: 'x' }, error: null })
    await uploadDocument('p-1', 'd-1', blob, 'application/pdf')
    expect(db.upload).toHaveBeenCalledWith('partner-documents', 'p-1/d-1', blob, { contentType: 'application/pdf', upsert: false })
  })

  it.each([
    ['413', 'too_big'],
    ['415', 'bad_type'],
    ['403', 'denied'],
    ['409', 'exists'],
    ['500', 'unavailable'],
  ])('Storage-Status %s wird %s', async (status, kind) => {
    db.upload.mockResolvedValue(storageErr(status))
    await expect(uploadDocument('p-1', 'd-1', blob, 'application/pdf')).rejects.toMatchObject({ kind })
  })

  it('Netzfehler ist offline', async () => {
    db.upload.mockResolvedValue({ data: null, error: Object.assign(new Error('Failed to fetch'), { name: 'StorageUnknownError', originalError: new TypeError('Failed to fetch') }) })
    await expect(uploadDocument('p-1', 'd-1', blob, 'application/pdf')).rejects.toMatchObject({ kind: 'offline' })
  })
})

describe('loadDocuments', () => {
  it('verbindet Zeilen mit den Dateien im Bucket: fehlt der Pfad, ist hasFile falsch', async () => {
    db.select.mockResolvedValue({
      data: [
        { id: 'd-1', partner_id: 'p-1', kind: 'trade_license', uploaded_at: '2026-11-01T10:00:00Z' },
        { id: 'd-2', partner_id: 'p-1', kind: 'other', uploaded_at: '2026-11-02T10:00:00Z' },
      ],
      error: null,
    })
    db.list.mockResolvedValue({ data: [{ name: 'd-1' }], error: null })
    const docs = await loadDocuments('p-1')
    expect(docs.map((d) => [d.id, d.hasFile])).toEqual([['d-1', true], ['d-2', false]])
    expect(db.list).toHaveBeenCalledWith('partner-documents', 'p-1', expect.objectContaining({ limit: MAX_DOCS + 5 }))
    expect(calls.find((c) => c.op === 'select')?.args).toEqual(['id, partner_id, kind, uploaded_at'])
  })

  it('Fehler beim Lesen wird geworfen (nie still „keine Dokumente“)', async () => {
    db.select.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'boom' } })
    db.list.mockResolvedValue({ data: [], error: null })
    await expect(loadDocuments('p-1')).rejects.toBeDefined()
    db.select.mockResolvedValue({ data: [], error: null })
    db.list.mockResolvedValue({ data: null, error: new Error('boom') })
    await expect(loadDocuments('p-1')).rejects.toBeDefined()
  })
})

describe('Texte', () => {
  it('jede Fehlerart hat einen Text ohne Rohtext und Gebührenhinweis', () => {
    expect(new DocError('bad_type').kind).toBe('bad_type')
    for (const text of Object.values(docErrorText)) {
      expect(text.length).toBeGreaterThan(10)
      expect(text).not.toMatch(/RAW_SUPABASE|Gebühr|Provision|15 ?%/)
    }
  })
})
