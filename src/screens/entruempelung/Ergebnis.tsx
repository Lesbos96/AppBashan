import { num } from '@pricing'
import type { ClearancePrice } from '@pricing'
import { motion, useReducedMotion } from 'motion/react'
import { Link, Navigate, useNavigate } from 'react-router'
import { ActionBar, Progress } from '../../components/Bars'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { ErrorState, Loading } from '../../components/States'
import { AmountRow, GroupedList } from '../../components/Surfaces'
import { rememberShown } from '../../lib/draft'
import { type ClearanceFlow, useClearanceFlow } from '../../lib/flow'
import { formatEuro, formatEuroRounded } from '../../lib/money'
import { usePhotos } from '../../lib/photos'
import { loadPrices, useLoad } from '../../lib/prices'
import { clearanceLineText, floorText, offerReasonText, previewClearance, toTariffs } from '../../lib/preview'
import { spring } from '../../lib/motion'
import { Position } from '../konfigurator/Preis'
import { BackIcon, Kopf, backClass } from './Kopf'
import { fills, objectOf } from './options'

export function EntruempelungErgebnis() {
  const [prices, retry] = useLoad(loadPrices)
  if (prices.status === 'loading') return <Loading label="Preise laden" />
  if (prices.status === 'error') return <ErrorState text="Die Preise konnten nicht geladen werden. Prüfe deine Verbindung." onRetry={retry} />
  return <Inhalt tariffs={toTariffs(prices.data)} />
}

/** Marker auf der Spanne: links der niedrige, rechts der hohe Richtwert. */
function Spanne({ fraction }: { fraction: number }) {
  const reduced = useReducedMotion()
  const left = `${Math.round(fraction * 1000) / 10}%`
  return (
    <div className="relative mt-[18px] h-[22px]">
      <span aria-hidden="true" className="absolute inset-x-0 top-[7px] h-2 rounded-full" style={{ background: `linear-gradient(90deg, var(--range-track) 0%, var(--range-track-mid) ${left}, var(--range-track) 100%)` }} />
      <motion.span
        aria-hidden="true"
        initial={{ left: reduced ? left : '0%' }}
        animate={{ left }}
        transition={spring}
        className="absolute top-0 -ml-[11px] size-[22px] rounded-full bg-surface shadow-[inset_0_0_0_3px_var(--accent),0_2px_8px_rgba(7,92,97,0.25)]"
      />
    </div>
  )
}

function Angabe({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <li className="flex min-h-12 items-center gap-3 px-4 py-1 not-first:border-t-[0.5px] not-first:border-separator">
      <Icon name={icon} width={22} height={22} className="shrink-0 text-accent" />
      <span className="flex-1 text-body">{label}</span>
      <span className="min-w-0 text-right text-body text-text-secondary tabular-nums">{value}</span>
    </li>
  )
}

const access = (f: ClearanceFlow) => (f.floor === 0 ? floorText(0) : `${floorText(f.floor)}, ${f.lift ? 'mit' : 'ohne'} Lift`)

