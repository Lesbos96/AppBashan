import { useRef, useState, type ReactNode } from 'react'
import { Button } from '../../components/Button'
import { Sheet } from '../../components/Sheet'
import { GroupedList, SelectField } from '../../components/Surfaces'
import { JobError, jobErrorText, type JobErrorKind } from '../../lib/jobs'
import { formatEuro } from '../../lib/money'
import { cancelAsPartner, CANCEL_REASONS, previewPartnerCancel, type CancelPreview, type CancelReason } from '../../lib/partnerCancel'
import { uploadReceipt } from '../../lib/partnerChange'
import { PhotoError } from '../../lib/photos'
import { BelegFotos } from './Belege'

/*
 * Absage durch die Firma. 1. Grund wählen, 2. Folgen vom Server ansehen (Vorschau, schreibt nichts), 3. bestätigen mit genau dem gezeigten Betrag.
 * Nie automatisch erneut senden: bei 409 kommt eine neue Vorschau, nach einem Netzfehler beim Senden lädt die Ansicht den Status neu (Ergebnis unbekannt).
 * VORLÄUFIG bis zur Rechtsprüfung (S9_KONZEPT.md:361): alle Texte zur Pauschale (docs/GOLIVE.md).
 */

const euro = (cents: number) => <span className="whitespace-nowrap tabular-nums">{formatEuro(cents)}</span>

function Zeile({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <p className="m-0 flex items-baseline justify-between gap-3 text-body">
      <span className="min-w-0 flex-1 text-text-secondary">{label}</span>
      <span className={`max-w-[70%] shrink-0 break-words text-right ${strong ? 'text-headline' : 'font-semibold'}`}>{children}</span>
    </p>
  )
}

/** Die Anzeige ist veraltet oder der Server verweigert: Sheet schließen, Aufträge neu laden. */
const closes = (k: JobErrorKind) => k === 'closed' || k === 'gone' || k === 'unauthorized'
/** Vorschau neu holen: nichts wurde gebucht, die Auswahl gilt nicht mehr. */
const refreshes = (k: JobErrorKind) => k === 'changed' || k === 'no_call_out' || k === 'retry'

type Choice = 'fee' | 'free'
type Preview = CancelPreview & { reason: CancelReason }

