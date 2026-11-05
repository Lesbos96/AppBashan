import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import { NavBar } from '../components/Bars'
import { Button } from '../components/Button'
import { Illustration } from '../components/Illustration'
import { EmptyState, ErrorState } from '../components/States'
import { Card } from '../components/Surfaces'

const back = { to: '/profil', label: 'Profil' }

function Platzhaltertext({ title, children }: { title: string; children: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 text-title3">{title}</h2>
      <p className="m-0 text-body text-text-secondary">{children}</p>
    </section>
  )
}

// Rechtstexte liefert der Betreiber; bis dahin stehen hier markierte Platzhalter.
export function Datenschutz() {
  return (
    <main>
      <NavBar title="Datenschutz" back={back} />
      <div className="px-5 pt-4">
        <Card className="flex flex-col gap-5 p-5">
          <p className="m-0 rounded-chip bg-status-requested-bg px-3 py-2 text-footnote text-status-requested-text">Platzhalter: Der Text folgt vor dem Start.</p>
          <Platzhaltertext title="Verantwortlicher">Name und Anschrift des Betreibers folgen.</Platzhaltertext>
          <Platzhaltertext title="Welche Daten wir verarbeiten">Angaben zu deiner Anfrage, Adressen, Fotos und deine E-Mail-Adresse. Die Einzelheiten folgen.</Platzhaltertext>
          <Platzhaltertext title="Deine Rechte">Auskunft, Berichtigung, Löschung und Widerspruch. Die Einzelheiten folgen.</Platzhaltertext>
        </Card>
      </div>
    </main>
  )
}

export function Impressum() {
  return (
    <main>
      <NavBar title="Impressum & AGB" back={back} />
      <div className="px-5 pt-4">
        <Card className="flex flex-col gap-5 p-5">
          <p className="m-0 rounded-chip bg-status-requested-bg px-3 py-2 text-footnote text-status-requested-text">Platzhalter: Die Texte folgen vor dem Start.</p>
          <Platzhaltertext title="Impressum">Firma, Anschrift, Kontakt, UID-Nummer und Firmenbuchangaben folgen.</Platzhaltertext>
          <Platzhaltertext title="Allgemeine Geschäftsbedingungen">Die Bedingungen für die Vermittlung folgen.</Platzhaltertext>
        </Card>
      </div>
    </main>
  )
}

/** Für Wege, die in späteren Schritten gebaut werden. */
export function Folgt({ title, back: backTo }: { title: string; back?: typeof back }) {
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
