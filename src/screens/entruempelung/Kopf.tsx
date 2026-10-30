import type { ReactNode } from 'react'
import { Icon } from '../../components/Icon'

export const backClass = 'press flex size-11 items-center justify-center text-accent'

export const BackIcon = () => <Icon name="chevron-left" width={24} height={24} strokeWidth={2.2} />

/** Kompakter Kopf der Entrümpelung (06, 07): Zurück links, Titel mittig, ohne Large Title. */
export function Kopf({ back }: { back: ReactNode }) {
  return (
    <header className="pt-safe">
      <div className="relative flex h-11 items-center justify-center">
        <div className="absolute top-0 left-2">{back}</div>
        <span className="text-headline">Entrümpelung</span>
      </div>
    </header>
  )
}