export function AbsageSheet({
  open,
  onClose,
  requestId,
  started,
  receiptIds,
  onDone,
}: {
  open: boolean
  onClose: () => void
  requestId: string
  /** Der Termin hat begonnen (Datenbankuhr laut my_jobs): dann ist nur noch `scope_impossible` möglich; der Server entscheidet. */
  started: boolean
  receiptIds: string[]
  onDone: (notice?: string) => void
}) {
  const [reason, setReason] = useState<CancelReason>('scope_impossible')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [choice, setChoice] = useState<Choice | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [uploaded, setUploaded] = useState<string[]>([])
  const [touched, setTouched] = useState(false)
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const running = useRef(false)

  // Jedes Öffnen beginnt neu (Zustand beim Wechsel von `open` zurücksetzen)
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setReason('scope_impossible')
      setPreview(null)
      setChoice(null)
      setFiles([])
      setUploaded([])
      setTouched(false)
      setError('')
      setFileKey((k) => k + 1)
    }
  }

  const text = (e: unknown) => (e instanceof PhotoError ? e.message : jobErrorText[e instanceof JobError ? e.kind : 'unavailable'])
  const kindOf = (e: unknown): JobErrorKind => (e instanceof JobError ? e.kind : 'unavailable')
  const all = Array.from(new Set([...receiptIds, ...uploaded]))
  const have = all.length
  // Ein hochgeladener Beleg bleibt beim Server (nicht löschbar): auch beim Schließen ohne Senden neu laden, damit er als vorhanden zählt
  const close = () => {
    onClose()
    if (touched) onDone()
  }
  const leave = (notice: string) => {
    onClose()
    onDone(notice)
  }

  // Der Grund gehört zur Vorschau: jede Änderung verwirft Vorschau, Auswahl und gezeigten Betrag
  function pickReason(r: CancelReason) {
    setReason(r)
    setPreview(null)
    setChoice(null)
    setError('')
  }

  async function check(r: CancelReason, notice = ''): Promise<void> {
    setBusy(true)
    setError('')
    try {
      const p = await previewPartnerCancel(requestId, r)
      setPreview({ ...p, reason: r })
      setChoice(null)
      setError(notice)
    } catch (e) {
      const kind = kindOf(e)
      if (closes(kind)) leave(jobErrorText[kind])
      else {
        if (kind === 'late_reason') setReason('scope_impossible')
        setPreview(null)
        setError(text(e))
      }
    } finally {
      setBusy(false)
    }
  }

  async function startCheck() {
    if (running.current) return
    running.current = true
    try {
      await check(reason)
    } finally {
      running.current = false
    }
  }

  async function send() {
    if (running.current || !preview) return
    const fee = preview.callOutCents > 0 && choice === 'fee'
    if (preview.callOutCents > 0 && choice === null) return
    running.current = true
    setBusy(true)
    setError('')
    let ids = all
    try {
      // Belege nacheinander hochladen (nur beim Weg mit Pauschale); jedes fertige Foto bleibt bei einem Fehler erhalten. Gesendet wurde dabei noch nichts.
      if (fee) {
        ids = [...all]
        for (const f of files) {
          const id = await uploadReceipt(requestId, f)
          if (!ids.includes(id)) ids.push(id)
          setTouched(true)
          setUploaded((u) => [...u, id])
          setFiles((fs) => fs.filter((x) => x !== f))
        }
      }
    } catch (e) {
      const kind = kindOf(e)
      if (closes(kind)) leave(jobErrorText[kind])
      else setError(text(e))
      running.current = false
      setBusy(false)
      return
    }
    try {
      await cancelAsPartner(requestId, preview.reason, fee ? ids : [], fee ? preview.callOutCents : 0)
      onClose()
      onDone(fee ? 'Du hast den Auftrag abgesagt. Die Pauschale stellst du dem Kunden außerhalb der App in Rechnung.' : 'Du hast den Auftrag abgesagt. Der Kunde ist informiert.')
    } catch (e) {
      const kind = kindOf(e)
      if (refreshes(kind)) {
        // Der Server rechnet anders als gezeigt, oder die Grundlage wechselte: nichts ist gebucht. Neue Vorschau holen, nie automatisch senden.
        await check(preview.reason, kind === 'changed' || kind === 'no_call_out' ? 'Der Betrag hat sich geändert. Prüfe die Folgen neu und bestätige erneut.' : jobErrorText.retry)
      } else if (closes(kind)) {
        leave(jobErrorText[kind])
      } else if (kind === 'offline' || kind === 'unavailable') {
        // Ergebnis unbekannt (verlorene Antwort): nicht erneut senden, den Status neu laden
        leave('Wir wissen nicht, ob die Absage angekommen ist. Die Aufträge wurden neu geladen. Prüfe den Status des Auftrags.')
      } else {
        setError(text(e))
      }
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  const free = preview ? preview.callOutCents === 0 || choice === 'free' : false
  const feeChosen = preview ? preview.callOutCents > 0 && choice === 'fee' : false
  const sendable = preview !== null && (free || (feeChosen && have + files.length >= 1 && have + files.length <= 8))

  return (
    <Sheet open={open} onClose={close} locked={busy} title="Auftrag absagen" detents={[0.92]} fit>
      <div className="flex flex-col gap-4 pt-2">
        {preview === null && (
          <>
            <p className="m-0 text-subhead text-text-secondary">Der Kunde wird informiert. Was das für ihn und für dich bedeutet, siehst du im nächsten Schritt.</p>
            <GroupedList>
              <SelectField label="Grund" disabled={busy} value={reason} onChange={(e) => pickReason(e.target.value as CancelReason)}>
                {CANCEL_REASONS.filter((r) => !started || r.value === 'scope_impossible').map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </SelectField>
            </GroupedList>
            {started && <p className="m-0 text-footnote text-text-secondary">Der Termin hat begonnen. Jetzt ist nur noch dieser Grund möglich.</p>}
          </>
        )}

        {preview !== null && (
          <>
            <p className="m-0 text-subhead text-text-secondary">Grund: {CANCEL_REASONS.find((r) => r.value === preview.reason)?.label}</p>
            {preview.callOutCents === 0 ? (
              <p className="m-0 text-body">
                Der Kunde muss nichts zahlen. Seine Anfrage geht an andere Firmen. Kontakt und Adresse sind danach für dich gesperrt. Mehrere Absagen in kurzer Zeit lösen eine Prüfung deiner Firma aus.
              </p>
            ) : (
              <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
                <legend className="mb-2 text-headline">Wie willst du absagen?</legend>
                <label className="flex min-h-11 items-start gap-3 rounded-grouped-list bg-surface p-4 shadow-card">
                  <input type="radio" name="absage" className="mt-1 size-5 shrink-0 accent-[var(--color-accent)]" checked={choice === 'fee'} disabled={busy} onChange={() => setChoice('fee')} />
                  <span className="flex min-w-0 flex-col gap-2">
                    <span className="text-body font-semibold">Mit Pauschale</span>
                    <Zeile label="Pauschale inkl. USt.">{euro(preview.callOutCents)}</Zeile>
                    <Zeile label="Gebühr">{euro(preview.callOutCents - preview.payoutCents)}</Zeile>
                    <Zeile label="Du erhältst" strong>
                      {euro(preview.payoutCents)}
                    </Zeile>
                    <span className="text-subhead text-text-secondary">
                      Der Kunde schuldet dir die Pauschale von {euro(preview.callOutCents)}. Du stellst sie ihm außerhalb der App in Rechnung. Die Anfrage wird nicht weitervermittelt. Kontakt und Adresse bleiben dir kurze Zeit sichtbar. Dafür brauchst du mindestens ein Belegfoto.
                    </span>
                  </span>
                </label>
                <label className="flex min-h-11 items-start gap-3 rounded-grouped-list bg-surface p-4 shadow-card">
                  <input type="radio" name="absage" className="mt-1 size-5 shrink-0 accent-[var(--color-accent)]" checked={choice === 'free'} disabled={busy} onChange={() => setChoice('free')} />
                  <span className="flex min-w-0 flex-col gap-2">
                    <span className="text-body font-semibold">Ohne Pauschale</span>
                    <span className="text-subhead text-text-secondary">
                      Der Kunde muss nichts zahlen. Seine Anfrage geht an andere Firmen. Kontakt und Adresse sind danach für dich gesperrt. Mehrere Absagen in kurzer Zeit lösen eine Prüfung deiner Firma aus.
                    </span>
                  </span>
                </label>
              </fieldset>
            )}
            {feeChosen && <BelegFotos have={have} files={files} setFiles={setFiles} fileKey={fileKey} setFileKey={setFileKey} busy={busy} />}
          </>
        )}

        {/* Fehler und Knöpfe kleben am unteren Rand des Sheets (wie beim Nachtrag): bei hohem Inhalt scrollt nur der Inhalt */}
        <div className="sticky bottom-[calc(-1*max(var(--safe-bottom),16px))] -mx-4 -mb-[max(var(--safe-bottom),16px)] flex flex-col gap-4 border-t-[0.5px] border-separator bg-background px-4 pt-3 pb-[max(var(--safe-bottom),16px)]">
          {error && (
            <p role="alert" className="m-0 text-body text-destructive">
              {error}
            </p>
          )}
          {preview === null ? (
            <Button disabled={busy} onClick={() => void startCheck()}>
              {busy ? 'Wird geprüft …' : 'Folgen prüfen'}
            </Button>
          ) : (
            <Button disabled={busy || !sendable} onClick={() => void send()}>
              {busy ? 'Wird gesendet …' : feeChosen ? `Für ${formatEuro(preview.callOutCents)} Pauschale absagen` : 'Absagen'}
            </Button>
          )}
          <div className="flex flex-col">
            {preview !== null && (
              <Button
                variant="plain"
                disabled={busy}
                onClick={() => {
                  setPreview(null)
                  setChoice(null)
                  setError('')
                }}
              >
                Grund ändern
              </Button>
            )}
            <Button variant="plain" disabled={busy} onClick={close}>
              Doch nicht
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  )
}
