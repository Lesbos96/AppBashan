import { useRef, useState, type ReactNode } from 'react'
import { Button } from '../../components/Button'
import { Sheet } from '../../components/Sheet'
import { Field, GroupedList, SelectField, SwitchRow } from '../../components/Surfaces'
import { JobError, jobErrorText } from '../../lib/jobs'
import { formatEuro } from '../../lib/money'
import { PhotoError, MAX_PHOTOS } from '../../lib/photos'
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

  const have = c.receiptIds.length + uploaded.length
  const room = MAX_PHOTOS - have

  async function send() {
    if (running.current || !preview) return
    running.current = true
    setBusy(true)
    setError('')
    try {
      const ids = [...c.receiptIds, ...uploaded]
      // Fotos nacheinander hochladen; jedes fertige Foto verlässt die Warteschlange und bleibt bei einem Fehler erhalten
      for (const f of files) {
        const id = await uploadReceipt(c.requestId, f)
        ids.push(id)
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
          setError(text(e2))
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
  const full = files.length >= room
  const sendable = have + files.length >= 1 && have + files.length <= MAX_PHOTOS

  return (
    <Sheet open={open} onClose={onClose} locked={busy} title="Nachtrag vorschlagen" detents={[0.92]} fit>
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
            <GroupedList title="Belegfotos">
              <li className="flex flex-col gap-1 px-4 py-3">
                {have === 0 && files.length === 0 && <span className="text-body">Noch kein Foto</span>}
                {have > 0 && <span className="text-body">{have === 1 ? '1 Foto schon hochgeladen' : `${have} Fotos schon hochgeladen`}</span>}
                {files.length > 0 && <span className="text-body">{files.length === 1 ? '1 Foto wird beim Senden hochgeladen' : `${files.length} Fotos werden beim Senden hochgeladen`}</span>}
                <span className="text-footnote text-text-secondary">Mindestens ein Foto, höchstens {MAX_PHOTOS} je Auftrag. Gelöscht werden sie nicht.</span>
              </li>
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex min-h-12 items-center justify-between gap-3 px-4">
                  <span className="min-w-0 truncate text-body">{f.name}</span>
                  <button type="button" disabled={busy} onClick={() => setFiles((fs) => fs.filter((x) => x !== f))} aria-label={`Foto entfernen: ${f.name}`} className="press min-h-11 shrink-0 px-2 text-[16px] font-medium text-accent disabled:opacity-40">
                    Entfernen
                  </button>
                </li>
              ))}
              <li className="relative">
                <label className="flex min-h-12 items-center gap-3 px-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent">
                  <span className="shrink-0 text-body">Foto</span>
                  <span className={`min-w-0 flex-1 truncate text-right text-body ${full ? 'text-text-tertiary' : 'text-accent'}`}>{full ? 'Höchstzahl erreicht' : 'Hinzufügen'}</span>
                  <input
                    key={fileKey}
                    type="file"
                    multiple
                    aria-label="Belegfoto hinzufügen"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy || full}
                    onChange={(e) => {
                      const list = Array.from(e.target.files ?? []).slice(0, Math.max(0, room - files.length))
                      setFiles((fs) => [...fs, ...list])
                      setFileKey((k) => k + 1)
                    }}
                    className="sr-only"
                  />
                </label>
              </li>
            </GroupedList>
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
            <Button variant="plain" disabled={busy} onClick={onClose}>
              Doch nicht
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  )
}
