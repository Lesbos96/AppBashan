import { useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Card } from '../../components/Surfaces'
import { MAX_PHOTOS, usePhotos } from '../../lib/photos'

const pick = 'press flex h-[58px] flex-col items-center justify-center gap-0.5 rounded-[14px] bg-tint text-[11px] font-semibold text-accent disabled:opacity-40'

/** Fotos aus Kamera oder Galerie; EXIF wird beim Übernehmen entfernt (siehe `preparePhoto`). */
export function Fotos({ storeKey }: { storeKey: string }) {
  const { photos, add, remove } = usePhotos(storeKey)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const full = photos.length >= MAX_PHOTOS

  async function onFiles(input: HTMLInputElement) {
    const files = [...(input.files ?? [])]
    input.value = ''
    setBusy(true)
    setError(await add(files))
    setBusy(false)
  }

  return (
    <>
      <Card className="flex flex-col gap-3 px-4 py-3.5">
        <div className="flex items-baseline justify-between">
          <h3 className="m-0 text-headline">Fotos</h3>
          <span className="text-[13px] text-text-secondary tabular-nums">
            {photos.length} von {MAX_PHOTOS}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-[7px]">
          <button type="button" aria-label="Foto aufnehmen" disabled={full || busy} onClick={() => camera.current?.click()} className={pick}>
            <Icon name="camera" width={22} height={22} />
            Kamera
          </button>
          <button type="button" aria-label="Fotos aus der Galerie wählen" disabled={full || busy} onClick={() => gallery.current?.click()} className={pick}>
            <Icon name="gallery" width={22} height={22} />
            Galerie
          </button>
          {photos.map((p, i) => (
            <div key={p.id} className="relative h-[58px]">
              <img src={p.url} alt={`Foto ${i + 1}`} className="size-full rounded-[14px] object-cover" />
              <button type="button" aria-label={`Foto ${i + 1} entfernen`} onClick={() => remove(p.id)} className="absolute -top-4 -right-4 flex size-11 items-center justify-center">
                <span className="flex size-5 items-center justify-center rounded-full bg-text/70 text-white shadow-[0_0_0_2px_var(--surface)]">
                  <Icon name="close" width={10} height={10} strokeWidth={3.2} />
                </span>
              </button>
            </div>
          ))}
        </div>
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onFiles(e.currentTarget)} />
        <input ref={gallery} type="file" accept="image/*" multiple hidden onChange={(e) => void onFiles(e.currentTarget)} />
      </Card>
      <p role={error ? 'alert' : undefined} className={`m-0 mt-2 px-1 text-footnote ${error ? 'text-destructive' : 'text-text-secondary'}`}>
        {error ?? 'Bis zu 8 Fotos, je max. 10 MB. Zeig Möbel, Räume und Zugänge.'}
      </p>
    </>
  )
}
