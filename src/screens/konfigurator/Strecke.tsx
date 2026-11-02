import { motion, useReducedMotion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { Illustration } from '../../components/Illustration'
import { Loading } from '../../components/States'
import { Sheet } from '../../components/Sheet'
import { GroupedList, SwitchRow } from '../../components/Surfaces'
import { type Place } from '../../lib/flow'
import { type Candidate, type RouteResult, geocode, routeErrorText } from '../../lib/route'
import { isPrecise } from '../../../supabase/functions/_shared/route/facts.ts'

const oneDecimal = (n: number) => n.toFixed(1).replace('.', ',')

// Adresskarte --------------------------------------------------------------------------------------------------

function Marker({ letter, filled }: { letter: 'A' | 'B'; filled?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${filled ? 'bg-primary text-white' : 'border-2 border-primary bg-surface text-primary'}`}
    >
      {letter}
    </span>
  )
}

export function Adressen({ from, to, onOpen }: { from: Place | null; to: Place | null; onOpen: (which: 'from' | 'to') => void }) {
  const rows = [
    { which: 'from' as const, label: 'Abholung', place: from, marker: <Marker letter="A" /> },
    { which: 'to' as const, label: 'Ziel', place: to, marker: <Marker letter="B" filled /> },
  ]
  return (
    <div className="relative overflow-hidden rounded-grouped-list bg-surface shadow-card">
      <span aria-hidden="true" className="absolute top-10 left-[27px] h-12 w-0.5 bg-[linear-gradient(#8FB9B6_50%,transparent_50%)] bg-size-[2px_6px]" />
      {rows.map((r) => (
        <button
          key={r.which}
          type="button"
          onClick={() => onOpen(r.which)}
          className="press relative flex h-16 w-full items-center gap-3.5 px-4 text-left not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:left-[54px] not-first:before:h-[0.5px] not-first:before:bg-separator"
        >
          {r.marker}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[13px]/4 text-text-secondary">{r.label}</span>
            <span className={`truncate text-body ${r.place ? '' : 'text-text-secondary'}`}>{r.place?.label ?? 'Adresse eingeben'}</span>
          </span>
          {r.place?.point ? (
            <Icon name="check-circle" width={22} height={22} role="img" aria-label="Adresse bestätigt" className="shrink-0 text-primary" />
          ) : (
            <Icon name="chevron-right" width={18} height={18} className="shrink-0 text-text-secondary opacity-60" />
          )}
        </button>
      ))}
    </div>
  )
}

// Adresse suchen und bestätigen --------------------------------------------------------------------------------

export function Suche({ title, place, consent, onConsent, onPick }: { title: string; place: Place | null; consent: boolean; onConsent: (v: boolean) => void; onPick: (p: Place) => void }) {
  const [q, setQ] = useState(place?.label ?? '')
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; candidates: Candidate[]; error?: string }>({ status: 'idle', candidates: [] })
  const ok = q.trim().length >= 3

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ok || !consent) return
    setState({ status: 'loading', candidates: [] })
    try {
      setState({ status: 'done', candidates: await geocode(q) })
    } catch (err) {
      setState({ status: 'error', candidates: [], error: routeErrorText(err) })
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 pt-2">
      <GroupedList>
        <li>
          <label className="flex flex-col gap-1 px-4 py-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:-outline-offset-3 has-[:focus-visible]:outline-accent/45">
            <span className="text-[13px]/[18px] text-text-secondary">{title}: Straße, Hausnummer, PLZ und Ort</span>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setState({ status: 'idle', candidates: [] })
              }}
              autoComplete="street-address"
              enterKeyHint="search"
              maxLength={200}
              className="min-w-0 border-0 bg-transparent p-0 text-body outline-none"
              placeholder="z. B. Neubaugasse 12, 1070 Wien"
            />
          </label>
        </li>
        <SwitchRow
          label="Adresse für Route nutzen"
          sub="Nur nach deiner Bestätigung"
          checked={consent}
          onChange={onConsent}
          switchLabel="Adressen für die Routenberechnung übermitteln"
        />
      </GroupedList>
      <p className="m-0 px-1 text-footnote text-text-secondary">
        {consent
          ? 'Dein Adresstext geht dafür an unseren Routendienst (openrouteservice, Deutschland). Du bestätigst danach die gefundene Adresse.'
          : 'Ohne deine Einwilligung können wir die Adresse nicht prüfen und die Anfrage nicht senden.'}
      </p>
      <Button type="submit" disabled={!ok || !consent || state.status === 'loading'}>
        Adresse suchen
      </Button>
      <div aria-live="polite">
        {state.status === 'loading' && <Loading label="Suche" />}
        {state.status === 'error' && (
          <p role="alert" className="m-0 px-1 text-body text-destructive">
            {state.error}
          </p>
        )}
        {state.status === 'done' && (() => {
          const precise = state.candidates.filter(isPrecise)
          return (
          <section className="flex flex-col gap-2">
            <h3 className="m-0 px-4 text-section-header font-normal text-text-secondary">
              {precise.length > 0 ? 'Ist das deine Adresse? Tippe sie an.' : state.candidates.length > 0 ? 'Bitte gib auch die Hausnummer an.' : 'Keine Adresse gefunden. Prüfe die Schreibweise.'}
            </h3>
            {precise.length > 0 && (
              <ul className="m-0 flex list-none flex-col overflow-hidden rounded-grouped-list bg-surface p-0 shadow-card">
                {precise.map((c) => (
                  <li key={`${c.lat},${c.lon}`} className="not-first:border-t-[0.5px] not-first:border-separator">
                    <button type="button" onClick={() => onPick({ label: c.label, point: { lat: c.lat, lon: c.lon } })} className="press flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left text-body">
                      <Icon name="pin" width={20} height={20} className="shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">{c.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          )
        })()}
      </div>
    </form>
  )
}

export function AdresseSheet({
  which,
  place,
  consent,
  onClose,
  onConsent,
  onPick,
}: {
  which: 'from' | 'to' | null
  place: Place | null
  consent: boolean
  onClose: () => void
  onConsent: (v: boolean) => void
  onPick: (which: 'from' | 'to', place: Place) => void
}) {
  const title = which === 'to' ? 'Ziel' : 'Abholung'
  return (
    <Sheet open={which !== null} onClose={onClose} title={title} detents={[0.7, 0.92]}>
      {which && (
        <Suche
          title={title}
          place={place}
          consent={consent}
          onConsent={onConsent}
          onPick={(p) => {
            onPick(which, p)
            onClose()
          }}
        />
      )}
    </Sheet>
  )
}

// Routengrafik -------------------------------------------------------------------------------------------------

const W = 350
const H = 190

/** Passt die Linie in den freien Bereich der Karte ein (Längengrad mit cos(Breite) gestaucht). */
function project(geometry: [number, number][]) {
  const k = Math.cos((geometry.reduce((s, p) => s + p[1], 0) / geometry.length) * (Math.PI / 180))
  const pts = geometry.map(([lon, lat]) => [lon * k, -lat] as const)
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const area = { x: 40, y: 48, w: W - 80, h: 78 }
  const scale = Math.min(area.w / Math.max(x1 - x0, 1e-6), area.h / Math.max(y1 - y0, 1e-6))
  const ox = area.x + (area.w - (x1 - x0) * scale) / 2
  const oy = area.y + (area.h - (y1 - y0) * scale) / 2
  return pts.map(([x, y]) => [ox + (x - x0) * scale, oy + (y - y0) * scale] as const)
}

const regionLabel = { vienna: 'Innerhalb Wiens', austria: 'Außerhalb Wiens', international: 'Ausland' }

const minutes = (h: number) => (h < 1.5 ? `ca. ${Math.round(h * 60)} Min.` : `ca. ${oneDecimal(h)} Std.`)

export function RouteKarte({
  result,
  from,
  to,
  loading,
  error,
  hint,
  onRetry,
}: {
  result: RouteResult | null
  from: Place | null
  to: Place | null
  loading: boolean
  error: string | null
  hint: string
  onRetry: () => void
}) {
  const reduced = useReducedMotion()
  const pts = result && result.geometry.length >= 2 ? project(result.geometry) : null
  const d = pts?.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')
  const [a, b] = pts ? [pts[0]!, pts[pts.length - 1]!] : []
  const line = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  return (
    <div className="relative mt-3 h-[190px] overflow-hidden rounded-grouped-list bg-[#E8EEED] shadow-card dark:bg-[#0F272B]">
      <Illustration name="route-map" className="absolute inset-0 size-full" />
      {pts && d && a && b && result && (
        <svg
          role="img"
          aria-label={`Route von ${from?.label ?? 'Abholung'} nach ${to?.label ?? 'Ziel'}, ${oneDecimal(result.distanceKm)} Kilometer, ${regionLabel[result.region]}`}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 size-full"
        >
          <path d={d} stroke="#FFFFFF" strokeWidth={8} {...line} />
          <motion.path
            d={d}
            stroke="#075C61"
            strokeWidth={4}
            {...line}
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: [0.22, 0.8, 0.2, 1], delay: 0.2 }}
          />
          <circle cx={a[0]} cy={a[1]} r={10} fill="#FFFFFF" stroke="#075C61" strokeWidth={2.5} />
          <text x={a[0]} y={a[1] + 3.8} textAnchor="middle" fontSize={10} fontWeight={700} fill="#075C61">
            A
          </text>
          <circle cx={b[0]} cy={b[1]} r={10} fill="#075C61" stroke="#FFFFFF" strokeWidth={2} />
          <text x={b[0]} y={b[1] + 3.8} textAnchor="middle" fontSize={10} fontWeight={700} fill="#FFFFFF">
            B
          </text>
        </svg>
      )}
      {result && (
        <span className="glass absolute top-2.5 left-2.5 flex h-[26px] items-center rounded-full px-2.5 text-[12.5px] font-semibold text-primary shadow-[0_1px_2px_rgba(16,47,53,0.08)] dark:text-mint">
          {regionLabel[result.region]}
        </span>
      )}
      <div className="glass absolute inset-x-2 bottom-2 flex min-h-12 items-center justify-between gap-3 rounded-[14px] px-3.5 shadow-[0_1px_2px_rgba(16,47,53,0.08)]">
        {result ? (
          <>
            <span className="flex items-baseline gap-1.5">
              <span className="text-headline font-bold tabular-nums">{oneDecimal(result.distanceKm)} km</span>
              <span className="text-[13px] text-text-secondary">einfache Strecke</span>
            </span>
            <span className="text-[13px] whitespace-nowrap text-text-secondary tabular-nums">{minutes(result.driveHours)}</span>
          </>
        ) : loading ? (
          <span role="status" className="text-subhead text-text-secondary">
            Strecke wird berechnet …
          </span>
        ) : error ? (
          <>
            <span role="alert" className="min-w-0 py-1.5 text-[13px]/4 text-destructive">
              {error}
            </span>
            <button type="button" onClick={onRetry} className="press -my-1 flex h-11 shrink-0 items-center px-1 text-subhead font-semibold text-accent">
              Erneut
            </button>
          </>
        ) : (
          <span className="py-2 text-[13px]/4 text-text-secondary">{hint}</span>
        )}
      </div>
    </div>
  )
}
