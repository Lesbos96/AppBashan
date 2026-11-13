import { useRef, useState, type ReactNode } from 'react'
import { Button } from '../../components/Button'
import { Sheet } from '../../components/Sheet'
import { Field, GroupedList, SelectField, SwitchRow } from '../../components/Surfaces'
import { JobError, jobErrorText } from '../../lib/jobs'
import { formatEuro } from '../../lib/money'
import { PhotoError, MAX_PHOTOS } from '../../lib/photos'
import { BelegFotos } from './Belege'
import { buildChanges, changeFields, previewChange, proposeChange, startDraft, uploadReceipt, type Draft, type JobChange, type Preview } from '../../lib/partnerChange'

const euro = (cents: number) => <span className="whitespace-nowrap tabular-nums">{formatEuro(cents)}</span>

function Zeile({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <p className="m-0 flex items-baseline justify-between gap-3 text-body">
      <span className="min-w-0 flex-1 text-text-secondary">{label}</span>
      <span className={`max-w-[70%] shrink-0 break-words text-right ${strong ? 'text-headline' : 'font-semibold'}`}>{children}</span>
    </p>
  )
}

/** Schließt das Sheet und lädt die Aufträge neu: die Anzeige ist veraltet oder der Server verweigert. */
const closes = (k: JobError['kind']) => k === 'closed' || k === 'change_open' || k === 'gone' || k === 'no_change' || k === 'unauthorized'

/**
 * Nachtrag vorschlagen: 1. Werte ändern, 2. Betrag vom Server ansehen (Vorschau, legt nichts an), 3. Belegfotos wählen und senden.
 * Fotos werden erst nach der Vorschau hochgeladen (jedes Foto zählt zur Grenze von 8 je Auftrag und ist dem Kunden sofort sichtbar);
 * schon hochgeladene Fotos bleiben bei einem Fehler erhalten und werden beim nächsten Senden wiederverwendet.
 */
