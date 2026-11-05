import { LIMITS, num } from '@pricing'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { NavBar } from '../components/Bars'
import { Segmented } from '../components/Controls'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'
import { ErrorState, Loading } from '../components/States'
import { Card, GroupedList, StepRow, SwitchRow, ValueRow } from '../components/Surfaces'
import { rememberShown } from '../lib/draft'
import { type Place, type Service, type TransportFlow, initialFlow, useFlow } from '../lib/flow'
import { formatEuro } from '../lib/money'
import { loadPrices, useLoad } from '../lib/prices'
import { floorText, hoursText, lmText, maxHours, minHours, previewTransport, stepHours, toTariffs, lineText, shownOf } from '../lib/preview'
import { InfoLink } from '../components/InfoLink'
import { Fotos } from './konfigurator/Fotos'
import { PreisLeiste, PreisSheet } from './konfigurator/Preis'
import { AdresseSheet, Adressen, RouteKarte } from './konfigurator/Strecke'
import { useRouteCalc } from './konfigurator/useRouteCalc'

const copy = {
  transport: { title: 'Möbeltransport', path: 'transport', illustrationHint: 'Einzelne Möbel' },
  move: { title: 'Umzug', path: 'umzug', illustrationHint: 'Ganzes Zuhause' },
} as const

const vehicleTypes = [
  { value: 'van', label: 'Transporter bis 3,5 t' },
  { value: 'truck', label: 'Möbel-LKW bis 3,5 t' },
  { value: 'large', label: 'Großer LKW / Hebebühne · Angebot' },
] as const

function Step({ n, title, children, footnote }: { n: number; title: string; children: ReactNode; footnote?: ReactNode }) {
  return (
    <section className="mt-7 flex flex-col">
      <div className="mx-1 mb-3 flex items-center gap-2.5">
        <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-tint text-[13px] font-bold text-accent">
          {n}
        </span>
        <h2 className="m-0 text-title3">{title}</h2>
      </div>
      {children}
      {footnote && <p className="m-0 mt-2 px-1 text-footnote text-text-secondary">{footnote}</p>}
    </section>
  )
}

export function Konfigurator({ service }: { service: Service }) {
  const [prices, retry] = useLoad(loadPrices)
  const c = copy[service]
  return (
    <main>
      <NavBar title={c.title} back={{ to: '/', label: 'Start' }} trailing={<InfoLink />} />
      {prices.status === 'loading' && <Loading label="Preise laden" />}
      {prices.status === 'error' && <ErrorState text="Die Preise konnten nicht geladen werden. Prüfe deine Verbindung." onRetry={retry} />}
      {prices.status === 'ready' && <Formular service={service} tariffs={toTariffs(prices.data)} />}
    </main>
  )
}

/** Ungültiger gespeicherter Zustand führt zu einem Fehlerzustand mit Zurücksetzen, nie zu einem Absturz. */
function safePreview(...args: Parameters<typeof previewTransport>) {
  try {
    return previewTransport(...args)
  } catch {
    return null
  }
}

