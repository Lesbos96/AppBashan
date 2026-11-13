import { GroupedList } from '../../components/Surfaces'
import { MAX_PHOTOS } from '../../lib/photos'

/**
 * Belegfotos wählen (Nachtrag und Absage mit Pauschale): schon hochgeladene (`have`) und gewählte Dateien, die erst beim Senden hochgeladen werden.
 * Hochgeladen wird nie hier; die aufrufende Maske lädt nach der Vorschau hoch und führt die IDs.
 */
export function BelegFotos({
  have,
  files,
  setFiles,
  fileKey,
  setFileKey,
  busy,
}: {
  have: number
  files: File[]
  setFiles: (f: (fs: File[]) => File[]) => void
  fileKey: number
  setFileKey: (f: (k: number) => number) => void
  busy: boolean
}) {
  const room = MAX_PHOTOS - have
  const full = files.length >= room
  return (
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
  )
}