function Inhalt({ tariffs }: { tariffs: Record<string, number> }) {
  const [flow, update] = useClearanceFlow()
  const navigate = useNavigate()
  const photos = usePhotos('clearance').photos.length
  const object = objectOf(flow)
  if (!object) return <Navigate to="/entruempelung" replace />
  let preview
  try {
    preview = previewClearance(tariffs, flow)
  } catch {
    return <ErrorState text="Deine gespeicherten Angaben passen nicht mehr. Starte neu mit leeren Angaben." onRetry={() => void navigate('/entruempelung')} />
  }
  const price: ClearancePrice | null = preview.state === 'price' ? preview.price : null
  const fill = fills.find((f) => f.value === flow.fill)!
  const photoText = photos === 0 ? 'ohne Fotos' : `${photos} ${photos === 1 ? 'Foto' : 'Fotos'}`
  const hero = price ? `ca. ${formatEuroRounded(price.totalCents)}` : ''

  return (
    <main>
      <Kopf
        back={
          <Link to="/entruempelung" onClick={() => update({ step: 6 })} aria-label="Zurück" className={backClass}>
            <BackIcon />
          </Link>
        }
      />
      <div className="flex flex-col px-5 pt-3 pb-40">
        <Progress value={6} max={6} label="Alle Schritte erledigt" />
        <h1 className="m-0 mt-[22px] mb-1.5 text-title1">{price ? 'Dein erster Preisrahmen.' : 'Wir schauen genauer hin.'}</h1>
        <p className="m-0 text-subhead text-text-secondary">{price ? 'Ohne Kontaktdaten. Unverbindlich und nachvollziehbar.' : 'Ein Partner prüft den Auftrag, bevor es einen Preis gibt.'}</p>

        {price ? (
          <section aria-label="Richtwert" className="mt-5 flex flex-col rounded-[24px] bg-surface p-5 shadow-card">
            <span className="text-[13px]/4 text-text-secondary">Wiener Preisorientierung · inkl. USt.</span>
            <span className={`mt-1 whitespace-nowrap font-bold tabular-nums ${hero.length > 15 ? 'text-[32px]/10 tracking-[-0.8px]' : 'text-[40px]/12 tracking-[-1px]'}`}>{hero}</span>
            <Spanne fraction={price.highCents > price.lowCents ? (price.totalCents - price.lowCents) / (price.highCents - price.lowCents) : 0.5} />
            {formatEuroRounded(price.lowCents) !== formatEuroRounded(price.highCents) && (
              <div className="mt-2 flex justify-between text-[13px]/4 whitespace-nowrap text-text-secondary tabular-nums">
                <span>{formatEuroRounded(price.lowCents)}</span>
                <span>{formatEuroRounded(price.highCents)}</span>
              </div>
            )}
            <p className="m-0 mt-3 text-[13px]/[18px] text-text-secondary">
              Spanne aus {formatEuro(num(tariffs, 'clearance.rate_low'))} bis {formatEuro(num(tariffs, 'clearance.rate_high'))} je m³. Fixpreis erst nach Prüfung durch den Partner.
            </p>
          </section>
        ) : (
          preview.state === 'offer' && (
            <section aria-label="Besichtigung" className="mt-5 flex flex-col gap-3 rounded-[24px] bg-surface p-5 shadow-card">
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {preview.offer.reasons.map((r) => (
                  <li key={r} className="text-body">
                    {offerReasonText[r]}
                  </li>
                ))}
              </ul>
              <p className="m-0 text-footnote text-text-secondary">Aus der Fläche allein lässt sich hier kein seriöser Preis ableiten. Umfang und Entsorgungsweg werden zuerst geprüft.</p>
            </section>
          )
        )}

        <div className="mx-4 mt-6 mb-2 flex items-baseline justify-between">
          <h2 className="m-0 text-section-header font-normal text-text-secondary">Deine Angaben</h2>
          <Link to="/entruempelung" onClick={() => update({ step: 1 })} className="press flex h-11 items-center text-[15px] font-medium text-accent">
            Ändern
          </Link>
        </div>
        <ul className="m-0 flex list-none flex-col overflow-hidden rounded-grouped-list bg-surface p-0 shadow-card">
          <Angabe icon={object.icon} label={object.label} value={`${flow.area} m² · ${fill.short}`} />
          <Angabe icon="stairs" label="Zugang" value={access(flow)} />
          <Angabe icon="boxes" label="Räumgut" value={price ? `≈ ${String(price.volumeM3).replace('.', ',')} m³ · ${photoText}` : photoText} />
          {flow.assembly && <Angabe icon="drill" label="Montage" value={flow.draft.kind === 'kitchen' ? 'Küche' : 'Standardmöbel'} />}
          {flow.special && <Angabe icon="shield" label="Sonderfall" value="Besondere Abfälle" />}
        </ul>

        {price && (
          <>
            <h2 className="m-0 mx-4 mt-6 mb-2 text-section-header font-normal text-text-secondary">Positionen</h2>
            <GroupedList>
              {price.lines.map((l) => {
                const t = clearanceLineText(l.key, price, flow, tariffs)
                return <Position key={l.key} label={t.label} detail={t.detail} cents={l.cents} />
              })}
              <AmountRow label="Gesamt" cents={price.totalCents} strong />
            </GroupedList>
            <Link to="/profil/preise" className="press mt-2.5 flex h-11 items-center gap-1.5 self-center px-3 text-[15px] font-semibold text-accent">
              <Icon name="info" width={18} height={18} />
              Wie kommt der Richtwert zustande?
            </Link>
          </>
        )}
      </div>

      <ActionBar>
        <Button
          onClick={() => {
            rememberShown('entruempelung', price ? price.totalCents : null)
            void navigate('/entruempelung/termin')
          }}
        >{price ? 'Ort & Wunschtermin' : 'Besichtigung anfragen'}</Button>
      </ActionBar>
    </main>
  )
}
