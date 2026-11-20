import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { Link } from 'react-router'
import { formatEuro } from '../lib/money'
import { StepPill, Toggle } from './Controls'
import { Icon } from './Icon'

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-card bg-surface shadow-card ${className}`}>{children}</div>
}

export function ServiceCard({ to, title, description, illustration }: { to: string; title: string; description: string; illustration: ReactNode }) {
  return (
    <Link to={to} className="press flex flex-col rounded-card bg-surface p-1.5 text-text shadow-service-card">
      <span className="flex h-[92px] items-center justify-center overflow-hidden rounded-illustration-panel bg-(image:--illustration-panel)">
        {illustration}
      </span>
      <span className="flex flex-col gap-0.5 px-2.5 pt-2.5 pb-2">
        <span className="text-[15px]/5 font-semibold tracking-[-0.2px]">{title}</span>
        <span className="text-[12.5px]/4 text-text-secondary">{description}</span>
      </span>
    </Link>
  )
}

/** Inset Grouped List: Überschrift in Satzschreibung, Zeilen durch Haarlinien getrennt. */
export function GroupedList({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {title && <h2 className="m-0 px-4 text-section-header font-normal text-text-secondary">{title}</h2>}
      <ul className="m-0 flex list-none flex-col overflow-hidden rounded-grouped-list bg-surface p-0 shadow-card">
        {children}
      </ul>
    </section>
  )
}

/** Haarlinie über jeder Zeile außer der ersten, eingerückt (mit Icon-Kachel weiter). */
const separator = (inset: string) =>
  `relative not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:h-[0.5px] not-first:before:bg-separator ${inset}`

const rowBase = 'flex min-h-12 w-full items-center gap-3 py-1 pr-3 pl-4 text-left'

/** Zeile mit optionaler Icon-Kachel; `to` macht sie zum Link mit Chevron. */
export function ListRow({
  label,
  detail,
  icon,
  tileClassName = 'bg-primary',
  to,
  trailing,
}: {
  label: string
  detail?: string
  icon?: string
  tileClassName?: string
  to?: string
  trailing?: ReactNode
}) {
  const content = (
    <>
      {icon && (
        <span className={`flex size-[30px] shrink-0 items-center justify-center rounded-icon-tile text-white ${tileClassName}`}>
          <Icon name={icon} width={19} height={19} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body">{label}</span>
        {detail && <span className="text-footnote text-text-secondary">{detail}</span>}
      </span>
      {trailing}
      {to && <Icon name="chevron-right" width={18} height={18} className="shrink-0 text-text-secondary opacity-60" />}
    </>
  )
  return (
    <li className={separator(icon ? 'not-first:before:left-[58px]' : 'not-first:before:left-4')}>
      {to ? (
        <Link to={to} className={`press ${rowBase} ${detail ? 'py-2.5' : ''} text-text focus-visible:-outline-offset-2`}>
          {content}
        </Link>
      ) : (
        <div className={rowBase}>{content}</div>
      )}
    </li>
  )
}

/**
 * Feld in einer Liste: Label links, Eingabe rechtsbündig; jedes Feld hat ein sichtbares Label.
 * `hintId` macht das Feld hinweisfähig: `hint` steht dann direkt unter der Eingabe in derselben Zeile (höfliche Live-Region),
 * verknüpft über `aria-invalid` und `aria-describedby` (WCAG 3.3.1).
 */
export function Field({ label, className = '', hint, hintId, ...props }: { label: string; hint?: string | null; hintId?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const invalid = hintId && hint ? { 'aria-invalid': true, 'aria-describedby': hintId } : {}
  return (
    <li className={separator('not-first:before:left-4')}>
      <label className="flex min-h-12 items-center gap-3 px-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent">
        <span className="shrink-0 text-body">{label}</span>
        <input
          className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-right text-body text-text-tertiary outline-none placeholder:text-text-secondary ${className}`}
          {...props}
          {...invalid}
        />
      </label>
      {hintId && (
        <div aria-live="polite">
          {hint && (
            <p id={hintId} className="m-0 px-4 pb-2.5 text-footnote text-pretty text-destructive">
              {hint}
            </p>
          )}
        </div>
      )}
    </li>
  )
}

/** Auswahlfeld in einer Liste (natives `select`), Aufbau wie `Field`. */
export function SelectField({ label, children, ...props }: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <li className={separator('not-first:before:left-4')}>
      {/* Reicht die Breite nicht für einen langen Wert (320 px), rutscht die Auswahl unter das Label statt abgeschnitten zu werden */}
      <label className="flex min-h-12 flex-wrap items-center gap-x-3 px-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent">
        <span className="shrink-0 text-body">{label}</span>
        {/* aria-label: der Name soll nicht den Text aller Optionen aus dem umgebenden Label übernehmen */}
        <select aria-label={label} className="min-h-11 min-w-[11rem] flex-1 border-0 bg-transparent p-0 text-right text-body text-text-tertiary outline-none" {...props}>
          {children}
        </select>
      </label>
    </li>
  )
}

