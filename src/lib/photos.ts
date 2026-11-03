import { useSyncExternalStore } from 'react'

export const MAX_PHOTOS = 8
export const MAX_BYTES = 10 * 1024 * 1024
const MAX_EDGE = 2000
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

export class PhotoError extends Error {}

export type Photo = { id: string; blob: Blob; url: string }

/**
 * Prüft Größe und Format und kodiert das Bild neu. Die Neu-Kodierung über Canvas entfernt EXIF (Standort, Gerät);
 * die Ausrichtung ist vorher angewandt. Das Original bleibt nie erhalten.
 */
export async function preparePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new PhotoError('Das ist kein Bild.')
  if (/^image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    throw new PhotoError('HEIC-Fotos gehen hier nicht. Stelle die Kamera auf „Maximale Kompatibilität“ oder wähle ein JPEG, PNG oder WebP.')
  }
  if (!ACCEPTED.includes(file.type)) throw new PhotoError('Dieses Format geht nicht. Nimm ein JPEG, PNG oder WebP.')
  if (file.size > MAX_BYTES) throw new PhotoError('Das Foto ist größer als 10 MB.')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new PhotoError('Dieses Bild lässt sich nicht lesen. Nimm ein JPEG, PNG oder WebP.')
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new PhotoError('Dieses Bild lässt sich nicht verarbeiten.')
  }
  // Transparente PNG würden als JPEG schwarz: erst weiß füllen
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
  if (!blob || blob.size > MAX_BYTES) throw new PhotoError('Dieses Bild lässt sich nicht verarbeiten.')
  return blob
}

// Fotos liegen nur im Speicher (Blobs passen nicht in den sessionStorage); die Zusammenfassung lädt sie vor dem Absenden ins Staging (`uploads.ts`).
const store = new Map<string, Photo[]>()
const listeners = new Set<() => void>()
const empty: Photo[] = []

function set(key: string, photos: Photo[]) {
  store.set(key, photos)
  listeners.forEach((l) => l())
}

export const getPhotos = (key: string): readonly Photo[] => store.get(key) ?? empty

/** Nach dem Absenden: Speicher des Flows leeren und die Object-URLs freigeben. */
export function clearPhotos(key: string): void {
  getPhotos(key).forEach((p) => URL.revokeObjectURL(p.url))
  set(key, empty)
}

/** Neue Dateinamen für alle Fotos (nach `photo_missing`/`photo_expired`): die alte Staging-Datei lässt sich nicht überschreiben. */
export function renewPhotoIds(key: string): void {
  set(key, getPhotos(key).map((p) => ({ ...p, id: crypto.randomUUID() })))
}

export function usePhotos(key: string) {
  const photos = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => store.get(key) ?? empty,
  )
  return {
    photos,
    /** Gibt die Fehlermeldung zurück, wenn ein Foto abgelehnt wurde; die übrigen werden trotzdem übernommen. */
    async add(files: File[]): Promise<string | null> {
      let error: string | null = null
      const added: Photo[] = []
      for (const file of files) {
        if ((store.get(key) ?? empty).length + added.length >= MAX_PHOTOS) {
          error = `Mehr als ${MAX_PHOTOS} Fotos gehen nicht.`
          break
        }
        try {
          const blob = await preparePhoto(file)
          added.push({ id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob) })
        } catch (e) {
          error = e instanceof PhotoError ? e.message : 'Das Foto konnte nicht übernommen werden.'
        }
      }
      // auf den aktuellen Stand aufsetzen: Fotos, die währenddessen entfernt wurden, kommen nicht zurück
      set(key, [...(store.get(key) ?? empty), ...added].slice(0, MAX_PHOTOS))
      return error
    },
    remove(id: string) {
      const gone = (store.get(key) ?? empty).find((p) => p.id === id)
      if (gone) URL.revokeObjectURL(gone.url)
      set(key, (store.get(key) ?? empty).filter((p) => p.id !== id))
    },
  }
}
