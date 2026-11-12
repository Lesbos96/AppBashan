import { animate, motion, useDragControls, useMotionValue, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { spring } from '../lib/motion'
import { Icon } from './Icon'

/**
 * Bottom Sheet auf nativem `<dialog>` (Fokusfalle, Esc, Hintergrund inert).
 * `detents` sind Anteile der Fensterhöhe, aufsteigend; gezogen wird am Griff.
 * Unter die unterste Stufe ziehen, Esc oder Tippen auf den Hintergrund schließt.
 */
// Platz für Griff (44 px, 20 px davon überlappen) und Titelleiste (44 px) über dem Inhalt
const CHROME = 24 + 44

export function Sheet({ open, onClose, title, detents = [0.6, 0.92], locked = false, fit = false, children }: { open: boolean; onClose: () => void; title: string; detents?: number[]; /** Solange gesperrt, schließt weder Esc, Hintergrund, Ziehen noch das Symbol (laufende Aktion). */ locked?: boolean; /** Höhe richtet sich nach dem Inhalt (höchstens die größte Stufe), es gibt dann nur diese eine Stufe: kein Leerraum unter kurzem Inhalt. */ fit?: boolean; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const controls = useDragControls()
  // animate() ist imperativ und folgt MotionConfig nicht
  const move = useReducedMotion() ? { duration: 0 } : spring
  const y = useMotionValue(0)
  const [height, setHeight] = useState(0)

  // Stufen als y-Versatz vom höchsten Stand; `height` ist die Sheet-Höhe (höchste Stufe). Mit `fit` gibt es nur die Stufe 0 (ganz offen).
  const stops = fit ? [0] : detents.map((d) => height - Math.round(d * window.innerHeight)).reverse()

  /** Höhe passend zum Inhalt (inkl. Abstand unten), höchstens die größte Stufe. */
  const fitHeight = () => {
    const max = Math.round(Math.max(...detents) * window.innerHeight)
    if (!fit || !inner.current || !scroller.current) return max
    const pad = parseFloat(getComputedStyle(scroller.current).paddingBottom) || 0
    return Math.min(max, Math.ceil(inner.current.offsetHeight + pad + CHROME))
  }

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      const h = fitHeight()
      setHeight(h)
      y.set(h)
      animate(y, fit ? 0 : h - Math.round(Math.min(...detents) * window.innerHeight), move)
    }
    if (!open && el.open) el.close()
    // detents sind pro Aufruf konstant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Mit `fit` wächst und schrumpft das Sheet mit dem Inhalt (z. B. nächster Schritt, Fehlertext), solange es offen und in Ruhe ist
  useEffect(() => {
    const el = inner.current
    if (!fit || !open || !el) return
    const ro = new ResizeObserver(() => {
      const h = fitHeight()
      setHeight(h)
      if (Math.abs(y.get()) < 1) y.set(0)
    })
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, open])

  async function dismiss() {
    if (locked) {
      animate(y, stops[0] ?? 0, move)
      return
    }
    await animate(y, height, move)
    onClose()
  }

  function release(velocity: number) {
    const target = y.get() + velocity * 0.2
    const next = [...stops, height].reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a))
    if (next === height) void dismiss()
    else animate(y, next, move)
  }

  return (
    <dialog
      ref={dialog}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        void dismiss()
      }}
      onClick={(e) => e.target === dialog.current && void dismiss()}
      className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-sheet-dim"
    >
      <motion.div
        drag="y"
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: Math.min(...stops, 0), bottom: height }}
        dragElastic={0.05}
        onDragEnd={(_, info) => release(info.velocity.y)}
        style={{ y, height }}
        className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-(--content-max-width) flex-col rounded-t-sheet-top bg-background text-text shadow-sheet"
      >
        <div onPointerDown={(e) => controls.start(e)} className="-mb-5 flex h-11 shrink-0 cursor-grab touch-none items-start justify-center pt-1.5">
          <span className="h-[5px] w-9 rounded-[3px] bg-text/20" />
        </div>
        <header className="relative flex h-11 shrink-0 items-center justify-center px-14">
          {/* Fokus beim Öffnen auf den Titel statt auf „Schließen" */}
          <h2 tabIndex={-1} autoFocus className="m-0 truncate text-headline outline-none">
            {title}
          </h2>
          <button type="button" aria-label="Schließen" disabled={locked} onClick={() => void dismiss()} className="press absolute top-0 right-2 flex size-11 items-center justify-center">
            <span className="flex size-8 items-center justify-center rounded-full bg-fill text-text-secondary">
              <Icon name="close" width={16} height={16} />
            </span>
          </button>
        </header>
        {/* scroll-py: fokussierte Elemente landen nicht am Rand des Scrollbereichs, der Fokusrahmen bleibt ganz sichtbar */}
        <div ref={scroller} className="min-h-0 flex-1 scroll-py-4 overflow-y-auto px-4 pb-[max(var(--safe-bottom),16px)]">
          <div ref={inner}>{children}</div>
        </div>
      </motion.div>
    </dialog>
  )
}
