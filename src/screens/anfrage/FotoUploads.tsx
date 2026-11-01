import { Icon } from '../../components/Icon'
import { Card } from '../../components/Surfaces'
import { failureText, removeUpload, retryUpload, useUploads } from '../../lib/uploads'

const action = 'press flex h-11 items-center px-2 text-[15px] font-medium text-accent'

/** Zustand der Foto-Uploads einer gerade gesendeten Anfrage: Fortschritt, Fehler je Foto mit erneutem Versuch, Entfernen. */
export function FotoUploads({ requestId }: { requestId: string }) {
  const uploads = useUploads(requestId)
  if (uploads.length === 0) return null
  const done = uploads.filter((u) => u.status === 'done').length

  return (
    <Card className="mt-4 flex w-full flex-col gap-1 px-4 py-3.5 text-left">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-headline">Fotos</h2>
        <span role="status" className="text-[13px] text-text-secondary tabular-nums">
          {done} von {uploads.length} hochgeladen
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {uploads.map((u, i) => (
          <li key={u.photo.id} className="flex items-start gap-3 py-1.5">
            <img src={u.photo.url} alt={`Foto ${i + 1}`} className="size-12 shrink-0 rounded-[10px] object-cover" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="flex min-h-6 items-center gap-1.5 pt-3 text-subhead">
                {u.status === 'done' && (
                  <>
                    <Icon name="check" width={16} height={16} className="shrink-0 text-accent" />
                    <span>Hochgeladen</span>
                  </>
                )}
                {(u.status === 'queued' || u.status === 'uploading') && (
                  <>
                    <span aria-hidden="true" className="size-4 shrink-0 animate-spin rounded-full border-2 border-text/25 border-t-accent motion-reduce:animate-none" />
                    <span className="text-text-secondary">{u.status === 'queued' ? 'Wartet …' : 'Wird hochgeladen …'}</span>
                  </>
                )}
                {u.status === 'error' && u.failure && (
                  <span role="alert" className="text-destructive">
                    {failureText[u.failure]}
                  </span>
                )}
              </span>
              {u.status !== 'uploading' && (
                <span className="-ml-2 flex flex-wrap gap-x-2">
                  {u.status === 'error' && (u.failure === 'offline' || u.failure === 'failed') && (
                    <button type="button" aria-label={`Foto ${i + 1} erneut versuchen`} onClick={() => retryUpload(requestId, u.photo.id)} className={action}>
                      Erneut versuchen
                    </button>
                  )}
                  <button type="button" aria-label={`Foto ${i + 1} entfernen`} onClick={() => void removeUpload(requestId, u.photo.id)} className={action}>
                    Entfernen
                  </button>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
