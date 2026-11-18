// Mailversand über die Brevo-API (Transaktionsmail, reiner Text). Der Anbieter ist hier gekapselt: outbox-send kennt nur `send(mail)`.
// Fehler tragen weder Empfänger noch Antworttext des Anbieters, nur `permanent` (4xx außer 429: der Anbieter lehnt die Mail ab).
export type Mail = { to: string; subject: string; text: string }

export class MailError extends Error {
  constructor(readonly permanent: boolean) {
    super('mail_failed')
  }
}

const ENDPOINT = 'https://api.brevo.com/v3/smtp/email'
// 5 s je Mail: Der Handler versendet bis zu 25 Zeilen nacheinander und muss unter der Laufzeitgrenze der Function bleiben.
const TIMEOUT_MS = 5000

export function brevoSender(o: { apiKey: string; from: string; fetch?: typeof fetch }): (mail: Mail) => Promise<void> {
  const call = o.fetch ?? fetch
  return async (m) => {
    let res: Response
    try {
      res = await call(ENDPOINT, {
        method: 'POST',
        headers: { 'api-key': o.apiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { name: 'MoveNow', email: o.from }, to: [{ email: m.to }], subject: m.subject, textContent: m.text }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      throw new MailError(false)
    }
    if (res.ok) {
      await res.body?.cancel()
      return
    }
    await res.body?.cancel()
    throw new MailError(res.status >= 400 && res.status < 500 && res.status !== 429)
  }
}