/** Betragszeile: Beschreibung bricht um, Betrag nie. */
export function AmountRow({ label, cents, strong }: { label: string; cents: number; strong?: boolean }) {
  return (
    <li className={`${separator('not-first:before:left-4')} flex items-center justify-between gap-3 px-4 py-2 ${strong ? 'min-h-[52px]' : 'min-h-14'}`}>
      <span className={`min-w-0 text-body ${strong ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`shrink-0 whitespace-nowrap text-body tabular-nums ${strong ? 'font-bold' : ''}`}>{formatEuro(cents)}</span>
    </li>
  )
}

type RowLabel = { label: string; sub?: string; icon?: string; tileClassName?: string; /** Kleine Farbkachel statt Icon (z. B. Schrankart); die Klasse setzt die Farbe. */ dotClassName?: string }

const tile = (icon: string | undefined, className = 'bg-primary') =>
  icon && (
    <span aria-hidden="true" className={`flex size-[30px] shrink-0 items-center justify-center rounded-icon-tile text-white ${className}`}>
      <Icon name={icon} width={19} height={19} />
    </span>
  )

const rowText = ({ label, sub }: RowLabel) => (
  <span className="flex flex-auto flex-col gap-px">
    <span className="text-body">{label}</span>
    {sub && <span className="text-[13px]/4 text-text-secondary">{sub}</span>}
  </span>
)

const rowInset = (icon?: string, dot?: string) => separator(icon ? 'not-first:before:left-[58px]' : dot ? 'not-first:before:left-11' : 'not-first:before:left-4')

const dotTile = (className?: string) => className && <span aria-hidden="true" className={`size-3 shrink-0 rounded-[4px] ${className}`} />

/** Zeile mit Wert und Stepper-Pille. */
export function StepRow({
  value,
  min,
  max,
  step = 1,
  display,
  onChange,
  labelDown,
  labelUp,
  ...text
}: RowLabel & { value: number; min: number; max: number; step?: number; display: string; onChange: (v: number) => void; labelDown: string; labelUp: string }) {
  return (
    // Reicht die Breite (320 px) nicht für Label, Wert und Pille, rutschen Wert und Pille in eine eigene Zeile, statt sich zu überlagern
    <li className={`${rowInset(text.icon, text.dotClassName)} flex flex-wrap items-center gap-x-3 gap-y-1 py-1 pr-3 pl-4 ${text.sub ? 'min-h-[60px]' : 'min-h-[52px]'}`}>
      {tile(text.icon, text.tileClassName)}
      {dotTile(text.dotClassName)}
      {rowText(text)}
      <output className="ml-auto whitespace-nowrap text-headline tabular-nums">{display}</output>
      <StepPill
        labelDown={labelDown}
        labelUp={labelUp}
        canDown={value > min}
        canUp={value < max}
        onDown={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
        onUp={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
      />
    </li>
  )
}

/** Zeile mit Schalter; `switchLabel` benennt den Schalter für Screenreader genauer als die sichtbare Zeile. */
export function SwitchRow({ checked, onChange, switchLabel, ...text }: RowLabel & { checked: boolean; onChange: (v: boolean) => void; switchLabel: string }) {
  return (
    <li className={`${rowInset(text.icon)} flex items-center gap-3 px-4 ${text.sub ? 'min-h-[60px]' : 'min-h-[52px]'}`}>
      {tile(text.icon, text.tileClassName)}
      {rowText(text)}
      <Toggle label={switchLabel} checked={checked} onChange={onChange} />
    </li>
  )
}

/** Zeile mit Wert und Chevron, öffnet `onClick` (z. B. ein Sheet). */
export function ValueRow({ label, sub, value, onClick, icon }: RowLabel & { value?: string; onClick: () => void }) {
  return (
    <li className={rowInset(icon)}>
      <button type="button" onClick={onClick} className={`press flex w-full items-center gap-3 pr-3 pl-4 text-left focus-visible:-outline-offset-2 ${sub ? 'min-h-[64px]' : 'min-h-[52px]'}`}>
        {tile(icon)}
        {rowText({ label, sub })}
        {value && <span className="min-w-0 truncate whitespace-nowrap text-body text-text-secondary tabular-nums">{value}</span>}
        <Icon name="chevron-right" width={18} height={18} className="shrink-0 text-text-secondary opacity-60" />
      </button>
    </li>
  )
}
