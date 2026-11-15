import { useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { NavBar } from '../components/Bars'
import { Button } from '../components/Button'
import { StatusChip } from '../components/Controls'
import { Sheet } from '../components/Sheet'
import { ErrorState, Loading } from '../components/States'
import { CancelError, cancelErrorText, cancelRequest, feeText, previewCancel, snapshotStorno, timeline } from '../lib/cancel'
import { terminStarted } from '../lib/jobs'
import { states, titles } from '../lib/orders'
import { useLoad } from '../lib/prices'
import { parseSnapshot, priceLabel } from '../lib/quote'
import { useSession } from '../lib/session'
import { supabase } from '../lib/supabase'
import { Absage } from './auftrag/Absage'
import { Angebote } from './auftrag/Angebote'
import { Nachtrag } from './auftrag/Nachtrag'
import { Termin } from './auftrag/Termin'
import { Zurueckziehen } from './auftrag/Zurueckziehen'
import { dayText } from './anfrage/format'

const COLUMNS = 'id, service, status, preferred_date, termin_at, not_done_reported_at, not_done_resolved_at, cancel_fee_waived, time_window, from_address, to_address, price_revisions!service_requests_current_revision(snapshot)'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const windows: Record<string, string> = { morning: '8 bis 11 Uhr', midday: '11 bis 14 Uhr', afternoon: '14 bis 18 Uhr', flexible: 'ganzer Tag ab 8 Uhr' }

/** Eigene Anfrage (Filter auf die Nutzer-ID: die RLS-Regel „admin liest alles“ gilt hier nicht). `null`: gibt es nicht oder gehört jemand anderem. */
async function load(userId: string, id: string) {
  if (!UUID.test(id)) return null
  const { data, error } = await supabase.from('service_requests').select(COLUMNS).eq('id', id).eq('customer_id', userId).maybeSingle()
  if (error) throw error
  return data
}

export function Auftrag() {
  const session = useSession()
  const { id = '' } = useParams()
  return (
    <main>
      <NavBar title="Auftrag" back={{ to: '/auftraege', label: 'Aufträge' }} />
      {session === undefined && <Loading label="Auftrag laden" />}
      {session === null && <Navigate to={`/anmelden?next=${encodeURIComponent(`/auftraege/${id}`)}`} replace />}
      {session && <Detail key={`${session.user.id}/${id}`} userId={session.user.id} id={id} />}
    </main>
  )
}

function Detail({ userId, id }: { userId: string; id: string }) {
  const [result, retry] = useLoad(() => load(userId, id))
  const [notice, setNotice] = useState<string>()
  // Nach jeder Aktion neu laden; ein Hinweis (Preis geändert, nicht mehr möglich) bleibt sichtbar
  const done = (n?: string) => {
    setNotice(n)
    retry()
  }
  if (result.status === 'loading') return <Loading label="Auftrag laden" />
  if (result.status === 'error') return <ErrorState text="Der Auftrag konnte nicht geladen werden. Prüfe deine Verbindung." onRetry={retry} />
  const r = result.data
  if (!r) return <ErrorState title="Nicht gefunden" text="Diesen Auftrag gibt es nicht." />

  const chip = states[r.status] ?? { chip: 'review' as const, label: 'In Prüfung', active: true }
  const snapshot = parseSnapshot(r.price_revisions?.snapshot)
  const line = timeline(r.status)
  const live = r.status === 'accepted' || r.status === 'in_progress'
  const started = live && terminStarted(r.termin_at)
  const when = [dayText(r.preferred_date), r.time_window ? windows[r.time_window] : undefined].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-3 px-5 pt-2 pb-8">
      {notice && (
        <p role="alert" className="m-0 text-body font-semibold">
          {notice}
        </p>
      )}
      <section className="flex flex-col gap-3 rounded-grouped-list bg-surface p-4 shadow-card">
        <span className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-headline">{titles[r.service]}</h2>
          <StatusChip status={chip.chip}>{chip.label}</StatusChip>
        </span>
        {when && <p className="m-0 text-body">{when}</p>}
        {r.from_address && <p className="m-0 text-subhead break-words text-text-secondary">{r.from_address}</p>}
        {r.to_address && <p className="m-0 text-subhead break-words text-text-secondary">{r.to_address}</p>}
        <span className="flex items-center justify-between gap-3 border-t-[0.5px] border-separator pt-3">
          <span className="text-subhead text-text-secondary">Preis</span>
          {snapshot?.kind === 'price' ? <span className="whitespace-nowrap text-headline tabular-nums">{priceLabel(snapshot).main}</span> : <span className="text-subhead text-text-secondary">Preis nach Prüfung</span>}
        </span>
      </section>

      <section aria-labelledby="verlauf" className="flex flex-col gap-3 rounded-grouped-list bg-surface p-4 shadow-card">
        <h2 id="verlauf" className="m-0 text-headline">
          Verlauf
        </h2>
        {'end' in line ? (
          <p className="m-0 text-body">{line.end}</p>
        ) : (
          <ol aria-label="Verlauf" className="m-0 flex list-none flex-col gap-2 p-0">
            {line.steps.map((step, i) => (
              <li key={step} aria-current={i === line.current ? 'step' : undefined} className={`flex items-center gap-3 text-body ${i > line.current ? 'text-text-secondary' : ''} ${i === line.current ? 'font-semibold' : ''}`}>
                <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${i <= line.current ? 'bg-accent' : 'bg-fill'}`} />
                {step}
              </li>
            ))}
          </ol>
        )}
      </section>

      {r.status === 'cancelled_by_partner' && <Absage id={r.id} userId={userId} />}
      {r.status === 'offered' && <Angebote id={r.id} onDone={done} />}
      {(r.status === 'requested' || r.status === 'awaiting_offer' || r.status === 'offered') && <Zurueckziehen id={r.id} onDone={done} />}
      {live && !r.not_done_reported_at && <Nachtrag id={r.id} onDone={done} />}
      {(live || r.status === 'completed') && !r.not_done_reported_at && <Termin id={r.id} completed={r.status === 'completed'} onDone={done} />}
      {(live || r.status === 'completed') && r.not_done_reported_at && !r.not_done_resolved_at && (
        <p role="status" className="m-0 rounded-grouped-list bg-surface p-4 text-body shadow-card">
          Du hast gemeldet, dass der Auftrag nicht stattgefunden hat. Wir prüfen ihn.
        </p>
      )}
      {r.status === 'accepted' && !started && !r.not_done_reported_at && <Cancel id={r.id} storno={r.cancel_fee_waived ? [] : snapshotStorno(r.price_revisions?.snapshot)} onDone={() => done()} />}
    </div>
  )
}

const retryable = (k: CancelError['kind']) => k === 'offline' || k === 'retry' || k === 'unavailable'

type Step ={ phase: 'loading' } | { phase: 'ready'; fee: number; notice?: string; error?: CancelError } | { phase: 'error'; error: CancelError }

/** Storno: erst die Vorschau des Servers, dann Bestätigung mit genau diesem Betrag. Nichts wird gebucht, was der Kunde nicht gesehen hat. */
function Cancel({ id, storno, onDone }: { id: string; storno: string[]; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>({ phase: 'loading' })
  const [busy, setBusy] = useState(false)

  // Neuere Vorschau gewinnt: eine verspätete ältere Antwort überschreibt nichts
  const latest = useRef(0)

  async function start() {
    const mine = ++latest.current
    setOpen(true)
    setStep({ phase: 'loading' })
    try {
      const fee = await previewCancel(id)
      if (mine === latest.current) setStep({ phase: 'ready', fee })
    } catch (e) {
      if (mine !== latest.current) return
      const error = e instanceof CancelError ? e : new CancelError('unavailable')
      // Der Auftrag ist schon storniert oder nicht mehr stornierbar: Anzeige angleichen
      if (error.kind === 'closed') {
        setOpen(false)
        onDone()
      } else setStep({ phase: 'error', error })
    }
  }

  function close() {
    setOpen(false)
    if (step.phase === 'error' && !retryable(step.error.kind)) onDone()
  }

  async function confirm(fee: number) {
    setBusy(true)
    try {
      await cancelRequest(id, fee)
      setOpen(false)
      onDone()
    } catch (e) {
      const error = e instanceof CancelError ? e : new CancelError('unavailable')
      // Auch nach verlorener Antwort: „nicht mehr stornierbar“ heißt, der Serverstand ist ein anderer
      if (error.kind === 'closed') {
        setOpen(false)
        onDone()
        return
      }
      setStep(error.kind === 'fee_changed' && error.cancelFeeCents !== undefined ? { phase: 'ready', fee: error.cancelFeeCents, notice: cancelErrorText.fee_changed } : error.kind === 'offline' || error.kind === 'retry' || error.kind === 'unavailable' ? { phase: 'ready', fee, error } : { phase: 'error', error })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="tinted" onClick={() => void start()}>
        Stornieren
      </Button>
      <Sheet open={open} onClose={close} locked={busy} title="Auftrag stornieren" detents={[0.6]}>
        <div className="flex flex-col gap-4 pt-2">
          {step.phase === 'loading' && <Loading label="Stornokosten prüfen" />}
          {step.phase === 'error' && (
            <>
              <p role="alert" className="m-0 text-body">
                {cancelErrorText[step.error.kind]}
              </p>
              {retryable(step.error.kind) ? <Button variant="tinted" onClick={() => void start()}>Erneut versuchen</Button> : <Button variant="plain" onClick={close}>Schließen</Button>}
            </>
          )}
          {step.phase === 'ready' && (
            <>
              {step.notice && (
                <p role="alert" className="m-0 text-body font-semibold">
                  {step.notice}
                </p>
              )}
              <span className="flex items-center justify-between gap-3">
                <span className="text-body">Stornokosten</span>
                <span className="whitespace-nowrap text-headline tabular-nums">{feeText(step.fee)}</span>
              </span>
              {storno.map((line) => (
                <p key={line} className="m-0 text-subhead text-text-secondary">
                  {line}
                </p>
              ))}
              {step.fee > 0 && <p className="m-0 text-subhead text-text-secondary">Die Stornokosten stellt dir der Partner in Rechnung.</p>}
              {step.error && (
                <p role="alert" className="m-0 text-body">
                  {cancelErrorText[step.error.kind]}
                </p>
              )}
              <Button disabled={busy} onClick={() => void confirm(step.fee)}>
                {step.fee === 0 ? 'Kostenlos stornieren' : `Für ${feeText(step.fee)} stornieren`}
              </Button>
              <Button variant="plain" disabled={busy} onClick={close}>
                Doch nicht
              </Button>
            </>
          )}
        </div>
      </Sheet>
    </>
  )
}
