import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { NavBar } from '../components/Bars'
import { Button } from '../components/Button'
import { Field, GroupedList } from '../components/Surfaces'
import { AuthError, digitsOnly, rememberNext, requestSignIn, takeNext, verifyCode, verifyLink, type AuthErrorKind } from '../lib/auth'
import { useSession } from '../lib/session'

const RESEND_SECONDS = 60

// Eigene Texte, nie die Meldung des Dienstes. Supabase trennt falsche, abgelaufene und benutzte Codes nicht, daher ein Text.
const text: Record<AuthErrorKind, string> = {
  invalid_email: 'Prüfe die E-Mail-Adresse. Sie sieht noch nicht vollständig aus.',
  invalid_code: 'Der Code stimmt nicht oder ist abgelaufen. Prüfe die Ziffern oder fordere einen neuen Code an.',
  rate_limited: 'Zu viele Versuche. Warte einen Moment und versuche es dann noch einmal.',
  offline: 'Du bist offline. Prüfe deine Verbindung und versuche es noch einmal.',
  unavailable: 'Das hat nicht geklappt. Versuche es gleich noch einmal.',
}
const linkText = 'Der Link ist abgelaufen oder wurde schon benutzt. Fordere einen neuen Code an.'

const describe = (e: unknown, link = false) => (e instanceof AuthError ? (link && e.kind === 'invalid_code' ? linkText : text[e.kind]) : text.unavailable)

type Step = 'email' | 'code' | 'link' | 'done'

/** Liest Link-Parameter einmal beim Öffnen; danach verschwinden sie aus der URL. Das Token bleibt nur im State. */
function readUrl(search: string, hash: string) {
  const query = new URLSearchParams(search)
  // Das Token steht im Fragment: es geht nie an den Server und landet nicht in Zugriffsprotokollen.
  const fragment = new URLSearchParams(hash.replace(/^#/, ''))
  return {
    token: fragment.get('type') === 'email' ? fragment.get('token_hash') : null,
    next: query.get('next'),
    // der Standard-Link von Supabase meldet einen abgelaufenen Link ebenfalls im Fragment
    expired: fragment.has('error') || fragment.has('error_code'),
  }
}

export function Anmelden() {
  const location = useLocation()
  const navigate = useNavigate()
  const session = useSession()
  const [url] = useState(() => readUrl(location.search, location.hash))
  const [step, setStep] = useState<Step>(url.token ? 'link' : 'email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(url.expired && !url.token ? linkText : null)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const redirected = useRef(false)

  useEffect(() => {
    if (!location.search && !location.hash) return
    if (url.next) rememberNext(url.next)
    void navigate('/anmelden', { replace: true })
  }, [location.search, location.hash, navigate, url.next])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  // Wer schon angemeldet ist und nur die Seite öffnet, geht weiter (mit Link-Token nie automatisch).
  useEffect(() => {
    if (!session || step !== 'email' || redirected.current) return
    redirected.current = true
    void navigate(takeNext(), { replace: true })
  }, [session, step, navigate])

  async function run(action: () => Promise<void>, link = false) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(describe(e, link))
    } finally {
      setBusy(false)
    }
  }

  const send = (e?: FormEvent) => {
    e?.preventDefault()
    void run(async () => {
      await requestSignIn(email)
      setCode('')
      setStep('code')
      setCooldown(RESEND_SECONDS)
    })
  }
  const submitCode = (e: FormEvent) => {
    e.preventDefault()
    void run(async () => {
      await verifyCode(email, code)
      void navigate(takeNext(), { replace: true })
    })
  }
  const confirmLink = () =>
    void run(async () => {
      await verifyLink(url.token ?? '')
      setStep('done')
    }, true)

  const err = error && (
    <p role="alert" className="m-0 px-1 text-footnote text-destructive">
      {error}
    </p>
  )
  const intro = 'm-0 px-1 text-body text-text-secondary'

  return (
    <main>
      <NavBar title="Anmelden" back={{ to: '/', label: 'Start' }} />
      <div className="flex flex-col gap-4 px-5 pt-4">
        {step === 'email' && (
          <form noValidate onSubmit={send} className="flex flex-col gap-4">
            <p className={intro}>Wir schicken dir einen Code und einen Link per E-Mail. Ein Passwort brauchst du nicht.</p>
            <GroupedList>
              <Field label="E-Mail" type="email" name="email" autoComplete="email" inputMode="email" placeholder="name@beispiel.at" value={email} onChange={(e) => setEmail(e.target.value)} />
            </GroupedList>
            {err}
            <Button type="submit" disabled={busy || !email.trim()}>
              Code senden
            </Button>
          </form>
        )}

        {step === 'code' && (
          <form noValidate onSubmit={submitCode} className="flex flex-col gap-4">
            <p className={intro}>Ist die Adresse richtig, ist die Mail an {email.trim()} unterwegs. Gib den Code daraus ein oder öffne den Link.</p>
            <GroupedList>
              <Field
                label="Code"
                name="code"
                autoComplete="one-time-code"
                inputMode="numeric"
                placeholder="Ziffern"
                className="tabular-nums tracking-widest"
                value={code}
                onChange={(e) => setCode(digitsOnly(e.target.value))}
              />
            </GroupedList>
            {err}
            <Button type="submit" disabled={busy || code.length < 6}>
              Anmelden
            </Button>
            <div className="flex flex-col">
              <Button variant="plain" disabled={busy || cooldown > 0} onClick={send}>
                {cooldown > 0 ? `Erneut senden in ${cooldown} s` : 'Code erneut senden'}
              </Button>
              <Button variant="plain" onClick={() => { setError(null); setStep('email') }}>
                Andere Adresse
              </Button>
            </div>
          </form>
        )}

        {step === 'link' && (
          <div className="flex flex-col gap-4">
            {session ? (
              <p className={intro}>Du bist schon als {session.user.email} angemeldet. Dieser Link kann dich in einem anderen Konto anmelden. Mach das nur, wenn du ihn selbst angefordert hast.</p>
            ) : (
              <p className={intro}>Tippe auf „Anmelden“, um dich in diesem Browser anzumelden.</p>
            )}
            {err}
            {error ? (
              <Button onClick={() => { setError(null); setStep('email') }}>Neuen Code anfordern</Button>
            ) : (
              <>
                <Button disabled={busy || session === undefined} onClick={confirmLink}>
                  {session ? 'Trotzdem mit dem Link anmelden' : 'Anmelden'}
                </Button>
                {session && (
                  <Button variant="plain" onClick={() => void navigate(takeNext(), { replace: true })}>
                    Abbrechen
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col gap-4">
            <p className={intro}>
              Du bist angemeldet{session?.user.email ? ` als ${session.user.email}` : ''}. Stimmt das nicht, melde dich im Profil ab.
            </p>
            <Button onClick={() => void navigate(takeNext(), { replace: true })}>Weiter</Button>
          </div>
        )}
      </div>
    </main>
  )
}
