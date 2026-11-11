import { useRef, useState, type FormEvent } from 'react'
import { Button } from '../../components/Button'
import { ErrorState, Loading } from '../../components/States'
import { Card, GroupedList, ListRow, SelectField } from '../../components/Surfaces'
import { createDocument, DOC_KINDS, DocError, docErrorMessage, kindLabel, loadDocuments, MAX_DOCS, prepareDocument, uploadDocument, type DocKind } from '../../lib/partnerDocs'
import { loadMfaState } from '../../lib/mfa'
import { useLoad } from '../../lib/prices'

const day = (iso: string) => new Date(iso).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Vienna' })

/**
 * Nachweise der Firma (Gewerbeberechtigung, Firmenbuchauszug, Sonstiges). Ablauf je Datei: prüfen, Zeile anlegen, Datei auf dieselbe `id` laden.
 * Eine Zeile ohne Datei (Upload abgebrochen) bleibt stehen, weil Partner nichts löschen können: „Erneut hochladen“ lädt auf dieselbe `id` nach.
 * `onDenied`: der Server hat verweigert und die Sitzung steht nicht mehr auf aal2 → zurück zur Schranke.
 */
export function Dokumente({ partnerId, onDenied }: { partnerId: string; onDenied: () => void }) {
  const [docs, reload] = useLoad(() => loadDocuments(partnerId))
  const [kind, setKind] = useState<DocKind>('trade_license')
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const running = useRef(false)
  const retryId = useRef<string | null>(null)
  const retryInput = useRef<HTMLInputElement>(null)

  /** Führt den Ablauf aus (neu: Zeile + Datei, nachladen: nur Datei) und ordnet Fehler zu. */
  async function run(f: File, existing: string | null) {
    if (running.current) return
    running.current = true
    setBusy(true)
    setError('')
    setDone('')
    try {
      const { blob, contentType } = await prepareDocument(f)
      const id = existing ?? (await createDocument(kind))
      await uploadDocument(partnerId, id, blob, contentType)
      setDone('Dokument hochgeladen.')
      setFile(null)
      setFileKey((k) => k + 1)
    } catch (e) {
      if (e instanceof DocError && e.kind === 'denied') {
        // Nicht blind „kein aal2“ annehmen: erst den Token lesen, sonst entsteht eine Schleife
        const state = await loadMfaState().catch(() => null)
        if (state && state.step !== 'done') {
          onDenied()
          return
        }
      }
      setError(docErrorMessage(e))
    } finally {
      running.current = false
      setBusy(false)
      reload()
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (file) void run(file, null)
  }
  const full = docs.status === 'ready' && docs.data.length >= MAX_DOCS

  return (
    <div className="flex flex-col gap-5 px-5 pb-8">
      <Card className="flex flex-col gap-2 p-4">
        <h2 className="m-0 text-title3">Dokumente</h2>
        <p className="m-0 text-body text-text-secondary">Lade deine Nachweise hoch, zum Beispiel Gewerbeberechtigung und Firmenbuchauszug. PDF oder Foto, bis 10 MB, höchstens 5 Dokumente.</p>
        <p className="m-0 text-footnote text-text-secondary">Hochgeladene Dokumente kannst du nicht selbst löschen und nicht ersetzen. Prüfe die Datei vor dem Hochladen.</p>
      </Card>

      {docs.status === 'loading' && <Loading label="Dokumente laden" />}
      {docs.status === 'error' && <ErrorState text="Die Dokumente konnten nicht geladen werden. Prüfe deine Verbindung." onRetry={reload} />}
      {docs.status === 'ready' &&
        (docs.data.length === 0 ? (
          <p className="m-0 px-4 text-body text-text-secondary">Noch keine Dokumente.</p>
        ) : (
          <GroupedList title="Hochgeladen">
            {docs.data.map((d) => (
              <ListRow
                key={d.id}
                label={kindLabel(d.kind)}
                detail={d.hasFile ? `Hochgeladen am ${day(d.uploaded_at)}` : 'Datei fehlt'}
                trailing={
                  d.hasFile ? undefined : (
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Datei erneut hochladen: ${kindLabel(d.kind)}`}
                      onClick={() => {
                        retryId.current = d.id
                        retryInput.current?.click()
                      }}
                      className="press min-h-11 shrink-0 rounded-button-secondary px-3 text-[16px] font-medium text-accent disabled:opacity-40"
                    >
                      Erneut hochladen
                    </button>
                  )
                }
              />
            ))}
          </GroupedList>
        ))}
      {/* gemeinsames, verstecktes Feld für „Erneut hochladen“; die Zeile merkt sich, welche id gemeint ist */}
      <input
        ref={retryInput}
        type="file"
        hidden
        accept="application/pdf,image/jpeg,image/png,image/webp"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0]
          const id = retryId.current
          e.target.value = ''
          if (f && id) void run(f, id)
        }}
      />

      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <GroupedList title="Neues Dokument">
          <SelectField label="Art" value={kind} disabled={busy || full} onChange={(e) => setKind(e.target.value as DocKind)}>
            {DOC_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </SelectField>
          <li className="relative border-t-[0.5px] border-separator first:border-t-0">
            {/* Das echte Feld bleibt für Tastatur und Screenreader erreichbar, sichtbar ist der deutsche Text (das Feld spricht sonst die Browsersprache) */}
            <label className="flex min-h-12 items-center gap-3 px-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent">
              <span className="shrink-0 text-body">Datei</span>
              <span className={`min-w-0 flex-1 truncate text-right text-body ${file ? 'text-text-tertiary' : 'text-accent'}`}>{file ? file.name : 'Auswählen'}</span>
              <input
                key={fileKey}
                type="file"
                aria-label="Datei"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={busy || full}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </label>
          </li>
        </GroupedList>
        {full && <p className="m-0 px-4 text-footnote text-text-secondary">Du hast das Maximum erreicht. Mehr Dokumente gehen nicht.</p>}
        <p role="status" className="m-0 px-1 text-body empty:sr-only">
          {done}
        </p>
        {error && (
          <p role="alert" className="m-0 px-1 text-body text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={!file || busy || full}>
          {busy ? 'Wird hochgeladen …' : 'Hochladen'}
        </Button>
      </form>
    </div>
  )
}
