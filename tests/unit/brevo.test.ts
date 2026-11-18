// Brevo-Sender (mail1): Aufbau der Anfrage und Fehlerabbildung. Kein Netz, `fetch` wird eingespeist.
import { describe, expect, it } from 'vitest'
import { brevoSender, MailError } from '../../supabase/functions/_shared/jobs/brevo.ts'

const mail = { to: 'kunde@example.com', subject: 'Betreff', text: 'Text mit Link: https://app.test' }
const sender = (fetch: typeof globalThis.fetch) => brevoSender({ apiKey: 'schluessel-123', from: 'absender@example.com', fetch })
const status = (code: number) => sender(async () => new Response('{"message":"kunde@example.com ungültig"}', { status: code }))

describe('brevoSender', () => {
  it('sendet eine Transaktionsmail als reinen Text an die Brevo-API, der Schlüssel steht nur im Header', async () => {
    let seen: { url: string; init: RequestInit } | undefined
    await sender(async (url, init) => {
      seen = { url: String(url), init: init as RequestInit }
      return new Response('{"messageId":"x"}', { status: 201 })
    })(mail)
    expect(seen?.url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(seen?.init.method).toBe('POST')
    expect(seen?.init.headers).toMatchObject({ 'api-key': 'schluessel-123', 'content-type': 'application/json' })
    const body = JSON.parse(String(seen?.init.body))
    expect(body).toEqual({ sender: { name: 'MoveNow', email: 'absender@example.com' }, to: [{ email: 'kunde@example.com' }], subject: 'Betreff', textContent: 'Text mit Link: https://app.test' })
    expect(JSON.stringify(body)).not.toContain('schluessel-123')
    expect(seen?.init.signal).toBeInstanceOf(AbortSignal)
  })

  it('4xx (außer 429) ist eine dauerhafte Ablehnung, 429, 5xx und Netzfehler sind vorübergehend; keine Meldung enthält die Adresse', async () => {
    const outcome = async (p: Promise<void>) => p.then(() => 'ok', (e) => (e instanceof MailError ? (e.permanent ? 'permanent' : 'temporär') : 'anders') + ':' + (e as Error).message)
    expect(await outcome(status(400)(mail))).toBe('permanent:mail_failed')
    expect(await outcome(status(401)(mail))).toBe('permanent:mail_failed')
    expect(await outcome(status(429)(mail))).toBe('temporär:mail_failed')
    expect(await outcome(status(500)(mail))).toBe('temporär:mail_failed')
    expect(await outcome(status(503)(mail))).toBe('temporär:mail_failed')
    expect(await outcome(sender(async () => { throw new TypeError('fetch failed: kunde@example.com') })(mail))).toBe('temporär:mail_failed')
    expect(await outcome(status(202)(mail))).toBe('ok')
  })
})
