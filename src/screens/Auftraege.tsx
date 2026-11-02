import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { NavBar } from '../components/Bars'
import { Segmented, StatusChip } from '../components/Controls'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, Loading } from '../components/States'
import { useLoad } from '../lib/prices'
import { parseSnapshot, priceLabel } from '../lib/quote'
import { useSession } from '../lib/session'
import { supabase } from '../lib/supabase'
import { shortDayText } from './anfrage/format'

const COLUMNS = 'id, service, status, preferred_date, from_address, to_address, created_at, price_revisions!service_requests_current_revision(snapshot)'
const titles = { transport: 'Möbeltransport', move: 'Umzug', clearance: 'Entrümpelung', assembly: 'Montage' }
const icons = { transport: 'sofa', move: 'boxes', clearance: 'basket', assembly: 'drill' }
type Chip = { chip: 'requested' | 'review' | 'confirmed' | 'done'; label: string; active: boolean }
const states: Record<string, Chip> = {
  requested: { chip: 'requested', label: 'Angefragt', active: true },
  awaiting_offer: { chip: 'review', label: 'Wartet auf Angebot', active: true },
  offered: { chip: 'review', label: 'Angebot liegt vor', active: true },
  accepted: { chip: 'confirmed', label: 'Bestätigt', active: true },
  in_progress: { chip: 'confirmed', label: 'Läuft', active: true },
  completed: { chip: 'done', label: 'Erledigt', active: false },
  withdrawn: { chip: 'done', label: 'Zurückgezogen', active: false },
  expired: { chip: 'done', label: 'Abgelaufen', active: false },
  declined: { chip: 'done', label: 'Abgelehnt', active: false },
  unmatched: { chip: 'done', label: 'Kein Partner gefunden', active: false },
  cancelled_by_customer: { chip: 'done', label: 'Storniert', active: false },
  cancelled_by_partner: { chip: 'done', label: 'Storniert', active: false },
}

type Item = { id: string; icon: string; title: string; line: string; chip: Chip; price: string | null }
const first = (a: string | null) => a?.split(',')[0]?.trim()

/** Eigene Anfragen. Die RLS-Regel „admin liest alles“ gilt hier nicht: Filter auf die eigene Nutzer-ID und nur die Spalten der Liste. */
async function load(userId: string): Promise<Item[]> {
  const { data, error } = await supabase.from('service_requests').select(COLUMNS).eq('customer_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  return data.map((r) => {
    const snapshot = parseSnapshot(r.price_revisions?.snapshot)
    return {
      id: r.id,
      icon: icons[r.service],
      title: titles[r.service],
      line: [shortDayText(r.preferred_date), [first(r.from_address), first(r.to_address)].filter(Boolean).join(' → ')].filter(Boolean).join(' · '),
      chip: states[r.status] ?? { chip: 'review', label: 'In Prüfung', active: true },
      price: snapshot?.kind === 'price' ? priceLabel(snapshot).main : null,
    }
  })
}

export function Auftraege() {
  const session = useSession()
  return (
    <main>
      <NavBar title="Aufträge" />
      {session === undefined && <Loading label="Aufträge laden" />}
      {session === null && <Navigate to="/anmelden?next=%2Fauftraege" replace />}
      {session && <Liste key={session.user.id} userId={session.user.id} />}
    </main>
  )
}

function Liste({ userId }: { userId: string }) {
  const [result, retry] = useLoad(() => load(userId))
  const [tab, setTab] = useState('active')
  const items = result.status === 'ready' ? result.data : []
  const active = items.filter((i) => i.chip.active)
  const shown = tab === 'active' ? active : items.filter((i) => !i.chip.active)

  return (
    <>
      {result.status === 'loading' && <Loading label="Aufträge laden" />}
      {result.status === 'error' && <ErrorState text="Die Aufträge konnten nicht geladen werden. Prüfe deine Verbindung." onRetry={retry} />}
      {result.status === 'ready' && items.length === 0 && (
        <EmptyState illustration="empty-orders" title="Noch keine Aufträge" text="Plane deinen ersten Move. Den Richtpreis siehst du sofort.">
          <Link to="/" className="press flex h-[50px] items-center rounded-button-secondary bg-tint px-[26px] text-headline text-accent">
            Service wählen
          </Link>
        </EmptyState>
      )}
      {result.status === 'ready' && items.length > 0 && (
        <div className="flex flex-col gap-3 px-5 pt-2 pb-8">
          <Segmented
            label="Filter"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'active', label: `Aktiv · ${active.length}` },
              { value: 'done', label: items.length > active.length ? `Erledigt · ${items.length - active.length}` : 'Erledigt' },
            ]}
          />
          {shown.length === 0 && <p className="m-0 py-8 text-center text-body text-text-secondary">Hier ist nichts.</p>}
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {shown.map((i) => (
              <li key={i.id} className="flex flex-col gap-3 rounded-grouped-list bg-surface p-4 shadow-card">
                <span className="flex items-start gap-3">
                  <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-icon-tile bg-tint text-accent">
                    <Icon name={i.icon} width={22} height={22} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-headline">{i.title}</span>
                    {i.line && <span className="text-subhead break-words text-text-secondary">{i.line}</span>}
                  </span>
                </span>
                <span className="flex items-center justify-between gap-3 border-t-[0.5px] border-separator pt-3">
                  <StatusChip status={i.chip.chip}>{i.chip.label}</StatusChip>
                  {i.price ? <span className="whitespace-nowrap text-headline tabular-nums">{i.price}</span> : <span className="text-subhead text-text-secondary">Preis nach Prüfung</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="m-0 px-4 pt-2 text-center text-footnote text-text-secondary">Richtpreise sind unverbindlich. Termin und Preis bestätigt der Partner.</p>
        </div>
      )}
    </>
  )
}
