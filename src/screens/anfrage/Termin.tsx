import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ActionBar, NavBar } from '../../components/Bars'
import { Button } from '../../components/Button'
import { Sheet } from '../../components/Sheet'
import { Segmented } from '../../components/Controls'
import { Icon } from '../../components/Icon'
import { Card } from '../../components/Surfaces'
import { type Path, type TimeWindow, services, timeWindows, useTermin, viennaToday } from '../../lib/draft'
import { readFlow } from '../../lib/flow'
import { Suche } from '../konfigurator/Strecke'
import { longDay, routeText, shortDayText, utc } from './format'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const month = new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const street = (label?: string) => label?.split(',')[0]?.trim() ?? ''
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Monatsraster: Datum ab heute (Wien) bis höchstens 365 Tage voraus, wie es `quote` verlangt. */
function Kalender({ value, onChange }: { value: string | null; onChange: (date: string) => void }) {
  const today = viennaToday()
  const first = utc(today)
  const last = first + 365 * 86_400_000
  const [shown, setShown] = useState(() => new Date(utc(value ?? today)).getUTCFullYear() * 12 + new Date(utc(value ?? today)).getUTCMonth())
  const year = Math.floor(shown / 12)
  const m = shown % 12
  const start = Date.UTC(year, m, 1)
  const lead = (new Date(start).getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(year, m + 1, 0)).getUTCDate()
  const lowest = new Date(first).getUTCFullYear() * 12 + new Date(first).getUTCMonth()
  const highest = new Date(last).getUTCFullYear() * 12 + new Date(last).getUTCMonth()
  const arrow = 'press flex size-11 items-center justify-center text-accent disabled:text-text/30'

  return (
    <section aria-label="Datum wählen">
      <Card className="p-3">
        <div className="flex items-center justify-between">
          <h2 className="m-0 flex items-center gap-1 pl-2 text-headline capitalize">
            {month.format(start)}
            <Icon name="chevron-right" width={14} height={14} className="text-accent" />
          </h2>
          <div className="flex">
            <button type="button" aria-label="Vorheriger Monat" disabled={shown <= lowest} onClick={() => setShown(shown - 1)} className={arrow}>
              <Icon name="chevron-left" width={20} height={20} />
            </button>
            <button type="button" aria-label="Nächster Monat" disabled={shown >= highest} onClick={() => setShown(shown + 1)} className={arrow}>
              <Icon name="chevron-right" width={20} height={20} />
            </button>
          </div>
        </div>
        <div className="mt-1 grid grid-cols-7 text-center text-[12px]/4 font-semibold text-text-secondary uppercase">
          {WEEKDAYS.map((d) => (
            <span key={d} aria-hidden="true">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: lead }, (_, i) => (
            <span key={`lead${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const ms = start + i * 86_400_000
            const date = iso(ms)
            const selected = date === value
            const disabled = ms < first || ms > last
            return (
              <button
                key={date}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                aria-label={`${longDay(ms)}${selected ? ', ausgewählt' : ''}`}
                onClick={() => onChange(date)}
                className={`press mx-auto flex size-11 items-center justify-center rounded-full text-body tabular-nums disabled:text-text/30 ${selected ? 'bg-[image:var(--gradient-primary-button)] font-semibold text-white shadow-primary-button' : ''}`}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
      </Card>
    </section>
  )
}

export function Termin({ path }: { path: Path }) {
  const navigate = useNavigate()
  const config = services[path]
  const [termin, update] = useTermin(path)
  const flow = config.hasAddresses ? readFlow(config.service as 'transport' | 'move') : null
  const [searching, setSearching] = useState(false)
  const ready = termin.date !== null && (config.hasAddresses || termin.point !== null)

  return (
    <main>
      <NavBar title="Wann passt es?" back={{ to: config.back, label: config.title }} />
      <div className="flex flex-col gap-5 px-5 pt-4 pb-40">
        {flow ? (
          <Link to={config.back} className="press flex min-h-14 items-center justify-between gap-3 rounded-grouped-list bg-surface px-4 py-2 shadow-card">
            <span className="flex min-w-0 items-center gap-3">
              <span aria-hidden="true" className="flex size-[30px] shrink-0 items-center justify-center rounded-icon-tile bg-tint text-accent">
                <Icon name="route" width={19} height={19} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-body break-words">
                  {street(flow.from?.label)} → {street(flow.to?.label)}
                </span>
                <span className="text-[13px]/4 text-text-secondary">{flow.route ? routeText(flow.route) : 'Adressen ändern'}</span>
              </span>
            </span>
            <Icon name="chevron-right" width={18} height={18} className="shrink-0 text-text-secondary opacity-60" />
          </Link>
        ) : (
          <button type="button" onClick={() => setSearching(true)} className="press flex min-h-14 w-full items-center justify-between gap-3 rounded-grouped-list bg-surface px-4 py-2 text-left shadow-card">
            <span className="flex min-w-0 flex-col">
              <span className="text-[13px]/4 text-text-secondary">Adresse</span>
              <span className={`text-body break-words ${termin.place ? '' : 'text-text-secondary'}`}>{termin.place || 'Adresse eingeben'}</span>
            </span>
            {termin.point ? <Icon name="check-circle" width={22} height={22} role="img" aria-label="Adresse bestätigt" className="shrink-0 text-primary" /> : <Icon name="chevron-right" width={18} height={18} className="shrink-0 text-text-secondary opacity-60" />}
          </button>
        )}

        <Kalender value={termin.date} onChange={(date) => update({ date })} />

        {!config.hasAddresses && (
          <div className="flex flex-col gap-2">
            <Segmented label="Zeitfenster" value={termin.window} onChange={(window) => update({ window: window as TimeWindow })} options={[...timeWindows]} />
          </div>
        )}

        <Card className="flex items-start gap-3 p-4">
          <span aria-hidden="true" className="flex size-[30px] shrink-0 items-center justify-center rounded-icon-tile bg-tint text-accent">
            <Icon name="clock" width={19} height={19} />
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="m-0 text-headline">{shortDayText(termin.date) ? `${shortDayText(termin.date)}${flow?.hours ? ` · ca. ${String(flow.hours).replace('.', ',')} Stunden` : ''}` : 'Noch kein Tag gewählt'}</p>
            <p className="m-0 text-[13px]/[18px] text-text-secondary">Die Startzeit stimmst du mit dem Partner ab. Ohne Prüfung der Verfügbarkeit.</p>
          </div>
        </Card>
      </div>
      <Sheet open={searching} onClose={() => setSearching(false)} title="Adresse" detents={[0.7, 0.92]}>
        {searching && (
          <Suche
            title="Adresse"
            place={termin.point ? { label: termin.place, point: termin.point } : null}
            consent={termin.consent}
            onConsent={(consent) => update({ consent, ...(consent ? {} : { place: '', point: null }) })}
            onPick={(p) => {
              update({ place: p.label, point: p.point })
              setSearching(false)
            }}
          />
        )}
      </Sheet>
      <ActionBar>
        <Button disabled={!ready} onClick={() => void navigate(`/${path}/zusammenfassung`)}>
          Zur Zusammenfassung
        </Button>
      </ActionBar>
    </main>
  )
}
