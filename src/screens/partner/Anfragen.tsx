import { useState, type ReactNode } from 'react'
import { Button } from '../../components/Button'
import { Sheet } from '../../components/Sheet'
import { ErrorState, Loading } from '../../components/States'
import { Field, GroupedList } from '../../components/Surfaces'
import { formatEuro } from '../../lib/money'
import {
  acceptListing,
  dayLabel,
  loadListings,
  loadMyOffers,
  loadPhotos,
  loadRates,
  parseEuro,
  payoutCents,
  scopeLines,
  sendOffer,
  serviceLabel,
  viennaTime,
  windowLabel,
  withdrawOffer,
  type Listing,
  type MyOffer,
  type Rates,
} from '../../lib/partnerJobs'
import { useLoad } from '../../lib/prices'
import { Bestaetigen } from '../auftrag/Bestaetigen'

const box = 'flex flex-col gap-3 rounded-grouped-list bg-surface p-4 shadow-card'
const euro = (cents: number) => <span className="whitespace-nowrap tabular-nums">{formatEuro(cents)}</span>

function Zeile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="m-0 flex flex-wrap items-baseline justify-between gap-x-3 text-body">
      <span className="min-w-0 text-text-secondary">{label}</span>
      <span className="ml-auto text-right font-semibold">{children}</span>
    </p>
  )
}

/**
 * Offene Anfragen der Firma (nur Status active mit aal2), Annahme, Festangebot und eigene Angebote. Angenommene Aufträge zeigt `PartnerAuftraege`
 * (aus `my_jobs()`); `onChange` meldet dorthin, dass sich etwas geändert hat. Der Server entscheidet über alles.
 */
export function Anfragen({ onChange }: { onChange: () => void }) {
  const [listings, reloadListings] = useLoad(loadListings)
  const [offers, reloadOffers] = useLoad(loadMyOffers)
  const [rates, reloadRates] = useLoad(loadRates)
  const [notice, setNotice] = useState('')

  // Nach jeder Aktion alles neu laden: Anfragen, eigene Angebote und den Satz (er kann zwischen Anzeige und Annahme gewechselt haben)
  const refresh = (n?: string) => {
    setNotice(n ?? '')
    reloadListings()
    reloadOffers()
    reloadRates()
    onChange()
  }

  if (listings.status === 'loading') return <Loading label="Anfragen laden" />
  if (listings.status === 'error') return <ErrorState text="Die Anfragen konnten nicht geladen werden. Prüfe deine Verbindung." onRetry={reloadListings} />
  const open = listings.data.filter((l) => l.status === 'open')
  const mine = offers.status === 'ready' ? offers.data : []
  const r = rates.status === 'ready' ? rates.data : null

  return (
    <>
      {notice && (
        <div className="px-5 pb-4">
          <p role="status" className="m-0 rounded-grouped-list bg-surface p-4 text-body shadow-card">
            {notice}
          </p>
        </div>
      )}
      <section aria-labelledby="anfragen" className="flex flex-col gap-3 px-5 pb-4">
        <h2 id="anfragen" className="m-0 text-headline">
          Offene Anfragen
        </h2>
        {open.length === 0 && <p className="m-0 text-body text-text-secondary">Gerade gibt es keine offenen Anfragen in deinen Bezirken.</p>}
        {open.map((l) => (
          <Karte key={l.id} l={l} rates={r} offer={mine.find((o) => o.status === 'sent' && o.revisionId === l.revisionId)} onDone={refresh} />
        ))}
      </section>
      {offers.status === 'ready' && offers.data.length > 0 && (
        <section aria-labelledby="angebote" className="flex flex-col gap-3 px-5 pb-4">
          <h2 id="angebote" className="m-0 text-headline">
            Meine Angebote
          </h2>
          <Angebote offers={offers.data.slice(0, 20)} onDone={refresh} />
        </section>
      )}
    </>
  )
}

