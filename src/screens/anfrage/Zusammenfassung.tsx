import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { ActionBar, NavBar } from '../../components/Bars'
import { Button } from '../../components/Button'
import { Illustration } from '../../components/Illustration'
import { ErrorState, Loading } from '../../components/States'
import { Card, GroupedList } from '../../components/Surfaces'
import { leaveAccount } from '../../lib/auth'
import { type Path, finishDraft, readShown, readTermin, services, stashDraft, timeWindows } from '../../lib/draft'
import { readClearanceFlow, readFlow, readMontageFlow } from '../../lib/flow'
import { loadPrices, useLoad } from '../../lib/prices'
import { floorText, lmText, toTariffs } from '../../lib/preview'
import { QuoteError, buildBody, errorText, invalidTarget, invalidText, refFor, sendQuote } from '../../lib/quote'
import { useSession } from '../../lib/session'
import { supabase } from '../../lib/supabase'
import { objectOf } from '../entruempelung/options'
import { dayText } from './format'

const goods = { normal: 'Möbel', piano: 'Klavier', grand: 'Flügel', safe: 'Tresor' }
const shortAddress = (label: string) => label.split(',')[0]?.trim() ?? label

type Row = [label: string, value: string]
type Summary = { place: Row[]; scope: Row[]; route: string }

/** Anzeige der Angaben aus dem sessionStorage (ohne Preise); `null`, wenn der Entwurf unvollständig ist. */
function summaryOf(path: Path): Summary | null {
  const termin = readTermin(path)
  const window = timeWindows.find((w) => w.value === termin.window)?.label ?? ''
  switch (services[path].service) {
    case 'transport':
    case 'move': {
      const f = readFlow(services[path].service as 'transport' | 'move')
      if (!f.from || !f.to) return null
      return {
        place: [
          ['Abholung', `${f.from.label} · ${floorText(f.fromFloor)}${f.fromLift ? ', mit Lift' : ''}`],
          ['Ziel', `${f.to.label} · ${floorText(f.toFloor)}${f.toLift ? ', mit Lift' : ''}`],
          ['Strecke', f.route ? `${f.route.distanceKm.toFixed(1).replace('.', ',')} km${f.route.outsideKm > 0 ? ` · ${f.route.outsideKm.toFixed(1).replace('.', ',')} km außerhalb Wiens` : ' · innerhalb Wiens'}` : 'wird beim Absenden berechnet'],
        ],
        scope: [
          ['Transportgut', goods[f.goods]],
          ['Ladevolumen', `ca. ${f.volume} m³`],
          ['Team', `${f.crew} ${f.crew === 1 ? 'Person' : 'Personen'} · ${f.vehicles} ${f.vehicles === 1 ? 'Fahrzeug' : 'Fahrzeuge'}`],
          ...(f.assembly ? ([['Montage', lmText(f.assemblyLm)]] as Row[]) : []),
          ...(f.boxes > 0 ? ([['Umzugskartons', `${f.boxes} Stück`]] as Row[]) : []),
          ...(f.parking > 0 ? ([['Halteverbotszone', `${f.parking} ${f.parking === 1 ? 'Adresse' : 'Adressen'}`]] as Row[]) : []),
        ],
        route: `${shortAddress(f.from.label)} → ${shortAddress(f.to.label)}`,
      }
    }
    case 'clearance': {
      const f = readClearanceFlow()
      const object = objectOf(f)
      if (!object || !termin.place.trim()) return null
      return {
        place: [
          ['Ort', termin.place.trim()],
          ['Zeitfenster', window],
        ],
        scope: [
          [object.label, `${f.area} m²`],
          ['Zugang', f.floor === 0 ? floorText(0) : `${floorText(f.floor)}, ${f.lift ? 'mit' : 'ohne'} Lift`],
          ...(f.assembly ? ([['Montage', f.draft.kind === 'kitchen' ? 'Küche' : 'Standardmöbel']] as Row[]) : []),
        ],
        route: shortAddress(termin.place),
      }
    }
    case 'assembly': {
      const f = readMontageFlow()
      if (!termin.place.trim()) return null
      return {
        place: [
          ['Ort', termin.place.trim()],
          ['Zeitfenster', window],
        ],
        scope: [[f.draft.kind === 'kitchen' ? 'Küche' : 'Standardmöbel', lmText(f.draft.lm)]],
        route: shortAddress(termin.place),
      }
    }
  }
}

