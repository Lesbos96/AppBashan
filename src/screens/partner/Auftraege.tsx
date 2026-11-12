import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '../../components/Button'
import { StatusChip } from '../../components/Controls'
import { Sheet } from '../../components/Sheet'
import { ErrorState, Loading } from '../../components/States'
import { JobError, jobErrorText, retryable } from '../../lib/jobs'
import { formatEuro } from '../../lib/money'
import {
  dayLabel,
  finishJob,
  loadContact,
  loadJobs,
  mailHref,
  serviceLabel,
  startJob,
  telHref,
  viennaTime,
  windowLabel,
  type Contact,
  type Job,
  type JobStatus,
} from '../../lib/partnerJobs'
import { canPropose, loadChanges, withdrawChange, type ChangeStatus, type JobChange } from '../../lib/partnerChange'
import { Bestaetigen } from '../auftrag/Bestaetigen'
import { NachtragSheet } from './Nachtrag'

const box = 'flex flex-col gap-3 rounded-grouped-list bg-surface p-4 shadow-card'
const euro = (cents: number) => <span className="whitespace-nowrap tabular-nums">{formatEuro(cents)}</span>

const STATUS: Record<JobStatus, { chip: 'confirmed' | 'done'; label: string }> = {
  accepted: { chip: 'confirmed', label: 'Angenommen' },
  in_progress: { chip: 'confirmed', label: 'Läuft' },
  completed: { chip: 'done', label: 'Abgeschlossen' },
  cancelled_by_customer: { chip: 'done', label: 'Vom Kunden storniert' },
  cancelled_by_partner: { chip: 'done', label: 'Von dir storniert' },
}

function Zeile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="m-0 flex flex-wrap items-baseline justify-between gap-x-3 text-body">
      <span className="min-w-0 text-text-secondary">{label}</span>
      <span className="ml-auto min-w-0 break-words text-right font-semibold">{children}</span>
    </p>
  )
}

const denied = (e: unknown) => typeof e === 'object' && e !== null && 'message' in e && (e.message === 'partner_not_active' || e.message === 'mfa_required')

type Loaded = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: Job[]; changes: Map<string, JobChange> }

/**
 * Aufträge aus `my_jobs()` plus Preisgrundlage und Nachtrag aus `my_job_changes()` (s9i-7a). Fällt nur die zweite Abfrage aus, bleiben die Aufträge
 * sichtbar und es erscheint kein Nachtrag-Knopf (der Server entscheidet ohnehin); verweigert er, gilt das wie bei den Aufträgen.
 */
async function fetchAll(): Promise<{ data: Job[]; changes: Map<string, JobChange> }> {
  const [data, changes] = await Promise.all([
    loadJobs(),
    loadChanges().catch((e: unknown) => {
      if (denied(e)) throw e
      return new Map<string, JobChange>()
    }),
  ])
  return { data, changes }
}

/**
 * Aufträge der Firma aus `my_jobs()`. Neu laden: nach jeder Aktion, bei Rückkehr in den Tab und jede Minute, solange ein Auftrag auf seinen Termin wartet
 * (`canStart` ist eine Momentaufnahme der Datenbankuhr; die Geräteuhr entscheidet nichts). Neuladen im Hintergrund lässt die Anzeige stehen.
 */
