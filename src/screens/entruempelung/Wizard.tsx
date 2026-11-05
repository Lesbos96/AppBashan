import { LIMITS, num } from '@pricing'
import { motion } from 'motion/react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ActionBar, Progress } from '../../components/Bars'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { Illustration } from '../../components/Illustration'
import { ErrorState, Loading } from '../../components/States'
import { Card, Field, GroupedList, StepRow, SwitchRow } from '../../components/Surfaces'
import { type ClearanceFlow, clearanceSteps, useClearanceFlow } from '../../lib/flow'
import { formatEuro } from '../../lib/money'
import { loadPrices, useLoad } from '../../lib/prices'
import { floorText, toTariffs } from '../../lib/preview'
import { spring } from '../../lib/motion'
import { AssemblyEditor } from '../konfigurator/AssemblyEditor'
import { Fotos } from '../konfigurator/Fotos'
import { BackIcon, Kopf, backClass } from './Kopf'
import { fills, objectOf, objects } from './options'

const titles = [
  { title: 'Was soll geräumt werden?', hint: 'Wähle die Art des Objekts.' },
  { title: 'Wie groß ist die Fläche?', hint: 'Nur die Fläche, die geräumt werden soll. Kubikmeter rechnen wir für dich aus.' },
  { title: 'Wie voll ist der Bereich?', hint: 'Eine grobe Einschätzung reicht.' },
  { title: 'Wie ist der Zugang?', hint: 'Damit Tragewege und Aufwand berücksichtigt werden.' },
  { title: 'Was brauchst du zusätzlich?', hint: 'Beides ist optional.' },
  { title: 'Zeig uns, was weg soll.', hint: 'Fotos sind optional und helfen bei der späteren Prüfung.' },
]

export function Entruempelung() {
  const [prices, retry] = useLoad(loadPrices)
  if (prices.status === 'loading') return <Loading label="Preise laden" />
  if (prices.status === 'error') return <ErrorState text="Die Preise konnten nicht geladen werden. Prüfe deine Verbindung." onRetry={retry} />
  return <Formular tariffs={toTariffs(prices.data)} />
}

function OptionCard({ selected, onSelect, title, description, visual }: { selected: boolean; onSelect: () => void; title: string; description: string; visual: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`press flex w-full items-center gap-3.5 rounded-card bg-surface p-3 text-left ${selected ? 'shadow-selected-option' : 'shadow-card'}`}
    >
      {visual}
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="text-headline">{title}</span>
        <span className="text-subhead text-text-secondary">{description}</span>
      </span>
      <span aria-hidden="true" className={`flex size-6 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-primary text-white' : 'ring-[1.6px] ring-text/25 ring-inset'}`}>
        {selected && <Icon name="check" width={14} height={14} strokeWidth={3} />}
      </span>
    </button>
  )
}

/** Fläche als Zahlenfeld mit Schnellwahl; gespeichert wird nur ein gültiger Wert, beim Verlassen zeigt das Feld wieder diesen Wert. */
function Flaeche({ area, onChange }: { area: number; onChange: (area: number) => void }) {
  const [text, setText] = useState(String(area))
  const [min, max] = LIMITS.clearanceArea
  const set = (n: number) => {
    setText(String(n))
    onChange(n)
  }
  return (
    <>
      <GroupedList>
        <Field
          label="Zu räumende Fläche · m²"
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            const n = Number(e.target.value)
            if (e.target.value !== '' && n >= min && n <= max) onChange(n)
          }}
          onBlur={() => setText(String(area))}
        />
      </GroupedList>
      <div className="flex gap-2" role="group" aria-label="Schnellwahl Fläche">
        {[10, 30, 60, 100].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => set(n)}
            aria-pressed={area === n}
            className="press relative flex h-[34px] flex-1 items-center justify-center rounded-full bg-tint text-[14px] font-semibold text-accent tabular-nums before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] aria-pressed:bg-primary aria-pressed:text-white"
          >
            {n} m²
          </button>
        ))}
      </div>
      <p className="m-0 px-1 text-footnote text-text-secondary">Eine grobe Schätzung reicht für den ersten Richtwert.</p>
    </>
  )
}