const group = (title: string, rows: Row[]) => (
  <section className="flex flex-col gap-2">
    <h2 className="m-0 mx-4 text-section-header font-normal text-text-secondary">{title}</h2>
    <GroupedList>
      {rows.map(([label, value]) => (
        <li key={label} className="flex items-start justify-between gap-4 px-4 py-3 not-first:border-t-[0.5px] not-first:border-separator">
          <span className="shrink-0 text-body">{label}</span>
          <span className="min-w-0 text-right text-body break-words text-text-secondary">{value}</span>
        </li>
      ))}
    </GroupedList>
  </section>
)

const illustrations = { transport: 'service-moebel', umzug: 'summary-umzug', entruempelung: 'service-entruempelung', montage: 'service-montage' }

/** Strecke wie Screen 11: A und B mit Etage und Lift, darunter die Streckenlänge. Zeilen: Abholung, Ziel, Strecke. */
function Strecke({ rows }: { rows: Row[] }) {
  const [from, to, distance] = rows as [Row, Row, Row]
  const point = (letter: string, [, value]: Row) => {
    const cut = value.lastIndexOf(' · ')
    return (
      <li className="flex items-center gap-3 px-4 py-3 not-first:border-t-[0.5px] not-first:border-separator">
        <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-surface text-[12px]/4 font-bold text-accent">
          {letter}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-body break-words">{value.slice(0, cut)}</span>
          <span className="text-subhead text-text-secondary">{value.slice(cut + 3)}</span>
        </span>
      </li>
    )
  }
  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 mx-4 text-section-header font-normal text-text-secondary">Strecke</h2>
      <GroupedList>
        {point('A', from)}
        {point('B', to)}
        <li className="flex items-start justify-between gap-4 border-t-[0.5px] border-separator px-4 py-3">
          <span className="shrink-0 text-body text-text-secondary">Einfache Strecke</span>
          <span className="min-w-0 text-right text-body break-words">{distance[1]}</span>
        </li>
      </GroupedList>
    </section>
  )
}

export function Zusammenfassung({ path }: { path: Path }) {
  const [prices, retry] = useLoad(loadPrices)
  return (
    <main>
      <NavBar title="Zusammenfassung" back={{ to: `/${path}/termin`, label: 'Termin' }} />
      {prices.status === 'loading' && <Loading label="Angaben laden" />}
      {prices.status === 'error' && <ErrorState text="Die Angaben konnten nicht geladen werden. Prüfe deine Verbindung." onRetry={retry} />}
      {prices.status === 'ready' && <Inhalt path={path} tariffs={toTariffs(prices.data)} />}
    </main>
  )
}

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'changed' } | { kind: 'error'; error: QuoteError }

