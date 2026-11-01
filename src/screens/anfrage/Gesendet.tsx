import { Link, Navigate } from 'react-router'
import { ActionBar } from '../../components/Bars'
import { StatusChip } from '../../components/Controls'
import { Icon } from '../../components/Icon'
import { type Path, readSent, services } from '../../lib/draft'
import { formatEuro, formatEuroRounded } from '../../lib/money'
import { parseSnapshot, priceLabel } from '../../lib/quote'
import { FotoUploads } from './FotoUploads'
import { shortDayText } from './format'

const icons = { transport: 'sofa', umzug: 'boxes', entruempelung: 'basket', montage: 'drill' }

/** Bestätigung nach dem Senden. Der Preis steht hier nur, wenn `quote` ihn geliefert hat; bei Angebotspflicht gibt es keinen. */
export function Gesendet({ path }: { path: Path }) {
  const sent = readSent()
  if (!sent || sent.path !== path) return <Navigate to="/auftraege" replace />
  const snapshot = parseSnapshot(sent.snapshot)
  const price = snapshot?.kind === 'price' ? priceLabel(snapshot, path === 'entruempelung') : null
  const awaiting = sent.status === 'awaiting_offer'
  // Der Serverpreis ist maßgeblich. Weicht er vom zuletzt angezeigten Richtpreis ab (auch zu „Angebot nötig“), steht das sichtbar da, nie still.
  const estimate = path === 'entruempelung'
  const shown = sent.shownCents === null ? null : estimate ? `ca. ${formatEuroRounded(sent.shownCents)}` : formatEuro(sent.shownCents)
  const updated = shown !== null && snapshot !== null && (price === null || price.main !== shown)

  return (
    <main>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[300px] bg-[radial-gradient(ellipse_at_top,var(--tint),transparent_70%)]" />
      <div className="relative flex flex-col items-center px-5 pt-[88px] pb-48 text-center">
        <span className="relative flex size-[120px] items-center justify-center">
          <span aria-hidden="true" className="absolute -inset-4 rounded-full border border-accent/20" />
          <span aria-hidden="true" className="absolute -inset-8 rounded-full border border-accent/10" />
          <span role="img" aria-label="Erfolgreich gesendet" className="relative flex size-full items-center justify-center rounded-full bg-[image:var(--gradient-primary-button)] text-white shadow-primary-button">
            <Icon name="check" width={56} height={56} />
          </span>
        </span>
        <h1 className="m-0 mt-7 text-title1">Anfrage gesendet.</h1>
        <p className="m-0 mt-2 max-w-[320px] text-body text-text-secondary">
          {sent.needsQuote ? 'Wir melden uns mit einem Angebot, sobald ein Partner deinen Auftrag geprüft hat.' : 'Der Partner prüft deine Angaben und bestätigt Termin und Preis. Wir melden uns, sobald er antwortet.'}
        </p>

        {updated && (
          <p role="status" className="m-0 mt-6 w-full rounded-grouped-list bg-tint p-4 text-left text-subhead text-text">
            <span className="block font-semibold">Der Preis wurde aktualisiert.</span>
            <span className="block text-text">Vorher angezeigt: <span className="whitespace-nowrap tabular-nums">{shown}</span></span>
          </p>
        )}

        <Link to="/auftraege" className={`press ${updated ? 'mt-4' : 'mt-8'} flex w-full flex-col gap-3 rounded-grouped-list bg-surface p-4 text-left shadow-card`}>
          <span className="flex items-start gap-3">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-icon-tile bg-tint text-accent">
              <Icon name={icons[path]} width={22} height={22} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-headline text-text">{services[path].title}</span>
              <span className="text-subhead break-words text-text-secondary">{[shortDayText(sent.date), sent.route].filter(Boolean).join(' · ')}</span>
            </span>
          </span>
          <span aria-hidden="true" className="h-[0.5px] bg-separator" />
          <span className="flex items-center justify-between gap-3">
            <StatusChip status={awaiting ? 'review' : 'requested'}>{awaiting ? 'Wartet auf Angebot' : 'Angefragt'}</StatusChip>
            {price ? (
              <span className="flex flex-col items-end">
                <span className="text-[12.5px]/4 text-text-secondary">Richtpreis</span>
                <span className="whitespace-nowrap text-headline tabular-nums">{price.main}</span>
                {price.range && <span className="whitespace-nowrap text-[13px]/4 text-text-secondary tabular-nums">{price.range}</span>}
              </span>
            ) : (
              <span className="text-subhead text-text-secondary">{sent.needsQuote ? 'Preis nach Prüfung' : 'Preis siehe Aufträge'}</span>
            )}
          </span>
        </Link>
        <FotoUploads requestId={sent.id} />
      </div>
      <ActionBar>
        <div className="flex w-full flex-col">
          <Link to="/auftraege" className="press flex h-[54px] items-center justify-center rounded-button-primary bg-[image:var(--gradient-primary-button)] text-headline text-white shadow-primary-button">
            Zu meinen Aufträgen
          </Link>
          <Link to="/" className="press flex h-12 items-center justify-center text-body font-medium text-accent">
            Zur Startseite
          </Link>
        </div>
      </ActionBar>
    </main>
  )
}