function useJobs(reloadKey: number): [Loaded, (quiet: boolean) => void] {
  const [state, setState] = useState<Loaded>({ status: 'loading' })
  const seq = useRef(0)
  // Antworten gelten nur für den letzten Abruf (kein Überholen) und nicht nach dem Unmount
  const invalidate = useCallback(() => {
    seq.current++
  }, [])
  const fetchJobs = useCallback((quiet: boolean) => {
    const n = ++seq.current
    fetchAll().then(
      (all) => n === seq.current && setState({ status: 'ready', ...all }),
      // Hintergrundabruf: ein Netzfehler lässt die Anzeige stehen; verweigert der Server (Firma gesperrt, zweiter Faktor weg), wird die Liste verworfen
      (e: unknown) => n === seq.current && setState((s) => (quiet && s.status === 'ready' && !denied(e) ? s : { status: 'error' })),
    )
  }, [])
  const load = useCallback(
    (quiet: boolean) => {
      if (!quiet) setState({ status: 'loading' })
      fetchJobs(quiet)
    },
    [fetchJobs],
  )
  // Erster Abruf und Änderungen von außen: der Zustand ist beim Start schon „loading“, ein Neuladen lässt die Anzeige stehen
  useEffect(() => {
    fetchJobs(true)
    return invalidate
  }, [fetchJobs, invalidate, reloadKey])
  const waiting = state.status === 'ready' && state.data.some((j) => j.status === 'accepted' && !j.ended && !j.canStart)
  useEffect(() => {
    const again = () => document.visibilityState === 'visible' && load(true)
    document.addEventListener('visibilitychange', again)
    window.addEventListener('focus', again)
    const timer = waiting ? window.setInterval(again, 60_000) : undefined
    return () => {
      document.removeEventListener('visibilitychange', again)
      window.removeEventListener('focus', again)
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [load, waiting])
  return [state, load]
}

/** Angenommene und beendete Aufträge (Firma `active` oder `payment_hold`, aal2). Der Server entscheidet über alles. */
export function PartnerAuftraege({ reloadKey = 0 }: { reloadKey?: number }) {
  const [jobs, load] = useJobs(reloadKey)
  const [notice, setNotice] = useState('')
  const done = (n?: string) => {
    setNotice(n ?? '')
    load(true)
  }
  if (jobs.status === 'loading') return <Loading label="Aufträge laden" />
  if (jobs.status === 'error') return <ErrorState text="Die Aufträge konnten nicht geladen werden. Prüfe deine Verbindung." onRetry={() => load(false)} />
  const live = jobs.data.filter((j) => !j.ended)
  const over = jobs.data.filter((j) => j.ended)
  return (
    <>
      {notice && (
        <div className="px-5 pb-4">
          <p role="status" className="m-0 rounded-grouped-list bg-surface p-4 text-body shadow-card">
            {notice}
          </p>
        </div>
      )}
      {live.length > 0 && (
        <section aria-labelledby="angenommen" className="flex flex-col gap-3 px-5 pb-4">
          <h2 id="angenommen" className="m-0 text-headline">
            Angenommen
          </h2>
          {live.map((j) => (
            <Auftrag key={j.id} j={j} change={jobs.changes.get(j.requestId)} onDone={done} />
          ))}
        </section>
      )}
      {over.length > 0 && (
        <section aria-labelledby="beendet" className="flex flex-col gap-3 px-5 pb-4">
          <h2 id="beendet" className="m-0 text-headline">
            Beendet
          </h2>
          {over.map((j) => (
            <Auftrag key={j.id} j={j} change={undefined} onDone={done} />
          ))}
        </section>
      )}
    </>
  )
}

const CHANGE_NOTE: Record<Exclude<ChangeStatus, 'proposed'>, string> = {
  accepted: 'Der Kunde hat deinen Nachtrag angenommen.',
  declined: 'Der Kunde hat deinen Nachtrag abgelehnt. Es gilt der bisherige Preis.',
  expired: 'Dein Nachtrag ist abgelaufen. Es gilt der bisherige Preis.',
  withdrawn: 'Du hast deinen Nachtrag zurückgezogen.',
}

/** Zustand des Nachtrags und die Wege dahin (Vorschlagen, Zurückziehen); nur für laufende Aufträge. */
function NachtragBlock({ c, onOpen, onWithdraw }: { c: JobChange; onOpen: () => void; onWithdraw: () => void }) {
  const ch = c.change
  return (
    <>
      {ch?.status === 'proposed' && (
        <>
          <p className="m-0 text-body">
            Dein Nachtrag liegt beim Kunden: neuer Gesamtpreis {euro(ch.totalCents)}
            {ch.validUntil && ` · gültig bis ${viennaTime(ch.validUntil)} Uhr`}
          </p>
          <Button variant="tinted" onClick={onWithdraw}>
            Nachtrag zurückziehen
          </Button>
        </>
      )}
      {ch && ch.status !== 'proposed' && <p className="m-0 text-footnote text-text-secondary">{CHANGE_NOTE[ch.status]}</p>}
      {canPropose(c) && (
        <Button variant="tinted" onClick={onOpen}>
          Nachtrag vorschlagen
        </Button>
      )}
    </>
  )
}

/** Beträge laut Journal. Nach einem Storno ist `total` die Stornobasis (oder 0), nie der Preis für den Kunden (Berater, Plan-Prüfung M1). */
function Betraege({ j }: { j: Job }) {
  if (j.totalCents === null) return null
  const cancelled = j.status === 'cancelled_by_customer' || j.status === 'cancelled_by_partner'
  if (cancelled && j.totalCents === 0) return <p className="m-0 text-subhead text-text-secondary">Storniert, es fällt kein Betrag an.</p>
  return (
    <>
      <Zeile label={!cancelled ? 'Preis für den Kunden' : j.status === 'cancelled_by_customer' ? 'Betrag nach Storno' : 'Pauschale'}>{euro(j.totalCents)}</Zeile>
      {j.payoutCents !== null && <Zeile label="Du erhältst">{euro(j.payoutCents)}</Zeile>}
    </>
  )
}

function Auftrag({ j, change, onDone }: { j: Job; change: JobChange | undefined; onDone: (notice?: string) => void }) {
  const [sheet, setSheet] = useState<'start' | 'finish' | 'change' | 'withdraw' | null>(null)
  const info = STATUS[j.status]
  const day = dayLabel(j.preferredDate)
  const window = windowLabel(j.timeWindow)
  const places = j.district !== null ? `Abholung in Bezirk ${j.district}${j.toDistrict !== null ? `, Ziel in Bezirk ${j.toDistrict}` : ''}` : null
  return (
    <article aria-labelledby={`j-${j.id}`} className={box}>
      <div className="flex items-start justify-between gap-3">
        <h3 id={`j-${j.id}`} className="m-0 min-w-0 break-words text-headline">
          {serviceLabel[j.service]}
          {j.district !== null && `, Bezirk ${j.district}`}
        </h3>
        <StatusChip status={info.chip}>{info.label}</StatusChip>
      </div>
      {places && <p className="m-0 text-body">{places}</p>}
      {(day || window) && <p className="m-0 text-body">{[day, window].filter(Boolean).join(', ')}</p>}
      <Betraege j={j} />
      {j.status === 'accepted' && !j.ended && (
        <>
          <Button disabled={!j.canStart} onClick={() => setSheet('start')}>
            Auftrag starten
          </Button>
          {!j.canStart && <p className="m-0 text-footnote text-text-secondary">Du kannst den Auftrag ab {viennaTime(j.terminAt)} Uhr starten.</p>}
        </>
      )}
      {j.status === 'in_progress' && !j.ended && <Button onClick={() => setSheet('finish')}>Auftrag abschließen</Button>}
      {change && !j.ended && (j.status === 'accepted' || j.status === 'in_progress') && <NachtragBlock c={change} onOpen={() => setSheet('change')} onWithdraw={() => setSheet('withdraw')} />}
      <Kontakt j={j} />
      {j.ended && <p className="m-0 text-footnote text-text-secondary">Kontakt und Adresse bleiben nach dem Ende nur kurze Zeit sichtbar.</p>}

      <Bestaetigen open={sheet === 'start'} onClose={() => setSheet(null)} title="Auftrag starten" label="Auftrag starten" action={() => startJob(j.requestId)} onDone={onDone}>
        <p className="m-0 text-subhead text-text-secondary">Der Auftrag läuft danach. Abschließen kannst du ihn, wenn alles erledigt ist.</p>
      </Bestaetigen>
      <Bestaetigen open={sheet === 'finish'} onClose={() => setSheet(null)} title="Auftrag abschließen" label="Verbindlich abschließen" action={() => finishJob(j.requestId)} onDone={onDone}>
        <p className="m-0 text-subhead text-text-secondary">Du meldest den Auftrag als erledigt. Das lässt sich danach nicht mehr ändern.</p>
      </Bestaetigen>
      {change && <NachtragSheet open={sheet === 'change'} onClose={() => setSheet(null)} c={change} onDone={onDone} />}
      {change?.change?.status === 'proposed' && (
        <Bestaetigen open={sheet === 'withdraw'} onClose={() => setSheet(null)} title="Nachtrag zurückziehen" label="Nachtrag zurückziehen" action={() => withdrawChange(change.change?.id ?? '')} onDone={onDone}>
          <p className="m-0 text-subhead text-text-secondary">Der Kunde bekommt eine Mail, dass der Nachtrag nicht mehr gilt. Danach kannst du einen neuen vorschlagen.</p>
        </Bestaetigen>
      )}
    </article>
  )
}

type ContactState = { status: 'loading' } | { status: 'error'; kind: JobError['kind'] } | { status: 'ready'; contact: Contact }

/**
 * Kontakt und Adresse erst auf Antippen (jeder Abruf schreibt serverseitig eine Audit-Zeile): nichts davon steht vorab im DOM,
 * und beim Schließen wird alles verworfen.
 */
function Kontakt({ j }: { j: Job }) {
  const [state, setState] = useState<ContactState | null>(null)
  const token = useRef(0)

  async function open() {
    const t = ++token.current
    setState({ status: 'loading' })
    try {
      const contact = await loadContact(j.requestId)
      if (t === token.current) setState({ status: 'ready', contact })
    } catch (e) {
      if (t === token.current) setState({ status: 'error', kind: e instanceof JobError ? e.kind : 'unavailable' })
    }
  }
  const close = () => {
    token.current++
    setState(null)
  }

  return (
    <>
      <Button variant="tinted" disabled={state !== null} onClick={() => void open()}>
        Kontakt und Adresse anzeigen
      </Button>
      <Sheet open={state !== null} onClose={close} title="Kontakt und Adresse" detents={[0.7]}>
        {state?.status === 'loading' && <Loading label="Kontakt laden" />}
        {state?.status === 'error' && (
          <div className="flex flex-col gap-4 pt-2">
            <p role="alert" className="m-0 text-body">
              {jobErrorText[state.kind]}
            </p>
            {retryable(state.kind) && <Button onClick={() => void open()}>Erneut versuchen</Button>}
            <Button variant="plain" onClick={close}>
              Schließen
            </Button>
          </div>
        )}
        {state?.status === 'ready' && <Daten c={state.contact} onClose={close} />}
      </Sheet>
    </>
  )
}

function Daten({ c, onClose }: { c: Contact; onClose: () => void }) {
  const tel = telHref(c.phone)
  const mail = mailHref(c.email)
  const link = 'text-accent underline'
  return (
    <div className="flex flex-col gap-3 pt-2">
      <Zeile label="Name">{c.name}</Zeile>
      <Zeile label="Telefon">{tel ? <a className={link} href={tel}>{c.phone}</a> : c.phone}</Zeile>
      <Zeile label="E-Mail">{mail ? <a className={link} href={mail}>{c.email}</a> : c.email}</Zeile>
      {c.fromAddress && <Zeile label="Abholung">{c.fromAddress}</Zeile>}
      {c.toAddress && <Zeile label="Ziel">{c.toAddress}</Zeile>}
      {c.stairsDoor && <Zeile label="Stock und Tür">{c.stairsDoor}</Zeile>}
      <p className="m-0 text-footnote text-text-secondary">Nur für diesen Auftrag verwenden. Jeder Abruf wird protokolliert.</p>
      <Button variant="plain" onClick={onClose}>
        Schließen
      </Button>
    </div>
  )
}
