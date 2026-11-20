import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import { NavBar } from '../components/Bars'
import { Button } from '../components/Button'
import { Illustration } from '../components/Illustration'
import { EmptyState, ErrorState } from '../components/States'

/** Für Wege, die in späteren Schritten gebaut werden. */
export function Folgt({ title, back: backTo }: { title: string; back?: { to: string; label: string } }) {
  return (
    <main>
      <NavBar title={title} back={backTo} />
      <EmptyState illustration="empty-orders" title="Dieser Bereich ist noch nicht verfügbar" text="Er kommt in einem der nächsten Schritte." />
    </main>
  )
}

export function Fehler() {
  const error = useRouteError()
  const notFound = error === undefined || (typeof error === 'object' && error !== null && 'status' in error && error.status === 404)
  // Die Fehlerseite liegt außerhalb der Shell und setzt ihren Titel selbst (WCAG 2.4.2)
  useEffect(() => {
    document.title = `${notFound ? 'Seite nicht gefunden' : 'Fehler'} · MoveNow`
  }, [notFound])
  return (
    <main className="mx-auto flex min-h-dvh max-w-(--content-max-width) flex-col justify-center">
      <Illustration name="empty-orders" width={200} className="mx-auto h-auto" />
      <ErrorState
        heading="h1"
        title={notFound ? 'Seite nicht gefunden' : 'Da ist etwas schiefgelaufen'}
        text={notFound ? 'Diesen Link gibt es nicht.' : 'Lade die Seite neu. Besteht das Problem weiter, versuche es später noch einmal.'}
      />
      <div className="px-8">
        <Button onClick={() => (notFound ? window.location.assign('/') : window.location.reload())}>{notFound ? 'Zum Start' : 'Neu laden'}</Button>
      </div>
    </main>
  )
}
