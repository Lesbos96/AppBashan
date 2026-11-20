import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { LegalLink } from '../../components/Legal'
import { Button } from '../../components/Button'
import { ErrorState, Loading } from '../../components/States'
import { Card, Field, GroupedList } from '../../components/Surfaces'
import { confirmCode, digitsOnly6, loadMfaState, MfaError, mfaErrorText, startEnrollment, type Enrollment, type MfaState } from '../../lib/mfa'
import { useLoad } from '../../lib/prices'

const errorKind = (e: unknown) => (e instanceof MfaError ? e.kind : 'unavailable')

/**
 * Schranke vor allem, was über den Status hinausgeht: aal2 → `children`; verifizierter Faktor → Code-Abfrage; sonst Einrichtung.
 * Entscheidet nur die Bedienführung; der Server verlangt aal2 selbst. Nach einer Bestätigung lädt die Schranke den Zustand neu (aus dem Token).
 */
export function MfaGate({ children }: { children: (recheck: () => void) => ReactNode }) {
  const [state, reload] = useLoad(loadMfaState)
  const [notice, setNotice] = useState('')
  if (state.status === 'loading') return <Loading label="Sicherheit prüfen" />
  if (state.status === 'error') return <ErrorState text="Der Zugang konnte nicht geprüft werden. Prüfe deine Verbindung." onRetry={reload} />
  const s: MfaState = state.data
  if (s.step === 'done') return <>{children(reload)}</>
  const again = (message = '') => {
    setNotice(message)
    reload()
  }
  return s.step === 'challenge' ? <Code factorId={s.factorId} notice={notice} onDone={again} /> : <Einrichtung onDone={again} />
}

function CodeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <GroupedList>
      <Field label="Code" name="code" value={value} onChange={(e) => onChange(digitsOnly6(e.target.value))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" aria-required className="min-h-11 tabular-nums tracking-widest" />
    </GroupedList>
  )
}

/** Gemeinsame Bestätigung: sperrt gegen Doppelklick, zeigt Fehler in Worten und lässt den Code im Feld stehen. */
function useConfirm(factorId: string | null, onDone: () => void, onLost: (kind: 'factor_gone' | 'insufficient_aal') => void) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const running = useRef(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (running.current || !factorId) return
    running.current = true
    setBusy(true)
    setError('')
    try {
      await confirmCode(factorId, code)
      onDone()
    } catch (err) {
      const kind = errorKind(err)
      if (kind === 'factor_gone' || kind === 'insufficient_aal') onLost(kind)
      else setError(mfaErrorText[kind])
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  return { code, setCode, busy, error, submit }
}

const Alert = ({ text }: { text: string }) =>
  text ? (
    <p role="alert" className="m-0 px-4 text-body text-destructive">
      {text}
    </p>
  ) : null

function Code({ factorId, notice, onDone }: { factorId: string; notice: string; onDone: (message?: string) => void }) {
  const c = useConfirm(factorId, () => onDone(), (kind) => onDone(mfaErrorText[kind]))
  return (
    <form noValidate onSubmit={(e) => void c.submit(e)} className="flex flex-col gap-4 px-5 pb-8">
      <Card className="flex flex-col gap-2 p-4">
        <h2 className="m-0 text-title3">Code eingeben</h2>
        <p className="m-0 text-body text-text-secondary">Gib den sechsstelligen Code deiner Authenticator-App ein. Danach siehst du deine Dokumente.</p>
      </Card>
      <CodeField value={c.code} onChange={c.setCode} />
      <Alert text={c.error || notice} />
      <Button type="submit" disabled={c.busy}>
        {c.busy ? 'Wird geprüft …' : 'Bestätigen'}
      </Button>
      <p className="m-0 px-4 text-footnote text-text-secondary">
        Gerät verloren oder keinen Zugriff auf die App? Wir setzen den Faktor nach einer Prüfung zurück. Unsere Kontaktdaten stehen im{' '}
        <LegalLink to="/recht/impressum" className="text-accent underline">
          Impressum
        </LegalLink>
        .
      </p>
    </form>
  )
}

function Einrichtung({ onDone }: { onDone: (message?: string) => void }) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')
  const running = useRef(false)
  // Verliert das Gerät den Faktor (anderes Gerät war schneller), beginnt die Einrichtung von vorn bzw. fragt den Code ab
  const c = useConfirm(enrollment?.factorId ?? null, () => onDone(), (kind) => {
    if (kind === 'factor_gone') {
      setEnrollment(null)
      setStartError(mfaErrorText.factor_gone)
    } else onDone(mfaErrorText[kind])
  })

  async function start() {
    if (running.current) return
    running.current = true
    setStarting(true)
    setStartError('')
    try {
      setEnrollment(await startEnrollment())
    } catch (err) {
      const kind = errorKind(err)
      // anderer Faktor schon vorhanden: zurück zur Schranke, sie fragt den Code ab
      if (kind === 'insufficient_aal') onDone(mfaErrorText.insufficient_aal)
      else setStartError(mfaErrorText[kind])
    } finally {
      running.current = false
      setStarting(false)
    }
  }

  if (!enrollment) {
    return (
      <div className="flex flex-col gap-4 px-5 pb-8">
        <Card className="flex flex-col gap-2 p-4">
          <h2 className="m-0 text-title3">Sicherheitscode einrichten</h2>
          <p className="m-0 text-body text-text-secondary">
            Für Partner-Konten ist ein zweiter Faktor Pflicht. Du brauchst dafür eine Authenticator-App auf deinem Handy, zum Beispiel deine Passwort-App.
          </p>
        </Card>
        <Alert text={startError} />
        <Button disabled={starting} onClick={() => void start()}>
          {starting ? 'Wird vorbereitet …' : 'Einrichtung starten'}
        </Button>
      </div>
    )
  }
  return (
    <form noValidate onSubmit={(e) => void c.submit(e)} className="flex flex-col gap-4 px-5 pb-8">
      <Card className="flex flex-col items-center gap-3 p-4 text-center">
        <h2 className="m-0 w-full text-left text-title3">Sicherheitscode einrichten</h2>
        <p className="m-0 w-full text-left text-body text-text-secondary">Scanne den QR-Code mit deiner Authenticator-App und gib danach den Code ein, den die App anzeigt.</p>
        <img src={enrollment.qr} alt="QR-Code für deine Authenticator-App" width={176} height={176} className="size-44 max-w-full rounded-card border-[0.5px] border-separator bg-white p-2" />
        <p className="m-0 w-full text-left text-footnote text-text-secondary">Kein Scan möglich? Gib diesen Schlüssel in der App von Hand ein:</p>
        <code className="w-full break-all text-left font-mono text-body select-all">{enrollment.secret}</code>
      </Card>
      <CodeField value={c.code} onChange={c.setCode} />
      <Alert text={c.error} />
      <Button type="submit" disabled={c.busy}>
        {c.busy ? 'Wird geprüft …' : 'Bestätigen'}
      </Button>
    </form>
  )
}