function Inhalt({ path, tariffs }: { path: Path; tariffs: Record<string, number> }) {
  const navigate = useNavigate()
  const session = useSession()
  const config = services[path]
  const summary = summaryOf(path)
  const termin = readTermin(path)
  // Einwilligung gilt für das Konto, dessen E-Mail beim Haken zu sehen war; wechselt die Sitzung (z. B. anderer Tab), muss neu bestätigt werden.
  const [consentFor, setConsentFor] = useState<string | null>(null)
  const accountId = session?.user.id ?? 'anon'
  const consent = consentFor === accountId
  const accountSwitched = consentFor !== null && consentFor !== '' && consentFor !== 'anon' && !consent
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [wait, setWait] = useState(0)
  const busy = useRef(false)

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  if (!summary || !termin.date) return <Navigate to={summary ? `/${path}/termin` : config.back} replace />

  const toLogin = () => {
    stashDraft(path)
    void navigate(`/anmelden?next=${encodeURIComponent(`/${path}/zusammenfassung`)}`)
  }
  /** Für „Anderes Konto“ und nach einem 401: ohne Abmelden leitet die Anmeldung bei bestehender Sitzung sofort zurück. */
  const otherAccount = async () => {
    stashDraft(path)
    await leaveAccount()
    void navigate(`/anmelden?next=${encodeURIComponent(`/${path}/zusammenfassung`)}`)
  }

  /** `shownId`: das Konto, dessen E-Mail der Kunde gerade sieht. Hat sich die Sitzung geändert, wird nichts gesendet. */
  async function send(shownId: string) {
    if (busy.current) return
    busy.current = true
    setStatus({ kind: 'sending' })
    try {
      const { data } = await supabase.auth.getSession()
      const live = data.session
      if (!live) throw new QuoteError('unauthorized')
      if (live.user.id !== shownId) {
        setStatus({ kind: 'changed' })
        return
      }
      const body = buildBody(path, tariffs)
      if (!body) {
        void navigate(`/${path}/termin`, { replace: true })
        return
      }
      const quote = await sendQuote(body, refFor(path, body), live.access_token)
      finishDraft(path, { path, id: quote.id, status: quote.status, needsQuote: quote.needsQuote, snapshot: quote.snapshot, shownCents: readShown(path), date: termin.date, route: summary!.route })
      void navigate(`/${path}/gesendet`, { replace: true })
    } catch (e) {
      const error = e instanceof QuoteError ? e : new QuoteError('unavailable')
      if (error.kind === 'rate_limited') setWait(60)
      setStatus({ kind: 'error', error })
    } finally {
      busy.current = false
    }
  }

  const sending = status.kind === 'sending'
  const error = status.kind === 'error' ? status.error : null
  const text = error ? (error.kind === 'invalid_input' ? invalidText(error.field) : errorText[error.kind]) : status.kind === 'changed' || accountSwitched ? 'Du bist jetzt mit einem anderen Konto angemeldet. Prüfe die E-Mail-Adresse und sende die Anfrage dann erneut.' : null

  return (
    <>
      <div className="flex flex-col gap-5 px-5 pt-2 pb-48">
        <Card className="flex items-center gap-4 p-4">
          <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-icon-tile bg-tint p-2">
            <Illustration name={illustrations[path]} className="h-auto max-h-full max-w-full" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <h2 className="m-0 text-title3">{config.title}</h2>
            <p className="m-0 text-subhead text-text-secondary">{dayText(termin.date)}</p>
          </span>
        </Card>
        {config.hasAddresses ? <Strecke rows={summary.place} /> : group('Ort & Zeit', summary.place)}
        {group('Umfang', summary.scope)}

        <label className="flex min-h-11 items-start gap-3 rounded-grouped-list bg-surface p-4 shadow-card">
          <input type="checkbox" checked={consent} onChange={(e) => setConsentFor(e.target.checked ? accountId : '')} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
          <span className="text-subhead">
            Ich sende eine unverbindliche Anfrage. Der Partner prüft und bestätigt Termin und Preis. Es gelten{' '}
            <Link to="/profil/impressum" className="inline-flex min-h-11 items-center text-accent underline">
              AGB
            </Link>{' '}
            und{' '}
            <Link to="/profil/datenschutz" className="inline-flex min-h-11 items-center text-accent underline">
              Datenschutz
            </Link>
            .
          </span>
        </label>

        {session ? (
          <div className="flex flex-col gap-1 px-4">
            <p className="m-0 text-body">
              Anfrage als <strong className="font-semibold break-all">{session.user.email}</strong> senden
            </p>
            <button type="button" onClick={() => void otherAccount()} className="press -ml-3 flex h-11 items-center self-start px-3 text-[15px] font-medium text-accent">
              Anderes Konto
            </button>
          </div>
        ) : (
          session === null && <p className="m-0 px-4 text-subhead text-text-secondary">Für den Versand legst du jetzt ein Konto an. Wir schicken dir dazu einen Anmeldelink per E-Mail.</p>
        )}

        {text && (
          <div role="alert" className="flex flex-col gap-2 rounded-grouped-list border border-destructive/40 bg-surface p-4 shadow-card">
            <p className="m-0 text-body">{wait > 0 ? `${text} Noch ${wait} s.` : text}</p>
            {error?.kind === 'unauthorized' && (
              <Button variant="tinted" onClick={() => void otherAccount()}>
                Neu anmelden
              </Button>
            )}
          </div>
        )}
      </div>
      <p role="status" className="sr-only">
        {sending ? 'Anfrage wird gesendet' : ''}
      </p>
      <ActionBar>
        {session === undefined ? (
          <Button disabled>Anfrage senden</Button>
        ) : session === null ? (
          <Button disabled={!consent} onClick={toLogin}>
            Anmelden und senden
          </Button>
        ) : (
          error?.kind === 'invalid_input' ? (
            <Link to={invalidTarget(path, error.field)} className="press flex h-[54px] w-full items-center justify-center rounded-button-primary bg-[image:var(--gradient-primary-button)] text-headline text-white shadow-primary-button">
              Angaben ändern
            </Link>
          ) : (
            <Button disabled={!consent || sending || wait > 0} aria-busy={sending} className="disabled:opacity-70!" onClick={() => void send(session.user.id)}>
              {sending ? 'Wird gesendet …' : wait > 0 ? `Bitte warten (${wait} s)` : error ? 'Erneut senden' : 'Anfrage senden'}
            </Button>
          )
        )}
      </ActionBar>
    </>
  )
}
