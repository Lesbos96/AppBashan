import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../components/Button'
import { Sheet } from '../components/Sheet'
import { AccountError, accountErrorText, deleteAccount } from '../lib/account'
import { signOut } from '../lib/auth'

export type AccountNotice = 'deleted' | 'unauthorized'

/**
 * Konto löschen (s9i-4): erst nach ausdrücklicher Bestätigung (Häkchen) aktiv, gesperrt solange der Aufruf läuft.
 * Jedes Öffnen beginnt ohne Häkchen und ohne alten Fehler, auch nach Schließen über Zurück oder Wischen.
 * Nach Erfolg (und bei 401, die Sitzung gilt dann nicht mehr) nur lokal abmelden: Der Server hat die Sitzungen schon entfernt.
 */
export function KontoLoeschen({ open, email, onClose, onDone }: { open: boolean; email: string; onClose: () => void; onDone: (notice: AccountNotice) => void }) {
  const [sure, setSure] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AccountError | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  const running = useRef(false)

  if (open !== wasOpen) {
    setWasOpen(open)
    setSure(false)
    setError(null)
  }

  async function confirm() {
    if (running.current || !sure) return
    running.current = true
    setBusy(true)
    setError(null)
    let notice: AccountNotice | null = null
    try {
      await deleteAccount()
      notice = 'deleted'
    } catch (e) {
      const err = e instanceof AccountError ? e : new AccountError('unavailable')
      if (err.kind === 'unauthorized') notice = 'unauthorized'
      else setError(err)
    }
    try {
      if (notice) await signOut('local')
    } finally {
      running.current = false
      setBusy(false)
      if (notice) onDone(notice)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} locked={busy} title="Konto löschen" detents={[0.85]}>
      {open && (
        <div className="flex flex-col gap-4 pt-2">
          <p className="m-0 text-body">
            Du löschst das Konto <span className="break-all font-semibold">{email}</span>. Wir entfernen deine Anmeldung, E-Mail-Adresse, Telefonnummer und Adressen. Deine Fotos löschen wir
            danach automatisch.
          </p>
          <p className="m-0 text-body">
            Beendete Aufträge bleiben ohne Namen, Kontakt und Adressen erhalten. Offene Aufträge und Anfragen müssen vorher beendet sein: Bestätigte Aufträge kannst du im Auftrag stornieren,
            Anfragen ohne Zusage laufen von selbst ab. Nach dem Termin beantwortest du im Auftrag, ob er stattgefunden hat.
          </p>
          <p className="m-0 text-body font-semibold">Das lässt sich nicht rückgängig machen.</p>
          <label className="flex min-h-11 items-center gap-3 rounded-grouped-list bg-surface p-4 shadow-card">
            <input type="checkbox" checked={sure} disabled={busy} onChange={(e) => setSure(e.target.checked)} className="size-5 shrink-0 accent-[var(--accent)]" />
            <span className="text-subhead">Ich will mein Konto endgültig löschen.</span>
          </label>
          {error && (
            <div role="alert" className="flex flex-col gap-1">
              <p className="m-0 text-body">{accountErrorText[error.kind]}</p>
              {error.kind === 'open_requests' && (
                <Link to="/auftraege" className="press flex h-11 items-center text-body font-semibold text-accent">
                  Zu den Aufträgen
                </Link>
              )}
            </div>
          )}
          <Button disabled={!sure || busy} onClick={() => void confirm()}>
            Konto endgültig löschen
          </Button>
          <Button variant="plain" disabled={busy} onClick={onClose}>
            Doch nicht
          </Button>
        </div>
      )}
    </Sheet>
  )
}
