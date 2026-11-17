import { useState, type ReactNode } from 'react'
import { Button } from '../../components/Button'
import { Sheet } from '../../components/Sheet'
import { JobError, jobErrorText, retryable, stale } from '../../lib/jobs'

/**
 * Bestätigung im Sheet für eine Aktion mit Folgen. Gesperrt, solange sie läuft (kein Doppelklick, kein Schließen).
 * Ist die Anzeige veraltet (Preis geändert, nicht mehr möglich), schließt das Sheet und `onDone` bekommt den Hinweis; sonst bleibt der Fehler im Sheet.
 */
export function Bestaetigen({ open, onClose, title, label, action, onDone, children }: { open: boolean; onClose: () => void; title: string; label: string; action: () => Promise<void>; onDone: (notice?: string, warn?: boolean) => void; children?: ReactNode }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<JobError | null>(null)

  const close = () => {
    setError(null)
    onClose()
  }

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await action()
      onClose()
      onDone()
    } catch (e) {
      const err = e instanceof JobError ? e : new JobError('unavailable')
      if (stale(err.kind)) {
        onClose()
        onDone(jobErrorText[err.kind], true)
      } else setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={close} locked={busy} title={title} detents={[0.6]} fit>
      <div className="flex flex-col gap-4 pt-2">
        {children}
        {error && (
          <p role="alert" className="m-0 text-body">
            {jobErrorText[error.kind]}
          </p>
        )}
        {error && !retryable(error.kind) ? (
          <Button variant="plain" onClick={close}>
            Schließen
          </Button>
        ) : (
          <>
            <Button disabled={busy} onClick={() => void confirm()}>
              {label}
            </Button>
            <Button variant="plain" disabled={busy} onClick={close}>
              Doch nicht
            </Button>
          </>
        )}
      </div>
    </Sheet>
  )
}
