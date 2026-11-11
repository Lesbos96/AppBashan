import { crc32, deflateSync } from 'node:zlib'
import type { Page, Route } from '@playwright/test'
import * as OTPAuth from 'otpauth'
import { expect } from '@playwright/test'
import { makeSession } from './auth-helpers'
import { cors, rest } from './backend'

/*
 * Gemockte Auth-MFA-API (GoTrue) und Dokumente (PostgREST + Storage) für Partner-Portal 1b (s9i-5b).
 * Das Verhalten folgt den Proben gegen das Dev-Projekt (tmp/proof/s9i-5b-plan.md): gleicher Name bei unverifiziertem Faktor = 422
 * `mfa_factor_name_conflict`; `enroll`/`unenroll` eines verifizierten Faktors ohne aal2 = `insufficient_aal`; falscher Code = 422
 * `mfa_verification_failed`. Der Mock prüft den Code wirklich (otpauth, Fenster ±1), es gibt keinen festen Code.
 */

export type Factor = { id: string; status: 'verified' | 'unverified'; name: string; secret: string }
export type MfaState = {
  factors: Factor[]
  aal: 'aal1' | 'aal2'
  /** Reihenfolge der Aufrufe: `enroll`, `unenroll:<id>`, `challenge:<id>`, `verify:<id>:ok|fail` */
  log: string[]
  /** Antwort-Status des nächsten `verify` (Warteschlange), z. B. 429 */
  verifyStatus: number[]
  lastSecret: string
}

