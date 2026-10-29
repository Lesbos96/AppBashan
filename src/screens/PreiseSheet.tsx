import type { ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { ErrorState, Loading } from '../components/States'
import { Sheet } from '../components/Sheet'
import { Card } from '../components/Surfaces'
import { formatEuro } from '../lib/money'
import { loadPrices, useLoad, type PriceRow, type Prices, type Source } from '../lib/prices'

// Jeder Wert im Text kommt aus price_config. Fehlt einer, ist der Zustand „Fehler", nie ein Ersatzwert.
const required = [
  'team_rate.1', 'team_rate.2', 'team_rate.3', 'team_rate.4', 'team_rate.extra_person', 'extra_vehicle_rate',
  'min_hours.transport', 'min_hours.move', 'outside_km_rate', 'box', 'parking_zone', 'piano.vienna_base', 'piano.per_floor',
  'clearance.rate', 'clearance.rate_low', 'clearance.rate_high', 'clearance.minimum', 'clearance.floor_surcharge',
  'clearance.volume_factor.light', 'clearance.volume_factor.normal', 'clearance.volume_factor.full',
  'assembly.rate_per_lfm', 'assembly.min_lfm', 'kitchen.base', 'kitchen.lower_per_lfm', 'kitchen.upper_per_lfm', 'kitchen.tall_per_lfm',
  'rental.reference',
]

async function loadInfo(): Promise<Prices> {
  const prices = await loadPrices()
  const missing = required.filter((key) => !prices.rows.some((r) => r.key === key))
  if (missing.length > 0) throw new Error(`Tarife fehlen: ${missing.join(', ')}`)
  return prices
}

const Eur = ({ cents }: { cents: number }) => <span className="whitespace-nowrap tabular-nums">{formatEuro(cents)}</span>
const num = (n: number) => String(n).replace('.', ',')
const german = (iso: string) => iso.split('-').reverse().join('.')

/** Quellen der Gruppe, je Link oder Label einmal. */
function sourcesOf(rows: PriceRow[], prefixes: string[]): Source[] {
  const seen = new Map<string, Source>()
  for (const row of rows) {
    if (!prefixes.some((p) => row.key === p || (p.endsWith('.') && row.key.startsWith(p)))) continue
    for (const s of row.sources) seen.set(s.url ?? s.label, s)
  }
  return [...seen.values()]
}

function Section({ title, headline, caption, text, sources }: { title: string; headline: ReactNode; caption: string; text: ReactNode; sources: Source[] }) {
  return (
    <Card className="flex flex-col gap-3 p-3.5">
      <h3 className="m-0 text-subhead font-semibold text-accent">{title}</h3>
      <div className="flex flex-col gap-1">
        <p className="m-0 text-title1">{headline}</p>
        <p className="m-0 text-footnote text-text-secondary">{caption}</p>
      </div>
      <p className="m-0 text-subhead">{text}</p>
      <ul className="m-0 flex list-none flex-col border-t-[0.5px] border-separator p-0">
        {sources.map((s) => (
          <li key={s.url ?? s.label} className="border-b-[0.5px] border-separator last:border-b-0">
            {s.url ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="press flex min-h-11 items-center justify-between gap-3 py-2 text-subhead text-accent">
                <span>
                  {s.label}
                  <span className="sr-only"> (öffnet in neuem Tab)</span>
                </span>
                <Icon name="arrow-up-right" width={16} height={16} className="shrink-0" />
              </a>
            ) : (
              <span className="flex min-h-11 items-center py-2 text-footnote text-text-secondary">{s.label}</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Info({ prices }: { prices: Prices }) {
  const { rows } = prices
  const row = (key: string) => rows.find((r) => r.key === key)!
  const v = (key: string) => row(key).value
  const eur = (key: string) => <Eur cents={v(key)} />
  const research = rows.map((r) => r.researchedAt).filter((d): d is string => d !== null).sort().at(-1)

  return (
    <div className="flex flex-col gap-4 pt-2">
      <p className="m-0 text-subhead text-text-secondary">
        Brutto-Richtwerte für Wien aus ausgewählten Preislisten{research ? `, Recherche vom ${german(research)}` : ''}. Kein repräsentativer Marktdurchschnitt. Verbindlich wird erst das Angebot eines Partners.
      </p>

      <Section
        title="Transport & Umzug"
        headline={<>{eur('team_rate.2')} je Stunde</>}
        caption={row('team_rate.2').label}
        text={
          <>
            1 Person {eur('team_rate.1')}, 3 Personen {eur('team_rate.3')}, 4 Personen {eur('team_rate.4')}, jede weitere +{eur('team_rate.extra_person')}. Zusatzfahrzeug +{eur('extra_vehicle_rate')} je Stunde.
            Mindestens <span className="whitespace-nowrap">{num(v('min_hours.transport'))} h</span> Transport, <span className="whitespace-nowrap">{num(v('min_hours.move'))} h</span> Umzug. Außerhalb Wiens: Fernfahrzeit plus {eur('outside_km_rate')} je km und
            Fahrzeug. Grenzüberschreitend: persönliches Angebot. Umzugskarton {eur('box')}, Halteverbotszone {eur('parking_zone')} je Adresse. Klavier als Preisorientierung ab {eur('piano.vienna_base')} in Wien plus {eur('piano.per_floor')} je Stockwerk.
          </>
        }
        sources={sourcesOf(rows, ['team_rate.', 'extra_vehicle_rate', 'min_hours.', 'outside_km_rate', 'box', 'parking_zone', 'piano.'])}
      />

      <Section
        title="Entrümpelung"
        headline={<>{eur('clearance.rate')} je m³</>}
        caption={`${row('clearance.rate').label} · Spanne ${formatEuro(v('clearance.rate_low'))} bis ${formatEuro(v('clearance.rate_high'))}`}
        text={
          <>
            Mindestens {eur('clearance.minimum')}. Ohne Lift {eur('clearance.floor_surcharge')} je Etage ab dem 2. Stock. Fläche wird mit {num(v('clearance.volume_factor.light'))} / {num(v('clearance.volume_factor.normal'))} /{' '}
            {num(v('clearance.volume_factor.full'))} m³ je m² in Volumen umgerechnet, eine Planannahme, keine Messung.
          </>
        }
        sources={sourcesOf(rows, ['clearance.'])}
      />

      <Section
        title="Montage & Demontage"
        headline={<>{eur('assembly.rate_per_lfm')} je lfm</>}
        caption={row('assembly.rate_per_lfm').label}
        text={
          <>
            Mindestens {num(v('assembly.min_lfm'))} lfm. Küche: {eur('kitchen.base')} Grundbetrag plus {eur('kitchen.lower_per_lfm')} je lfm Unterschrank, {eur('kitchen.upper_per_lfm')} Oberschrank,{' '}
            {eur('kitchen.tall_per_lfm')} Hochschrank. Ohne Anschlüsse.
          </>
        }
        sources={sourcesOf(rows, ['assembly.', 'kitchen.'])}
      />

      <Section
        title="Transportermiete"
        headline="Tarif des Vermieters"
        caption="Miettage × Tagespreis + Mehr-km + Extras + Bereitstellung"
        text="Angebrochene 24 Stunden zählen als weiterer Tag. Freikilometer je Tag. Kaution separat und erstattbar, Kraftstoff nach Verbrauch."
        sources={sourcesOf(rows, ['rental.reference'])}
      />
    </div>
  )
}

function Inhalt() {
  const [state, retry] = useLoad(loadInfo)
  if (state.status === 'loading') return <Loading label="Preise laden" />
  if (state.status === 'error') return <ErrorState text="Die Preise konnten nicht geladen werden. Prüfe deine Verbindung." onRetry={retry} />
  return <Info prices={state.data} />
}

export function PreiseSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Wie rechnet MoveNow?" detents={[0.92]}>
      {open && <Inhalt />}
    </Sheet>
  )
}
