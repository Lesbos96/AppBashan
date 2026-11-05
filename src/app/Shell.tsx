import { AnimatePresence, motion, type Variants } from 'motion/react'
import { useEffect, useState } from 'react'
import { ScrollRestoration, useMatches, useNavigationType, useOutlet } from 'react-router'
import { TabBar } from '../components/Bars'
import { spring } from '../lib/motion'
import { useOnline } from '../lib/online'

const tabs = [
  { to: '/', label: 'Start', icon: 'home' },
  { to: '/miete', label: 'Miete', icon: 'truck' },
  { to: '/auftraege', label: 'Aufträge', icon: 'orders' },
  { to: '/profil', label: 'Profil', icon: 'profile' },
]

/** `key` bestimmt, wann die Seite wechselt (Profil und Info-Sheet teilen sich eine); `title` ist der Seitentitel (WCAG 2.4.2); `root` = Tab-Wurzel; `bar: false` blendet die Tab-Bar aus. */
export type Handle = { key: string; title: string; root?: true; bar?: false }

const documentTitle = (title: string) => `${title} · MoveNow`

type Direction = 'push' | 'pop' | 'tab'

// Tab-Wechsel blenden über, Vor und Zurück schieben im iOS-Stil; mit reduzierter Bewegung bleibt nur die Überblendung (MotionConfig).
const pages: Variants = {
  enter: (d: Direction) => ({ opacity: 0, x: d === 'push' ? '100%' : d === 'pop' ? '-28%' : 0 }),
  center: { opacity: 1, x: 0 },
  exit: (d: Direction) => ({ opacity: 0, x: d === 'push' ? '-28%' : d === 'pop' ? '100%' : 0 }),
}

export function Shell() {
  const outlet = useOutlet()
  const type = useNavigationType()
  const handle = useMatches().at(-1)?.handle as Handle
  const online = useOnline()
  const [nav, setNav] = useState<{ handle: Handle; direction: Direction; seq: number }>({ handle, direction: 'tab', seq: 0 })

  // Jeder Seitenwechsel bekommt eine neue Instanz (seq): Kehrt man während der Ausblendung auf dieselbe Seite zurück, belebte AnimatePresence sonst die alte Instanz samt Zustand.
  // Richtung beim Wechsel der Seite festlegen (abgeleiteter Zustand, kein Effekt)
  if (nav.handle.key !== handle.key) {
    setNav({ handle, direction: nav.handle.root && handle.root ? 'tab' : type === 'POP' ? 'pop' : 'push', seq: nav.seq + 1 })
  }

  useEffect(() => {
    document.title = documentTitle(handle.title)
  }, [handle.title])

  // Nach einem Seitenwechsel (nicht beim ersten Laden) Fokus auf die Überschrift der neuen Seite: Bildschirmleser sagen die Seite an,
  // Tab geht von dort weiter. Sonst fiele der Fokus mit der ausblendenden Seite auf body. Lädt die Seite ihre Überschrift erst nach,
  // wartet ein Observer (höchstens 5 s); hat der Nutzer oder die Seite den Fokus schon in die neue Seite gesetzt, bleibt er dort.
  useEffect(() => {
    if (nav.seq === 0) return
    const container = document.querySelector<HTMLElement>(`[data-page="${nav.seq}"]`)
    if (!container) return
    const focusHeading = () => {
      const h1 = container.querySelector<HTMLElement>('h1')
      if (!h1) return false
      if (container.contains(document.activeElement)) return true
      if (!h1.hasAttribute('tabindex')) h1.tabIndex = -1
      h1.focus({ preventScroll: true })
      return true
    }
    if (focusHeading()) return
    const observer = new MutationObserver(() => focusHeading() && observer.disconnect())
    observer.observe(container, { childList: true, subtree: true })
    const timer = setTimeout(() => observer.disconnect(), 5000)
    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [nav.seq])

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-(--content-max-width) overflow-x-clip">
      {!online && (
        <p role="status" className="glass fixed inset-x-0 top-0 z-30 m-0 px-4 pt-[max(var(--safe-top),8px)] pb-2 text-center text-footnote text-text-secondary">
          Du bist offline. Sobald du wieder online bist, lädt alles nach.
        </p>
      )}
      <AnimatePresence mode="popLayout" initial={false} custom={nav.direction}>
        <motion.div
          key={`${handle.key}:${nav.seq}`}
          data-page={nav.seq}
          custom={nav.direction}
          variants={pages}
          initial="enter"
          animate="center"
          exit="exit"
          transition={spring}
          className={`min-h-dvh w-full bg-background ${handle.bar === false ? 'pb-safe' : 'pb-[calc(49px+var(--safe-bottom)+24px)]'}`}
        >
          {outlet}
        </motion.div>
      </AnimatePresence>
      {handle.bar !== false && <TabBar tabs={tabs} />}
      <ScrollRestoration />
    </div>
  )
}