function Formular({ tariffs }: { tariffs: Record<string, number> }) {
  const [flow, update] = useClearanceFlow()
  const navigate = useNavigate()
  const heading = useRef<HTMLHeadingElement>(null)
  const { step } = flow
  const object = objectOf(flow)
  const last = step === clearanceSteps
  const patch = (p: Partial<ClearanceFlow>) => update(p)

  // Fokus auf die Frage: Screenreader und Tastatur beginnen bei jedem Schritt oben
  useEffect(() => heading.current?.focus({ preventScroll: true }), [step])

  if (step > 1 && !flow.object) return <ErrorState text="Wähle zuerst die Art des Objekts." onRetry={() => update({ step: 1 })} />

  const next = () => (last ? void navigate('/entruempelung/ergebnis') : update({ step: step + 1 }))
  const chip = (label: string, to: number) => (
    <button key={to} type="button" onClick={() => update({ step: to })} aria-label={`${label} ändern`} className="press relative flex h-[30px] items-center gap-1.5 rounded-full bg-tint px-3 text-[13px] font-semibold text-accent tabular-nums before:absolute before:-inset-y-2 before:inset-x-0 before:content-['']">
      {label}
      <Icon name="pencil" width={12} height={12} />
    </button>
  )

  return (
    <main>
      <Kopf
        back={
          step === 1 ? (
            <Link to="/" aria-label="Zurück" className={backClass}>
              <BackIcon />
            </Link>
          ) : (
            <button type="button" aria-label="Zurück" onClick={() => update({ step: step - 1 })} className={backClass}>
              <BackIcon />
            </button>
          )
        }
      />
      <div className="flex flex-col px-5 pt-3 pb-48">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[13px]/4 text-text-secondary tabular-nums">
            <span>
              Schritt {step} von {clearanceSteps}
            </span>
            <span>{Math.round((step / clearanceSteps) * 100)} %</span>
          </div>
          <Progress value={step} max={clearanceSteps} label="Fortschritt" />
        </div>

        {step >= 3 && object && (
          <div className="mt-3.5 flex gap-2">
            {chip(object.label, 1)}
            {chip(`${flow.area} m²`, 2)}
          </div>
        )}

        <h1 ref={heading} tabIndex={-1} className="m-0 mt-[18px] mb-1.5 text-title1 outline-none">
          {titles[step - 1]!.title}
        </h1>
        <p className="m-0 text-subhead text-text-secondary">{titles[step - 1]!.hint}</p>

        <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="mt-5 flex flex-col gap-3">
          {step === 1 && (
            <div role="radiogroup" aria-label="Objektart" className="flex flex-col gap-3">
              {objects.map((o) => (
                <OptionCard
                  key={o.value}
                  selected={flow.object === o.value}
                  onSelect={() => patch({ object: o.value })}
                  title={o.label}
                  description={o.description}
                  visual={
                    <span className="flex size-[60px] shrink-0 items-center justify-center rounded-2xl bg-tint text-accent">
                      <Icon name={o.icon} width={28} height={28} />
                    </span>
                  }
                />
              ))}
            </div>
          )}

          {step === 2 && <Flaeche area={flow.area} onChange={(area) => patch({ area })} />}

          {step === 3 && (
            <div role="radiogroup" aria-label="Füllgrad" className="flex flex-col gap-3">
              {fills.map((f) => (
                <OptionCard
                  key={f.value}
                  selected={flow.fill === f.value}
                  onSelect={() => patch({ fill: f.value })}
                  title={f.label}
                  description={f.description}
                  visual={
                    <span className="block size-[92px] shrink-0 overflow-hidden rounded-2xl">
                      <Illustration name={f.illustration} />
                    </span>
                  }
                />
              ))}
            </div>
          )}

          {step === 4 && (
            <>
              <GroupedList>
                <StepRow label="Stockwerk" sub="0 steht für Erdgeschoss" value={flow.floor} min={LIMITS.floor[0]} max={LIMITS.floor[1]} display={floorText(flow.floor)} onChange={(floor) => patch({ floor })} labelDown="Stockwerk verringern" labelUp="Stockwerk erhöhen" />
                <SwitchRow label="Lift nutzbar" sub="Oder ebenerdiger Zugang" checked={flow.lift} onChange={(lift) => patch({ lift })} switchLabel="Lift für die Gegenstände nutzbar" />
              </GroupedList>
              <p className="m-0 px-1 text-footnote text-text-secondary">
                Ohne Lift {formatEuro(num(tariffs, 'clearance.floor_surcharge'))} je Etage ab dem 2. Stock. Enge Zugänge klärt ein Partner anhand der Fotos.
              </p>
            </>
          )}

          {step === 5 && (
            <>
              <GroupedList>
                <SwitchRow label="Montage / Demontage" sub="Möbel auf- oder abbauen" icon="drill" checked={flow.assembly} onChange={(assembly) => patch({ assembly })} switchLabel="Montage oder Demontage dazubuchen" />
              </GroupedList>
              {flow.assembly && <AssemblyEditor draft={flow.draft} onChange={(draft) => patch({ draft })} tariffs={tariffs} />}
              <GroupedList>
                <SwitchRow label="Besondere Abfälle" sub="Oder unbekannte Materialien" icon="shield" checked={flow.special} onChange={(special) => patch({ special })} switchLabel="Besondere Abfälle oder unbekannte Materialien" />
              </GroupedList>
              <p className="m-0 px-1 text-footnote text-text-secondary">
                Zum Beispiel Farben, Chemikalien oder verdächtige Baustoffe. Dann gibt es keinen Pauschalpreis, ein Partner prüft zuerst den Entsorgungsweg. Küchenanschlüsse und Facharbeiten sind nicht enthalten.
              </p>
            </>
          )}

          {step === 6 && (
            <>
              <Fotos storeKey="clearance" />
              <Card>
                <label className="flex flex-col gap-1 rounded-card px-4 py-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent">
                  <span className="text-[13px]/[18px] text-text-secondary">Was sollten wir noch wissen? (optional)</span>
                  <textarea
                    rows={3}
                    maxLength={800}
                    value={flow.description}
                    onChange={(e) => patch({ description: e.target.value })}
                    placeholder="Zum Beispiel: Ein Schrank bleibt, alles andere kann weg."
                    className="m-0 resize-none border-0 bg-transparent p-0 text-body outline-none placeholder:text-text-secondary"
                  />
                </label>
              </Card>
            </>
          )}
        </motion.div>
      </div>

      <ActionBar>
        <div className="flex w-full flex-col gap-2.5">
          <p className="m-0 text-center text-footnote text-text-secondary">Unverbindlich · ohne Kontaktdaten</p>
          <Button disabled={step === 1 && !flow.object} onClick={next}>
            {last ? 'Richtwert anzeigen' : 'Weiter'}
          </Button>
        </div>
      </ActionBar>
    </main>
  )
}
