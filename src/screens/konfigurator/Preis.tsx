import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ActionBar } from '../../components/Bars'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { AmountRow, GroupedList } from '../../components/Surfaces'
import { formatEuro } from '../../lib/money'
import { type LineText, type PreviewOf, offerReasonText } from '../../lib/preview'
import type { PriceResult } from '@pricing'

/** Nur die Strecke fehlt (nicht berechnet, ungeprüft oder Fehler); alles andere ist ein echtes persönliches Angebot. */
const isRouteMissing = (p: PreviewOf<PriceResult>) => p.state === 'offer' && p.offer.reasons.length === 1 && p.offer.reasons[0] === 'route_missing'

/** Zählt beim Ändern sanft zum neuen Betrag; die Anzeige geht immer über `formatEuro`. */
function CountUp({ cents }: { cents: number }) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(cents)
  const from = useRef(cents)
  useEffect(() => {
    const controls = animate(from.current, cents, {
      duration: reduced ? 0 : 0.4,
      ease: 'easeOut',
      onUpdate: (v) => {
        from.current = v
        setShown(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [cents, reduced])
  return <>{formatEuro(shown)}</>
}

/** Fixierte Preiskarte; ein Tipp öffnet das Sheet mit allen Positionen. */
export function PreisLeiste({ preview, onOpen, canContinue, onContinue }: { preview: PreviewOf<PriceResult>; onOpen: () => void; canContinue: boolean; onContinue: () => void }) {
  const price = preview.state === 'price'
  const missing = isRouteMissing(preview)
  return (
    <ActionBar>
      <button
        type="button"
        onClick={onOpen}
        aria-label={price ? `Richtpreis ${formatEuro(preview.price.totalCents)}, alle Positionen anzeigen` : missing ? 'Strecke fehlt, Details anzeigen' : 'Persönliches Angebot, Details anzeigen'}
        className="press flex h-[54px] min-w-0 flex-1 flex-col justify-center gap-px px-1 text-left"
      >
        <span className="flex items-center gap-1 text-[12.5px]/4 text-text-secondary">
          {price ? 'Richtpreis · inkl. USt.' : 'Noch kein Richtpreis'}
          <Icon name="chevron-up" width={14} height={14} />
        </span>
        <span className={`truncate whitespace-nowrap tracking-[-0.5px] tabular-nums ${price ? 'text-price-bar' : 'text-headline'}`}>
          {price ? <CountUp cents={preview.price.totalCents} /> : missing ? 'Strecke fehlt' : 'Persönliches Angebot'}
        </span>
      </button>
      <Button disabled={!canContinue} onClick={onContinue} className="w-[152px]! shrink-0">
        Weiter
      </Button>
    </ActionBar>
  )
}

/** `describe` beschriftet die Zeilen; die Beträge kommen unverändert aus dem Preismodul. */
export function PreisSheet({ open, onClose, preview, describe, note }: { open: boolean; onClose: () => void; preview: PreviewOf<PriceResult>; describe: (key: string) => LineText; note: string }) {
  return (
    <Sheet open={open} onClose={onClose} title={preview.state === 'price' ? 'Richtpreis' : isRouteMissing(preview) ? 'Strecke fehlt' : 'Persönliches Angebot'} detents={[0.8, 0.92]}>
      {preview.state === 'price' ? (
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col items-center gap-1 pt-1 text-center">
            <p className="m-0 whitespace-nowrap text-price-hero tabular-nums">{formatEuro(preview.price.totalCents)}</p>
            <p className="m-0 text-subhead text-text-secondary">Unverbindliche Preisorientierung · inkl. 20 % USt.</p>
          </div>
          <GroupedList>
            {preview.price.lines.map((l) => {
              const t = describe(l.key)
              return <Position key={l.key} label={t.label} detail={t.detail} cents={l.cents} />
            })}
            <AmountRow label="Gesamt" cents={preview.price.totalCents} strong />
          </GroupedList>
          <p className="m-0 px-1 text-footnote text-text-secondary">{note}</p>
          <Link to="/profil/preise" className="press flex h-11 items-center justify-center gap-1.5 text-body font-semibold">
            <Icon name="info" width={18} height={18} />
            Wie rechnet MoveNow?
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1 pt-3">
            <p className="m-0 text-title2">{isRouteMissing(preview) ? 'Ohne Strecke gibt es keinen Richtpreis.' : 'Wir planen deinen Auftrag persönlich.'}</p>
            <p className="m-0 text-subhead text-text-secondary">
              {isRouteMissing(preview)
                ? 'Bestätige Abholung und Ziel, dann rechnen wir den Richtpreis. Sonst meldet sich ein Partner mit einem persönlichen Angebot.'
                : 'Dafür gibt es keinen Richtpreis. Ein Partner meldet sich mit einem passenden Angebot.'}
            </p>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 rounded-grouped-list bg-surface p-4 shadow-card">
            {preview.offer.reasons.map((r) => (
              <li key={r} className="text-body">
                {offerReasonText[r]}
              </li>
            ))}
          </ul>
          {preview.offer.pianoGuideCents !== undefined && (
            <p className="m-0 px-1 text-footnote text-text-secondary">
              Zur Orientierung für den Klaviertransport: {formatEuro(preview.offer.pianoGuideCents)} inkl. USt. Das ist der Richtwert eines Anbieters in Wien, kein Preis für deinen Auftrag.
            </p>
          )}
        </div>
      )}
    </Sheet>
  )
}

/** Preisposition: Beschreibung bricht um, der Betrag nie. */
export function Position({ label, detail, cents }: { label: string; detail?: string; cents: number }) {
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-2.5 not-first:border-t-[0.5px] not-first:border-separator">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body">{label}</span>
        {detail && <span className="text-subhead text-text-secondary">{detail}</span>}
      </span>
      <span className="shrink-0 whitespace-nowrap text-body tabular-nums">{formatEuro(cents)}</span>
    </li>
  )
}