const SECRET = () => new OTPAuth.Secret({ size: 20 }).base32
export const factor = (id: string, status: Factor['status'], name = 'MoveNow'): Factor => ({ id, status, name, secret: SECRET() })
export const pub = (f: Factor) => ({ id: f.id, status: f.status, factor_type: 'totp', friendly_name: f.name, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' })
const gone = (r: Route, status: number, error_code: string) => r.fulfill({ status, headers: cors, json: { code: status, error_code, msg: 'RAW_SUPABASE_TEXT' } })

/** Rechnet den Code des Mocks; wartet, wenn weniger als 6 s im 30-s-Fenster bleiben. */
export async function freshCode(secret: string): Promise<string> {
  const left = 30 - (Math.floor(Date.now() / 1000) % 30)
  if (left < 6) await new Promise((r) => setTimeout(r, (left + 1) * 1000))
  return new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate()
}

export async function mockMfa(page: Page, init: { factors?: Factor[]; aal?: 'aal1' | 'aal2' } = {}): Promise<MfaState> {
  const s: MfaState = { factors: init.factors ?? [], aal: init.aal ?? 'aal1', log: [], verifyStatus: [], lastSecret: '' }
  const user = () => makeSession(s.aal, s.factors.map(pub)).user
  await page.route('**/auth/v1/user**', (r) => r.fulfill({ headers: cors, json: user() }))
  await page.route('**/auth/v1/factors**', async (r) => {
    const req = r.request()
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
    const path = new URL(req.url()).pathname.replace(/^.*\/auth\/v1\/factors/, '')
    const [, id, action] = path.split('/')
    const hasVerified = s.factors.some((f) => f.status === 'verified')
    if (req.method() === 'POST' && !id) {
      const body = req.postDataJSON() as { factor_type?: string; friendly_name?: string; issuer?: string }
      s.log.push('enroll')
      if (body.factor_type !== 'totp' || !body.friendly_name || body.issuer !== 'MoveNow') return gone(r, 400, 'validation_failed')
      if (hasVerified && s.aal !== 'aal2') return gone(r, 403, 'insufficient_aal')
      if (s.factors.some((f) => f.name === body.friendly_name)) return gone(r, 422, 'mfa_factor_name_conflict')
      const f = factor(`f-${s.factors.length + 1}-${s.log.length}`, 'unverified', body.friendly_name)
      s.factors.push(f)
      s.lastSecret = f.secret
      const uri = `otpauth://totp/MoveNow:kunde%40movenow.test?secret=${f.secret}&issuer=MoveNow`
      return r.fulfill({ status: 200, headers: cors, json: { id: f.id, type: 'totp', friendly_name: f.name, totp: { qr_code: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#000"/></svg>`, secret: f.secret, uri } } })
    }
    const f = s.factors.find((x) => x.id === id)
    if (req.method() === 'DELETE' && id) {
      s.log.push(`unenroll:${id}`)
      if (!f) return gone(r, 404, 'mfa_factor_not_found')
      if (f.status === 'verified' && s.aal !== 'aal2') return gone(r, 422, 'insufficient_aal')
      s.factors = s.factors.filter((x) => x.id !== id)
      return r.fulfill({ status: 200, headers: cors, json: { id } })
    }
    if (req.method() === 'POST' && action === 'challenge') {
      s.log.push(`challenge:${id}`)
      if (!f) return gone(r, 404, 'mfa_factor_not_found')
      return r.fulfill({ status: 200, headers: cors, json: { id: `ch-${s.log.length}`, type: 'totp', expires_at: Math.floor(Date.now() / 1000) + 300 } })
    }
    if (req.method() === 'POST' && action === 'verify') {
      const body = req.postDataJSON() as { challenge_id?: string; code?: string }
      const status = s.verifyStatus.shift()
      if (status && status >= 400) {
        s.log.push(`verify:${id}:fail`)
        return gone(r, status, status === 429 ? 'over_request_rate_limit' : 'unexpected_failure')
      }
      if (!f) return gone(r, 404, 'mfa_factor_not_found')
      const ok = !!body.challenge_id && /^\d{6}$/.test(body.code ?? '') && new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(f.secret) }).validate({ token: body.code!, window: 1 }) !== null
      s.log.push(`verify:${id}:${ok ? 'ok' : 'fail'}`)
      if (!ok) return gone(r, 422, 'mfa_verification_failed')
      f.status = 'verified'
      s.aal = 'aal2'
      return r.fulfill({ status: 200, headers: cors, json: makeSession('aal2', s.factors.map(pub)) })
    }
    return gone(r, 404, 'not_found')
  })
  return s
}

export type DocRow = { id: string; partner_id: string; kind: string; uploaded_at: string }
export type DocAnswer = { status: number; json: unknown }
export type DocsState = {
  rows: DocRow[]
  /** Dateien im Bucket (Pfad `{firma}/{id}`) */
  files: Set<string>
  inserts: Record<string, unknown>[]
  uploads: { path: string; contentType: string; size: number; head: number[] }[]
  /** Antworten für die nächsten Aufrufe (Warteschlangen); leer = Erfolg */
  insertAnswers: DocAnswer[]
  uploadAnswers: DocAnswer[]
}

export const pgError = (status: number, code: string, message: string): DocAnswer => ({ status, json: { code, message, details: null, hint: null } })
export const storageError = (status: number, message: string): DocAnswer => ({ status, json: { statusCode: String(status), error: message, message } })

export async function mockDocs(page: Page, partnerId: string, rows: DocRow[] = [], files: string[] = []): Promise<DocsState> {
  const s: DocsState = { rows: [...rows], files: new Set(files), inserts: [], uploads: [], insertAnswers: [], uploadAnswers: [] }
  await page.route('**/rest/v1/partner_documents**', async (r) => {
    const req = r.request()
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
    if (req.method() === 'POST') {
      const body = req.postDataJSON() as Record<string, unknown>
      s.inserts.push(body)
      const a = s.insertAnswers.shift()
      if (a) return r.fulfill({ status: a.status, headers: cors, json: a.json })
      s.rows.push({ id: String(body.id), partner_id: partnerId, kind: String(body.kind), uploaded_at: '2026-11-11T10:00:00Z' })
      return r.fulfill({ status: 201, headers: cors, json: [{ id: body.id }] })
    }
    return rest(r, s.rows)
  })
  await page.route('**/storage/v1/object/list/partner-documents', async (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
    return r.fulfill({ headers: cors, json: [...s.files].map((p) => ({ name: p.split('/')[1], id: p, metadata: {} })) })
  })
  await page.route('**/storage/v1/object/partner-documents/**', async (r) => {
    const req = r.request()
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
    const path = decodeURIComponent(new URL(req.url()).pathname.replace(/^.*\/object\/partner-documents\//, ''))
    const buf = req.postDataBuffer() ?? Buffer.alloc(0)
    // multipart (storage-js sendet den Blob als Teil mit filename): Content-Type des Teils und die ersten Bytes der Datei lesen
    const text = buf.toString('latin1')
    const part = Math.max(0, text.indexOf('filename='))
    const start = text.indexOf('\r\n\r\n', part) + 4
    const contentType = /Content-Type: ([^\r\n]+)/i.exec(text.slice(part))?.[1] ?? ''
    s.uploads.push({ path, contentType, size: buf.length, head: [...buf.subarray(start, start + 4)] })
    const a = s.uploadAnswers.shift()
    if (a) return r.fulfill({ status: a.status, headers: cors, json: a.json })
    s.files.add(path)
    return r.fulfill({ status: 200, headers: cors, json: { Id: 'obj-1', Key: `partner-documents/${path}` } })
  })
  return s
}

/** Kleinstes gültiges PNG (1×1) für den Bild-Upload. */
const pngChunk = (type: string, data: Buffer) => {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(1, 0)
ihdr.writeUInt32BE(1, 4)
ihdr.set([8, 2, 0, 0, 0], 8) // 8 Bit, RGB
export const PNG_1PX = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', deflateSync(Buffer.from([0, 255, 255, 255]))),
  pngChunk('IEND', Buffer.alloc(0)),
])

export const noSecret = async (page: Page, secret: string) => {
  const stored = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage } }))
  expect(stored, 'der Schlüssel darf nirgends im Speicher stehen').not.toContain(secret)
}
