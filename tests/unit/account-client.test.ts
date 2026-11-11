import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountError, accountErrorText, deleteAccount } from '../../src/lib/account'

const invoke = vi.fn()
vi.mock('../../src/lib/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }))

const http = (status: number, json: unknown) => new FunctionsHttpError(new Response(JSON.stringify(json), { status }))

beforeEach(() => invoke.mockReset())

describe('deleteAccount (s9i-4)', () => {
  it('sendet genau { confirm: true } an delete-account', async () => {
    invoke.mockResolvedValue({ data: { deleted: true }, error: null })
    await deleteAccount()
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(invoke).toHaveBeenCalledWith('delete-account', { body: { confirm: true } })
  })

  it('Erfolg nur mit deleted: true, alles andere ist ein Fehler', async () => {
    for (const data of [{}, { deleted: false }, { deleted: 'true' }, null, 'ok']) {
      invoke.mockResolvedValue({ data, error: null })
      await expect(deleteAccount()).rejects.toMatchObject({ kind: 'unavailable' })
    }
  })

  it.each([
    [409, 'open_requests', 'open_requests'],
    [403, 'role_not_allowed', 'role_not_allowed'],
    [401, 'unauthorized', 'unauthorized'],
    [400, 'invalid_input', 'unavailable'],
    [500, 'internal', 'unavailable'],
    [409, 'unbekannt', 'unavailable'],
  ])('%i %s wird %s', async (status, error, kind) => {
    invoke.mockResolvedValue({ data: null, error: http(status, { error }) })
    await expect(deleteAccount()).rejects.toMatchObject({ kind })
  })

  it('Code passt nur mit dem passenden Status (403 open_requests ist generisch)', async () => {
    invoke.mockResolvedValue({ data: null, error: http(403, { error: 'open_requests' }) })
    await expect(deleteAccount()).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('Netzfehler ist offline, unlesbare Antwort generisch', async () => {
    invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError(new Error('x')) })
    await expect(deleteAccount()).rejects.toMatchObject({ kind: 'offline' })
    invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(new Response('kein json', { status: 409 })) })
    await expect(deleteAccount()).rejects.toBeInstanceOf(AccountError)
  })

  it('jede Fehlerart hat einen Text ohne Gebührenhinweis', () => {
    for (const text of Object.values(accountErrorText)) {
      expect(text.length).toBeGreaterThan(10)
      expect(text).not.toMatch(/Gebühr|Provision|15 ?%/)
    }
  })
})