function Formular({ service, tariffs }: { service: Service; tariffs: Record<string, number> }) {
  const [flow, update] = useFlow(service)
  const navigate = useNavigate()
  const [sheet, setSheet] = useState<'price' | 'vehicle' | 'assembly' | 'from' | 'to' | null>(null)
  const calc = useRouteCalc(flow, update)
  const minH = minHours(tariffs, service)
  const preview = safePreview(tariffs, service, flow)
  if (!preview) return <ErrorState text="Deine gespeicherten Angaben passen nicht mehr. Starte neu mit leeren Angaben." onRetry={() => update(initialFlow)} />
  const price = preview.state === 'price' ? preview.price : null
  const route = flow.route
  const assemblyCents = price?.lines.find((l) => l.key === 'assembly')?.cents
  const minLm = num(tariffs, 'assembly.min_lfm')
  const assemblyLm = Math.max(flow.assemblyLm, minLm)

  /** Adressen und Rückfahrt bestimmen die Route; jede Änderung verwirft sie. */
  const setRouteInput = (patch: Partial<TransportFlow>) => update({ ...patch, route: null })
  const consent = (routeConsent: boolean) =>
    // Ohne Einwilligung bleibt nur der Freitext: Koordinaten und Route werden verworfen.
    update(routeConsent ? { routeConsent } : { routeConsent, route: null, from: flow.from && { ...flow.from, point: null }, to: flow.to && { ...flow.to, point: null } })
  // Auch ein Treffer, der nach dem Entziehen der Einwilligung noch angetippt wird, bleibt ohne Koordinaten.
  const pick = (which: 'from' | 'to', place: Place) => setRouteInput({ [which]: flow.routeConsent ? place : { ...place, point: null } })

  const hint = !flow.routeConsent
    ? 'Ohne Einwilligung bleibt die Strecke ungeprüft.'
    : flow.from?.point && flow.to?.point
      ? ''
      : 'Bestätige Abholung und Ziel, dann berechnen wir die Strecke.'

  return (
    <>
      <div className="flex flex-col px-5 pt-1 pb-40">
        <p className="m-0 text-subhead text-text-secondary">Ein paar Angaben reichen für den Richtpreis.</p>

        <Step n={1} title="Was muss mit?">
          <Segmented
            label="Transportgut"
            value={flow.goods}
            onChange={(goods) => update({ goods: goods as TransportFlow['goods'] })}
            options={[
              { value: 'normal', label: 'Möbel' },
              { value: 'piano', label: 'Klavier' },
              { value: 'grand', label: 'Flügel' },
              { value: 'safe', label: 'Tresor' },
            ]}
          />
          <p className="m-0 mt-2 px-1 text-footnote text-text-secondary">Klavier, Flügel und Tresor plant ein Partner persönlich.</p>
          <Card className="mt-3 overflow-hidden">
            <label className="flex flex-col gap-1 rounded-t-card px-4 py-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent">
              <span className="text-[13px]/[18px] text-text-secondary">Gegenstände &amp; Umfang</span>
              <textarea
                rows={2}
                maxLength={500}
                value={flow.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder="z. B. 1 Sofa, 2 Schränke, Bett, 20 Kartons"
                className="m-0 resize-none border-0 bg-transparent p-0 text-body outline-none placeholder:text-text-secondary"
              />
            </label>
            <div aria-hidden="true" className="ml-4 h-[0.5px] bg-separator" />
            <ul className="m-0 list-none p-0">
              <StepRow label="Ladevolumen" value={flow.volume} min={1} max={100} display={`${flow.volume} m³`} onChange={(volume) => update({ volume })} labelDown="Volumen verringern" labelUp="Volumen erhöhen" />
            </ul>
          </Card>
          <div className="mt-3">
            <Fotos storeKey={service} />
          </div>
        </Step>

        <Step
          n={2}
          title="Team & Fahrzeuge"
          footnote={
            price ? (
              <>
                {flow.crew} {flow.crew === 1 ? 'Person' : 'Personen'} inklusive Fahrer und {flow.vehicles} {flow.vehicles === 1 ? 'Fahrzeug' : 'Fahrzeuge'}:{' '}
                <span className="font-semibold text-text tabular-nums whitespace-nowrap">{formatEuro(price.hourlyRateCents)} pro Stunde</span>.
              </>
            ) : (
              'Personen inklusive Fahrer.'
            )
          }
        >
          <GroupedList>
            <StepRow label="Personen" value={flow.crew} min={LIMITS.crew[0]} max={LIMITS.crew[1]} display={String(flow.crew)} onChange={(crew) => update({ crew })} labelDown="Weniger Personen" labelUp="Mehr Personen" />
            <StepRow label="Fahrzeuge" value={flow.vehicles} min={LIMITS.vehicles[0]} max={LIMITS.vehicles[1]} display={String(flow.vehicles)} onChange={(vehicles) => update({ vehicles })} labelDown="Weniger Fahrzeuge" labelUp="Mehr Fahrzeuge" />
            <ValueRow label="Fahrzeugart" value={vehicleTypes.find((v) => v.value === flow.vehicleType)?.label} onClick={() => setSheet('vehicle')} />
          </GroupedList>
        </Step>

        <Step n={3} title="Stockwerke & Lift" footnote="0 steht für Erdgeschoss. Ein Lift zählt nur, wenn das Transportgut hineinpasst.">
          <GroupedList>
            <StepRow label="Abholung" sub="Stockwerk" value={flow.fromFloor} min={LIMITS.floor[0]} max={LIMITS.floor[1]} display={floorText(flow.fromFloor)} onChange={(fromFloor) => update({ fromFloor })} labelDown="Stockwerk Abholung verringern" labelUp="Stockwerk Abholung erhöhen" />
            <SwitchRow label="Lift für das Transportgut" checked={flow.fromLift} onChange={(fromLift) => update({ fromLift })} switchLabel="Lift an der Abholung nutzbar" />
            <StepRow label="Ziel" sub="Stockwerk" value={flow.toFloor} min={LIMITS.floor[0]} max={LIMITS.floor[1]} display={floorText(flow.toFloor)} onChange={(toFloor) => update({ toFloor })} labelDown="Stockwerk Ziel verringern" labelUp="Stockwerk Ziel erhöhen" />
            <SwitchRow label="Lift für das Transportgut" checked={flow.toLift} onChange={(toLift) => update({ toLift })} switchLabel="Lift am Ziel nutzbar" />
          </GroupedList>
        </Step>

        <Step
          n={4}
          title="Strecke & Dauer"
          footnote={`Mindestens ${hoursText(minH)}. In Wien inklusive Be- und Entladen und Stadtfahrt. Mit „Adressen für Route nutzen“ gehen Adresstexte an den Routendienst openrouteservice (Deutschland). Kartendaten © OpenStreetMap-Mitwirkende.`}
        >
          <Adressen from={flow.from} to={flow.to} onOpen={setSheet} />
          <RouteKarte result={route} from={flow.from} to={flow.to} loading={calc.loading} error={calc.error} hint={hint} onRetry={calc.retry} />
          <div className="mt-3">
            <GroupedList>
              <SwitchRow
                label="Mit Rückfahrt"
                sub={route ? `${route.totalKm.toFixed(1).replace('.', ',')} km gesamt · ${route.outsideKm.toFixed(1).replace('.', ',')} km außerhalb Wiens` : 'Fahrt zurück zur Abholung'}
                checked={flow.returnTrip}
                onChange={(returnTrip) => setRouteInput({ returnTrip })}
                switchLabel="Rückfahrt berücksichtigen"
              />
              <SwitchRow label="Adressen für Route nutzen" sub="Nur nach deiner Bestätigung" checked={flow.routeConsent} onChange={consent} switchLabel="Adressen für die Routenberechnung übermitteln" />
              <StepRow
                label="Geschätzte Dauer"
                value={flow.hours ?? minH}
                min={minH}
                max={maxHours}
                step={stepHours}
                display={hoursText(flow.hours ?? minH)}
                onChange={(hours) => update({ hours })}
                labelDown="Dauer verringern"
                labelUp="Dauer erhöhen"
              />
            </GroupedList>
          </div>
        </Step>

        <Step n={5} title="Zusatzleistungen" footnote={`Kartons ${formatEuro(num(tariffs, 'box'))} je Stück, Halteverbotszone ${formatEuro(num(tariffs, 'parking_zone'))} je Adresse.`}>
          <GroupedList>
            <SwitchRow label="Montage / Demontage" icon="drill" checked={flow.assembly} onChange={(assembly) => update({ assembly })} switchLabel="Montage oder Demontage dazubuchen" />
            {flow.assembly && (
              <li className="relative before:absolute before:top-0 before:right-0 before:left-[58px] before:h-[0.5px] before:bg-separator">
                <button type="button" onClick={() => setSheet('assembly')} className="press flex min-h-[52px] w-full items-center justify-between gap-3 pr-3 pl-[58px] text-left focus-visible:-outline-offset-2">
                  <span className="text-subhead text-text-secondary">Standardmöbel · {lmText(assemblyLm)}</span>
                  <span className="flex items-center gap-1 whitespace-nowrap text-body tabular-nums">
                    {assemblyCents !== undefined && formatEuro(assemblyCents)}
                    <Icon name="chevron-right" width={18} height={18} className="text-text-secondary opacity-60" />
                  </span>
                </button>
              </li>
            )}
            <StepRow label="Umzugskartons" icon="package" tileClassName="bg-[#2B8C88]" value={flow.boxes} min={LIMITS.boxes[0]} max={LIMITS.boxes[1]} display={String(flow.boxes)} onChange={(boxes) => update({ boxes })} labelDown="Weniger Kartons" labelUp="Mehr Kartons" />
            <StepRow label="Halteverbotszone" icon="close-circle" tileClassName="bg-[#3A7F9A]" value={flow.parking} min={LIMITS.parking[0]} max={LIMITS.parking[1]} display={String(flow.parking)} onChange={(parking) => update({ parking })} labelDown="Weniger Halteverbotszonen" labelUp="Mehr Halteverbotszonen" />
            <SwitchRow label="Einpackservice" sub="Persönliches Angebot" icon="boxes" tileClassName="bg-[#B39A68]" checked={flow.packing} onChange={(packing) => update({ packing })} switchLabel="Einpackservice anfragen" />
          </GroupedList>
        </Step>
      </div>

      <PreisLeiste preview={preview} onOpen={() => setSheet('price')} canContinue={!!flow.from?.point && !!flow.to?.point && !calc.loading} onContinue={() => {
        rememberShown(copy[service].path, shownOf(preview))
        void navigate(`/${copy[service].path}/termin`)
      }} />
      <PreisSheet note="Richtwert auf Basis deiner Angaben. Dauer, Team und Fahrzeug bestätigt der Partner." open={sheet === 'price'} onClose={() => setSheet(null)} preview={preview} describe={(key) => (price ? lineText(key as Parameters<typeof lineText>[0], price, flow, tariffs) : { label: key })} />
      <AdresseSheet which={sheet === 'from' || sheet === 'to' ? sheet : null} place={sheet === 'from' || sheet === 'to' ? flow[sheet] : null} consent={flow.routeConsent} onClose={() => setSheet(null)} onConsent={consent} onPick={pick} />

      <Sheet open={sheet === 'vehicle'} onClose={() => setSheet(null)} title="Fahrzeugart" detents={[0.4, 0.6]}>
        <div role="radiogroup" aria-label="Fahrzeugart" className="flex flex-col overflow-hidden rounded-grouped-list bg-surface shadow-card">
          {vehicleTypes.map((v) => (
            <button
              key={v.value}
              type="button"
              role="radio"
              aria-checked={flow.vehicleType === v.value}
              onClick={() => {
                update({ vehicleType: v.value })
                setSheet(null)
              }}
              className="press flex min-h-14 items-center justify-between gap-3 px-4 text-left text-body focus-visible:-outline-offset-2 not-first:border-t-[0.5px] not-first:border-separator"
            >
              {v.label}
              {flow.vehicleType === v.value && <Icon name="check" width={20} height={20} className="text-primary" />}
            </button>
          ))}
        </div>
        <p className="m-0 mt-2 px-1 text-footnote text-text-secondary">Transporter und Möbel-LKW bis 3,5 t rechnen mit demselben Richtpreis. Für große Fahrzeuge gibt es ein persönliches Angebot.</p>
      </Sheet>

      <Sheet open={sheet === 'assembly'} onClose={() => setSheet(null)} title="Montage / Demontage" detents={[0.4, 0.6]}>
        <GroupedList>
          <StepRow label="Standardmöbel" sub="Laufmeter" value={assemblyLm} min={minLm} max={LIMITS.assemblyLm[1]} step={0.5} display={lmText(assemblyLm)} onChange={(assemblyLm) => update({ assemblyLm })} labelDown="Laufmeter verringern" labelUp="Laufmeter erhöhen" />
        </GroupedList>
        <p className="m-0 mt-2 px-1 text-footnote text-text-secondary">
          {formatEuro(num(tariffs, 'assembly.rate_per_lfm'))} je Laufmeter, mindestens {lmText(minLm)}.
        </p>
      </Sheet>
    </>
  )
}