export function NachtragSheet({ open, onClose, c, onDone }: { open: boolean; onClose: () => void; c: JobChange; onDone: (notice?: string) => void }) {
  const fields = changeFields(c.service, c.inputs)
  const [draft, setDraft] = useState<Draft>(() => startDraft(fields, c.inputs))
  const [step, setStep] = useState<'form' | 'proof'>('form')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [changes, setChanges] = useState<Record<string, unknown>>({})
  const [files, setFiles] = useState<File[]>([])
  const [uploaded, setUploaded] = useState<string[]>([])
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fileKey, setFileKey] = useState(0)
  const running = useRef(false)

  // Jedes Öffnen beginnt neu (die gebuchten Werte können sich seit dem letzten Mal geändert haben); Zustand beim Wechsel von `open` zurücksetzen
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraft(startDraft(fields, c.inputs))
      setStep('form')
      setPreview(null)
      setChanges({})
      setFiles([])
      setUploaded([])
      setTouched(false)
      setError('')
      setFileKey((k) => k + 1)
    }
  }

  const text = (e: unknown) => (e instanceof PhotoError ? e.message : jobErrorText[e instanceof JobError ? e.kind : 'unavailable'])

  async function check() {
    if (running.current) return
    const built = buildChanges(fields, c.inputs, draft)
    if ('error' in built) {
      setError(built.error)
      return
    }
    running.current = true
    setBusy(true)
    setError('')
    try {
      const p = await previewChange(c.requestId, built.changes)
      setChanges(built.changes)
      setPreview(p)
      setStep('proof')
    } catch (e) {
      const kind = e instanceof JobError ? e.kind : 'unavailable'
      if (closes(kind)) {
        onClose()
        onDone(jobErrorText[kind])
      } else setError(text(e))
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  // Vorhandene Belege (vom Server) und in dieser Sitzung hochgeladene als Menge: nach einem Neuladen im Hintergrund stünde dieselbe ID sonst doppelt in der Liste (Abnahme M1)
  const all = Array.from(new Set([...c.receiptIds, ...uploaded]))
  const have = all.length
  // Ein hochgeladenes Foto bleibt beim Server (Belege lassen sich nicht löschen): auch beim Schließen ohne Senden neu laden, damit es als vorhanden zählt (Abnahme M2)
  const close = () => {
    onClose()
    if (touched) onDone()
  }

  async function send() {
    if (running.current || !preview) return
    running.current = true
    setBusy(true)
    setError('')
    try {
      const ids = [...all]
      // Fotos nacheinander hochladen; jedes fertige Foto verlässt die Warteschlange und bleibt bei einem Fehler erhalten
      for (const f of files) {
        const id = await uploadReceipt(c.requestId, f)
        if (!ids.includes(id)) ids.push(id)
        setTouched(true)
        setUploaded((u) => [...u, id])
        setFiles((fs) => fs.filter((x) => x !== f))
      }
      await proposeChange(c.requestId, changes, ids, preview.totalCents)
      onClose()
      onDone('Dein Nachtrag liegt beim Kunden. Er bekommt eine Mail und entscheidet.')
    } catch (e) {
      const kind = e instanceof JobError ? e.kind : 'unavailable'
      if (kind === 'changed') {
        // Der Server rechnet anders als gezeigt: neuen Betrag holen und neu bestätigen lassen (nie automatisch senden)
        try {
          setPreview(await previewChange(c.requestId, changes))
          setError('Der Preis hat sich geändert. Prüfe den neuen Betrag und sende erneut.')
        } catch (e2) {
          const k2 = e2 instanceof JobError ? e2.kind : 'unavailable'
          if (closes(k2)) {
            onClose()
            onDone(jobErrorText[k2])
          } else setError(text(e2))
        }
      } else if (closes(kind)) {
        onClose()
        onDone(jobErrorText[kind])
      } else if (kind === 'not_increasing' || kind === 'bad_input') {
        setStep('form')
        setPreview(null)
        setError(text(e))
      } else setError(text(e))
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  const setField = (key: string, v: string | boolean) => setDraft((d) => ({ ...d, [key]: v }))
  const sendable = have + files.length >= 1 && have + files.length <= MAX_PHOTOS

  return (
    <Sheet open={open} onClose={close} locked={busy} title="Nachtrag vorschlagen" detents={[0.92]} fit>
      <div className="flex flex-col gap-4 pt-2">
        {step === 'form' && (
          <>
            <p className="m-0 text-subhead text-text-secondary">Ändere nur, was sich bei der Arbeit wirklich geändert hat. Den neuen Preis rechnet MoveNow. Ein Nachtrag kann den Preis nur erhöhen, und der Kunde muss zustimmen.</p>
            <GroupedList>
              {fields.map((f) =>
                f.kind === 'bool' ? (
                  <SwitchRow key={f.key} label={f.label} switchLabel={f.label} checked={draft[f.key] === true} onChange={(v) => setField(f.key, v)} />
                ) : f.kind === 'select' ? (
                  <SelectField key={f.key} label={f.label} disabled={busy} value={String(draft[f.key])} onChange={(e) => setField(f.key, e.target.value)}>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </SelectField>
                ) : (
                  <Field key={f.key} label={f.label} type="text" inputMode={f.kind === 'int' ? 'numeric' : 'decimal'} disabled={busy} value={String(draft[f.key])} onChange={(e) => setField(f.key, e.target.value)} />
                ),
              )}
            </GroupedList>
          </>
        )}

        {step === 'proof' && preview && (
          <>
            <div className="flex flex-col gap-2 rounded-grouped-list bg-surface p-4 shadow-card">
              <Zeile label="Bisheriger Preis">{euro(preview.baseCents)}</Zeile>
              <Zeile label="Mehr">{euro(preview.totalCents - preview.baseCents)}</Zeile>
              <Zeile label="Neuer Gesamtpreis" strong>
                {euro(preview.totalCents)}
              </Zeile>
            </div>
            <p className="m-0 text-subhead text-text-secondary">Der Kunde sieht den neuen Gesamtpreis und deine Belegfotos. Ohne seine Zustimmung gilt der bisherige Preis.</p>
            <BelegFotos have={have} files={files} setFiles={setFiles} fileKey={fileKey} setFileKey={setFileKey} busy={busy} />
          </>
        )}

        {/* Fehler und Knöpfe kleben am unteren Rand des Sheets: bei hohem Inhalt (320 px) scrollt nur der Inhalt, die Aktion bleibt erreichbar */}
        {/* Die Fußleiste reicht bis zur Sheet-Unterkante (Abstand des Scrollbereichs unten wird mit abgedeckt), sonst schaut Inhalt darunter hervor */}
        <div className="sticky bottom-[calc(-1*max(var(--safe-bottom),16px))] -mx-4 -mb-[max(var(--safe-bottom),16px)] flex flex-col gap-4 border-t-[0.5px] border-separator bg-background px-4 pt-3 pb-[max(var(--safe-bottom),16px)]">
          {error && (
            <p role="alert" className="m-0 text-body text-destructive">
              {error}
            </p>
          )}
          {step === 'form' ? (
            <Button disabled={busy} onClick={() => void check()}>
              {busy ? 'Wird berechnet …' : 'Betrag prüfen'}
            </Button>
          ) : (
            <Button disabled={busy || !sendable} onClick={() => void send()}>
              {busy ? 'Wird gesendet …' : preview ? `Nachtrag über ${formatEuro(preview.totalCents)} senden` : 'Senden'}
            </Button>
          )}
          {/* Die zwei schlichten Knöpfe stehen dicht beieinander unter dem Hauptknopf (kein leerer Block dazwischen) */}
          <div className="flex flex-col">
            {step === 'proof' && (
              <Button
                variant="plain"
                disabled={busy}
                onClick={() => {
                  setStep('form')
                  setError('')
                }}
              >
                Werte ändern
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
