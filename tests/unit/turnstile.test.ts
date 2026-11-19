import { describe, expect, it, vi } from 'vitest'
import { TurnstileError, verifyTurnstile } from '../../supabase/functions/_shared/turnstile.ts'

// Platzhalter, kein echtes Secret: die Prüfung gegen Cloudflare ist hier gemockt.
const SECRET = 'platzhalter-secret'
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }))

describe('verifyTurnstile', () => {
  it('schickt secret und response als Formular an siteverify, ohne remoteip', async () => {
    const f = reply(200, { success: true })
    expect(await verifyTurnstile('tok', SECRET, f as never)).toBe(true)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(init.method).toBe('POST')
    const form = init.body as URLSearchParams
    expect(Object.fromEntries(form)).toEqual({ secret: SECRET, response: 'tok' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it.each([['invalid-input-response'], ['timeout-or-duplicate'], ['missing-input-response']])('%s: Token abgelehnt (false)', async (code) => {
    expect(await verifyTurnstile('tok', SECRET, reply(200, { success: false, 'error-codes': [code] }) as never)).toBe(false)
  })

  it.each([['missing-input-secret'], ['invalid-input-secret'], ['bad-request'], ['internal-error'], ['neuer-unbekannter-code']])('%s: Fehler auf unserer Seite (wirft)', async (code) => {
    await expect(verifyTurnstile('tok', SECRET, reply(200, { success: false, 'error-codes': [code] }) as never)).rejects.toBeInstanceOf(TurnstileError)
  })

  it('success false ohne Fehlercode, Nicht-JSON, HTTP 5xx und Netzfehler werfen, ohne das Secret zu nennen', async () => {
    const broken = [reply(200, { success: false }), reply(200, 'kein json'), reply(500, { success: true }), vi.fn(async () => Promise.reject(new Error(`boom ${SECRET}`)))]
    for (const f of broken) {
      const error = await verifyTurnstile('tok', SECRET, f as never).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(TurnstileError)
      expect(String((error as Error).message)).not.toContain(SECRET)
    }
  })

  it('bricht nach dem Timeout ab (wirft)', async () => {
    const hang = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('abort')))))
    await expect(verifyTurnstile('tok', SECRET, hang as never, 20)).rejects.toBeInstanceOf(TurnstileError)
  })
})