function Karte({ l, rates, offer, onDone }: { l: Listing; rates: Rates | null; offer?: MyOffer; onDone: (notice?: string) => void }) {
  const [sheet, setSheet] = useState<'accept' | 'offer' | null>(null)
  const day = dayLabel(l.preferredDate)
  const window = windowLabel(l.timeWindow)
  const scope = scopeLines(l.service, l.inputs)
  const payout = rates && l.totalCents !== null ? payoutCents(l.totalCents, rates) : null
  return (
    <article aria-labelledby={`l-${l.id}`} className={box}>
      <h3 id={`l-${l.id}`} className="m-0 text-headline">
        {serviceLabel[l.service]}, Bezirk {l.district}
      </h3>
      <p className="m-0 text-body">
        Abholung in Bezirk {l.district}
        {l.toDistrict !== null && `, Ziel in Bezirk ${l.toDistrict}`}
      </p>
      {(day || window) && <p className="m-0 text-body">{[day, window].filter(Boolean).join(', ')}</p>}
      {scope.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-subhead text-text-secondary">
          {scope.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
      {l.totalCents !== null ? (
        <>
          <Zeile label="Preis für den Kunden">{euro(l.totalCents)}</Zeile>
          {payout !== null && <Zeile label="Du erhältst">{euro(payout)}</Zeile>}
        </>
      ) : (
        l.lowCents !== null &&
        l.highCents !== null && (
          <Zeile label="Preisspanne">
            <span className="whitespace-nowrap">
              {euro(l.lowCents)} bis {euro(l.highCents)}
            </span>
          </Zeile>
        )
      )}
      <p className="m-0 text-subhead text-text-secondary">Antwort bis {viennaTime(l.deadline)}</p>
      <Fotos id={l.id} />
      {l.totalCents !== null && (
        <>
          <Button disabled={payout === null} onClick={() => setSheet('accept')}>
            Annehmen
          </Button>
          {payout === null && <p className="m-0 text-footnote text-text-secondary">Die Auszahlung kann gerade nicht berechnet werden. Lade die Seite neu.</p>}
        </>
      )}
      {l.totalCents === null &&
        (offer ? (
          <p className="m-0 text-body">
            Angebot gesendet: {euro(offer.amountCents)}, gültig bis {viennaTime(offer.validUntil)}
          </p>
        ) : (
          <Button onClick={() => setSheet('offer')}>Angebot abgeben</Button>
        ))}

      {payout !== null && (
        <Bestaetigen open={sheet === 'accept'} onClose={() => setSheet(null)} title="Anfrage annehmen" label="Verbindlich annehmen" action={() => acceptListing(l, payout)} onDone={onDone}>
          {sheet === 'accept' && (
            <>
              <Zeile label="Preis für den Kunden">{euro(l.totalCents!)}</Zeile>
              <Zeile label="Du erhältst">{euro(payout)}</Zeile>
              <p className="m-0 text-subhead text-text-secondary">Mit der Annahme übernimmst du den Auftrag verbindlich zu diesem Preis.</p>
            </>
          )}
        </Bestaetigen>
      )}
      {l.totalCents === null && <AngebotSheet l={l} rates={rates} open={sheet === 'offer'} onClose={() => setSheet(null)} onDone={onDone} />}
    </article>
  )
}

/** Eingabe in Euro, dann Bestätigung mit dem gezeigten Betrag. Die Prüfung hier spart nur den Umweg, Spanne und Status prüft der Server. */
function AngebotSheet({ l, rates, open, onClose, onDone }: { l: Listing; rates: Rates | null; open: boolean; onClose: () => void; onDone: (notice?: string) => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [cents, setCents] = useState<number | null>(null)
  const hasRange = l.lowCents !== null && l.highCents !== null
  const reset = () => {
    setText('')
    setError('')
    setCents(null)
    onClose()
  }

  function next() {
    const c = parseEuro(text)
    if (c === null) return setError('Gib einen Betrag in Euro an, zum Beispiel 700,50.')
    if (hasRange && (c < l.lowCents! || c > l.highCents!)) return setError(`Der Betrag muss zwischen ${formatEuro(l.lowCents!)} und ${formatEuro(l.highCents!)} liegen.`)
    setError('')
    setCents(c)
  }

  return (
    <>
      <Sheet open={open && cents === null} onClose={reset} title="Angebot abgeben" detents={[0.6]}>
        <form
          className="flex flex-col gap-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault()
            next()
          }}
        >
          <GroupedList>
            <Field label="Dein Angebot in Euro" inputMode="decimal" autoComplete="off" placeholder="0,00" value={text} onChange={(e) => setText(e.target.value)} />
          </GroupedList>
          {hasRange && (
            <p className="m-0 text-subhead text-text-secondary">
              Gewünscht ist ein Preis zwischen {formatEuro(l.lowCents!)} und {formatEuro(l.highCents!)}.
            </p>
          )}
          {error && (
            <p role="alert" className="m-0 text-body text-destructive">
              {error}
            </p>
          )}
          <Button type="submit">Weiter</Button>
          <Button variant="plain" onClick={reset}>
            Doch nicht
          </Button>
        </form>
      </Sheet>
      <Bestaetigen
        open={open && cents !== null}
        onClose={() => setCents(null)}
        title="Angebot senden"
        label="Verbindlich senden"
        action={() => sendOffer(l.id, cents!)}
        onDone={(n) => {
          reset()
          onDone(n)
        }}
      >
        {cents !== null && (
          <>
            <Zeile label="Dein Angebot">{euro(cents)}</Zeile>
            {rates && payoutCents(cents, rates) !== null && <Zeile label="Du erhältst voraussichtlich">{euro(payoutCents(cents, rates)!)}</Zeile>}
            <p className="m-0 text-subhead text-text-secondary">Dein Anteil kann sich bis zur Annahme ändern. Verbindlich, bis du das Angebot zurückziehst oder es abläuft.</p>
          </>
        )}
      </Bestaetigen>
    </>
  )
}

const OFFER_TEXT: Record<MyOffer['status'], string> = {
  sent: 'Offen',
  confirmed: 'Angenommen',
  withdrawn: 'Zurückgezogen',
  expired: 'Abgelaufen',
  superseded: 'Ein anderes Angebot wurde gewählt',
  rejected: 'Abgelehnt',
}

function Angebote({ offers, onDone }: { offers: MyOffer[]; onDone: (notice?: string) => void }) {
  const [pick, setPick] = useState<MyOffer | null>(null)
  return (
    <div className={box}>
      {offers.map((o) => (
        <div key={o.id} className="flex flex-col gap-2 border-t-[0.5px] border-separator pt-3 first:border-t-0 first:pt-0">
          <span className="text-headline">{euro(o.amountCents)}</span>
          <span className="text-subhead text-text-secondary">{o.status === 'sent' ? `Offen bis ${viennaTime(o.validUntil)}` : OFFER_TEXT[o.status]}</span>
          {o.status === 'sent' && (
            <Button variant="tinted" onClick={() => setPick(o)}>
              Zurückziehen
            </Button>
          )}
        </div>
      ))}
      <Bestaetigen open={pick !== null} onClose={() => setPick(null)} title="Angebot zurückziehen" label="Angebot zurückziehen" action={() => withdrawOffer(pick!.id)} onDone={onDone}>
        {pick && (
          <>
            <Zeile label="Dein Angebot">{euro(pick.amountCents)}</Zeile>
            <p className="m-0 text-subhead text-text-secondary">Der Kunde kann es danach nicht mehr annehmen.</p>
          </>
        )}
      </Bestaetigen>
    </div>
  )
}

/** Fotos erst auf Wunsch laden: signierte Adressen laufen nach 10 Minuten ab und werden nicht gespeichert; kein Download-Knopf, keine Links. */
function Fotos({ id }: { id: string }) {
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'error' } | { status: 'ready'; urls: string[] }>({ status: 'idle' })
  async function show() {
    setState({ status: 'loading' })
    try {
      setState({ status: 'ready', urls: await loadPhotos(id) })
    } catch {
      setState({ status: 'error' })
    }
  }
  if (state.status === 'ready') {
    return state.urls.length === 0 ? (
      <p className="m-0 text-subhead text-text-secondary">Zu dieser Anfrage gibt es keine Fotos.</p>
    ) : (
      <div className="flex flex-wrap gap-2">
        {state.urls.map((u) => (
          <img key={u} src={u} alt="Foto der Anfrage" className="h-24 w-24 rounded-lg object-cover" draggable={false} onContextMenu={(e) => e.preventDefault()} />
        ))}
      </div>
    )
  }
  return (
    <>
      <Button variant="tinted" disabled={state.status === 'loading'} onClick={() => void show()}>
        Fotos ansehen
      </Button>
      {state.status === 'error' && (
        <p role="alert" className="m-0 text-subhead text-destructive">
          Die Fotos konnten nicht geladen werden. Versuche es noch einmal.
        </p>
      )}
    </>
  )
}
