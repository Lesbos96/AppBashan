import { useState } from 'react'
import { Button } from '../../components/Button'
import { ErrorState, Loading } from '../../components/States'
import { type Offer, confirmOffer, loadOffers } from '../../lib/jobs'
import { formatEuro } from '../../lib/money'
import { useLoad } from '../../lib/prices'
import { Bestaetigen } from './Bestaetigen'

const until = (d: Date) => d.toLocaleString('de-AT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' })

/** Festangebote der Partner: Firma, Betrag, Frist. Der Kunde bestätigt genau den gezeigten Betrag. */
export function Angebote({ id, onDone }: { id: string; onDone: (notice?: string) => void }) {
  const [result, retry] = useLoad(() => loadOffers(id))
  const [pick, setPick] = useState<Offer | null>(null)
  if (result.status === 'loading') return <Loading label="Angebote laden" />
  if (result.status === 'error') return <ErrorState text="Die Angebote konnten nicht geladen werden. Prüfe deine Verbindung." onRetry={retry} />
  const offers = result.data
  return (
    <section aria-labelledby="angebote" className="flex flex-col gap-3 rounded-grouped-list bg-surface p-4 shadow-card">
      <h2 id="angebote" className="m-0 text-headline">
        Angebote
      </h2>
      {offers.length === 0 && <p className="m-0 text-body">Gerade liegt kein gültiges Angebot vor.</p>}
      {offers.map((o) => (
        <div key={o.id} className="flex flex-col gap-2 border-t-[0.5px] border-separator pt-3 first:border-t-0 first:pt-0">
          <span className="flex items-center justify-between gap-3">
            <span className="text-body break-words">{o.company}</span>
            <span className="whitespace-nowrap text-headline tabular-nums">{formatEuro(o.amountCents)}</span>
          </span>
          <span className="text-subhead text-text-secondary">Gültig bis {until(o.validUntil)}</span>
          <Button variant="tinted" aria-label={`Angebot von ${o.company} annehmen`} onClick={() => setPick(o)}>
            Annehmen
          </Button>
        </div>
      ))}
      <Bestaetigen
        open={pick !== null}
        onClose={() => setPick(null)}
        title="Angebot annehmen"
        label={pick ? `Für ${formatEuro(pick.amountCents)} annehmen` : 'Annehmen'}
        action={() => confirmOffer(pick!.id, pick!.amountCents)}
        onDone={onDone}
      >
        {pick && (
          <>
            <span className="flex items-center justify-between gap-3">
              <span className="text-body break-words">{pick.company}</span>
              <span className="whitespace-nowrap text-headline tabular-nums">{formatEuro(pick.amountCents)}</span>
            </span>
            <p className="m-0 text-subhead text-text-secondary">Mit der Annahme beauftragst du diese Firma verbindlich zu diesem Preis.</p>
          </>
        )}
      </Bestaetigen>
    </section>
  )
}
