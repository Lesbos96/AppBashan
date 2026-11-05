import type { ReactNode } from 'react'
import { Button } from './Button'
import { Illustration } from './Illustration'

/** Leerer Zustand: Illustration, Titel, Text, optional eine Aktion. */
export function EmptyState({ illustration, title, text, children }: { illustration: string; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-8 pt-16 text-center">
      <Illustration name={illustration} width={230} className="mb-3 h-auto" />
      <h2 className="m-0 text-title2">{title}</h2>
      <p className="m-0 mb-4 max-w-[300px] text-body text-text-secondary">{text}</p>
      {children}
    </div>
  )
}

export function Loading({ label = 'Lädt' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 px-8 py-12 text-text-secondary">
      <span aria-hidden="true" className="size-7 animate-spin rounded-full border-[3px] border-text/25 border-t-accent motion-reduce:animate-none" />
      <span className="text-subhead">{label} …</span>
    </div>
  )
}

/** `heading`: h2 innerhalb einer Seite mit eigenem h1, h1 auf der Fehlerseite (dort ist der Fehler die Seite). */
export function ErrorState({ title = 'Das hat nicht geklappt', text, onRetry, heading: Heading = 'h2' }: { title?: string; text: string; onRetry?: () => void; heading?: 'h1' | 'h2' }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-8 py-12 text-center">
      <Heading className="m-0 text-title3">{title}</Heading>
      <p className="m-0 mb-3 max-w-[32ch] text-body text-text-secondary">{text}</p>
      {onRetry && (
        <Button variant="tinted" onClick={onRetry} className="w-auto">
          Erneut versuchen
        </Button>
      )}
    </div>
  )
}
