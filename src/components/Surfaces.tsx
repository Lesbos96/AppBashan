import type { InputHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'
import { formatEuro } from '../lib/money'
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
        <Link to={to} className={`press ${rowBase} ${detail ? 'py-2.5' : ''} text-text`}>
          {content}
        </Link>
      ) : (
        <div className={rowBase}>{content}</div>
      )}
    </li>
  )
}

/** Feld in einer Liste: Label links, Eingabe rechtsbündig; jedes Feld hat ein sichtbares Label. */
export function Field({ label, className = '', ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <li className={separator('not-first:before:left-4')}>
      <label className="flex min-h-12 items-center gap-3 px-4 has-[:focus-visible]:outline-3 has-[:focus-visible]:-outline-offset-3 has-[:focus-visible]:outline-accent/45">
        <span className="shrink-0 text-body">{label}</span>
        <input
          className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-right text-body text-text-tertiary outline-none placeholder:text-text-secondary ${className}`}
          {...props}
        />
      </label>
    </li>
  )
}

/** Betragszeile: Beschreibung bricht um, Betrag nie. */
export function AmountRow({ label, cents, strong }: { label: string; cents: number; strong?: boolean }) {
  return (
    <li className={`${separator('not-first:before:left-4')} flex items-center justify-between gap-3 px-4 py-2 ${strong ? 'min-h-[52px]' : 'min-h-14'}`}>
      <span className="min-w-0 text-body">{label}</span>
      <span className={`shrink-0 whitespace-nowrap text-body tabular-nums ${strong ? 'font-bold' : ''}`}>{formatEuro(cents)}</span>
    </li>
  )
}
