import { motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { spring } from '../lib/motion'
import { Icon } from './Icon'

const column = 'fixed inset-x-0 mx-auto w-full max-w-(--content-max-width)'

export type Tab = { to: string; label: string; icon: string }

/** Glas-Tab-Bar; aktiv: gefülltes Icon (`<icon>-filled`) in Primärfarbe. */
export function TabBar({ tabs }: { tabs: Tab[] }) {
  return (
    <nav
      aria-label="Hauptnavigation"
      className={`${column} glass bottom-0 z-20 grid items-start border-t-[0.5px] border-separator px-2 pb-safe`}
      // gleich breite Spalten je Tab (Phase 1: drei, Galerie: vier)
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className="press flex h-[49px] flex-col items-center justify-center gap-0.5 text-[10.5px]/3 font-medium text-text-secondary aria-[current=page]:font-semibold aria-[current=page]:text-accent"
        >
          {({ isActive }) => (
            <>
              <Icon name={isActive ? `${tab.icon}-filled` : tab.icon} width={26} height={26} />
              {tab.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

/** Fixierte Aktionsleiste für Buchungsflows (ersetzt dort die Tab-Bar). */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className={`${column} glass bottom-0 z-20 flex items-center gap-3 border-t-[0.5px] border-separator px-5 pt-3 min-[520px]:max-w-[calc(var(--content-max-width)-2.5rem)] min-[520px]:px-0 pb-[max(var(--safe-bottom),12px)]`}>
      {children}
    </div>
  )
}

/**
 * Navigationsleiste mit Large Title. Scrollt der große Titel unter die Leiste,
 * erscheint der kleine Titel in der Leiste (Glas); der Abschnitt darunter bleibt stehen.
 */
export function NavBar({ title, back, trailing }: { title: string; back?: { to: string; label: string }; trailing?: ReactNode }) {
  const marker = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    const el = marker.current
    if (!el) return
    // Die Leiste misst 44 px plus Safe Area oben (Notch); ab dort verschwindet der große Titel darunter.
    const height = bar.current?.offsetHeight ?? 44
    const observer = new IntersectionObserver(([entry]) => entry && setCollapsed(!entry.isIntersecting && entry.boundingClientRect.top < height), {
      rootMargin: `-${height}px 0px 0px 0px`,
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <header>
      <div ref={bar} className={`${column} top-0 z-10 pt-safe ${collapsed ? 'glass-strong border-b-[0.5px] border-separator' : ''}`}>
        <div className="relative flex h-11 items-center justify-between px-2 text-accent">
          {back ? (
            <Link to={back.to} className="press flex h-11 min-w-11 items-center gap-0.5 text-body">
              <Icon name="chevron-left" width={24} height={24} strokeWidth={2.2} />
              {back.label}
            </Link>
          ) : (
            <span />
          )}
          <motion.span
            aria-hidden="true"
            animate={{ opacity: collapsed ? 1 : 0 }}
            className="pointer-events-none absolute inset-x-16 truncate text-center text-headline text-text"
          >
            {title}
          </motion.span>
          <span className="flex min-w-11 justify-end">{trailing}</span>
        </div>
      </div>
      <div className="h-[calc(44px+var(--safe-top))]" />
      <div ref={marker} className="px-5">
        <h1 className="m-0 text-large-title">{title}</h1>
      </div>
    </header>
  )
}

/** Fortschrittsanzeige in Segmenten; das aktuelle Segment füllt sich beim Einblenden. */
export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={max}
      aria-valuenow={value}
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${max}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className="block h-1.5 overflow-hidden rounded-[3px] bg-fill">
          {i < value - 1 && <span className="block h-full rounded-[3px] bg-primary" />}
          {i === value - 1 && (
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={spring}
              className="block h-full rounded-[3px] bg-primary"
            />
          )}
        </span>
      ))}
    </div>
  )
}
