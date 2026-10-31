import { Link } from 'react-router'
import { NavBar } from '../components/Bars'
import { EmptyState } from '../components/States'

// Die Liste kommt mit S8b; bis dahin gibt es ohne Konto nichts anzuzeigen.
export function Auftraege() {
  return (
    <main>
      <NavBar title="Aufträge" />
      <EmptyState illustration="empty-orders" title="Noch keine Aufträge" text="Plane deinen ersten Move. Den Richtpreis siehst du sofort.">
        <Link to="/" className="press flex h-[50px] items-center rounded-button-secondary bg-tint px-[26px] text-headline text-accent">
          Service wählen
        </Link>
      </EmptyState>
    </main>
  )
}
