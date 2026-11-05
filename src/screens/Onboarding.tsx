import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Backdrop } from '../components/Backdrop'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { Illustration } from '../components/Illustration'
import { finishOnboarding } from '../lib/onboarding'

const pages = [
  {
    title: 'Alles für deinen Move.\nIn einer App.',
    text: 'Transport, Umzug, Entrümpelung, Montage und Transporter. Mit Richtpreis, bevor du dich anmeldest.',
    art: (
      <>
        <Illustration name="van-onboarding" className="mn-bob absolute top-[214px] left-[52px]" />
        <Illustration name="onboarding-karton" className="absolute top-[280px] left-[22px]" />
      </>
    ),
  },
  {
    title: 'Dein Richtpreis. Sofort.',
    text: 'Sag uns, was ansteht, und du siehst gleich, was es ungefähr kostet. Ohne Konto, ohne Anmeldung.',
    art: <Illustration name="service-umzug" width={320} className="mn-bob absolute top-[170px] left-1/2 h-auto -translate-x-1/2" />,
  },
  {
    title: 'Ein Partner bestätigt.',
    text: 'Du sendest eine unverbindliche Anfrage. Der Partner bestätigt Termin und Preis. Ein Konto brauchst du erst beim Absenden.',
    art: <Illustration name="van-large" width={330} className="mn-bob absolute top-[190px] left-1/2 h-auto -translate-x-1/2" />,
  },
]

export function Onboarding() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const page = pages[index]!
  const last = index === pages.length - 1

  function done() {
    finishOnboarding()
    void navigate('/', { replace: true })
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <div className="relative h-[490px] shrink-0 overflow-hidden bg-primary-night">
        <Backdrop />
        <Illustration name="onboarding-route" className="absolute inset-0 size-full" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={index} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
            {page.art}
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-x-5 top-[calc(var(--safe-top)+14px)] flex h-11 items-center justify-between text-white">
          <span className="flex items-center gap-3 text-[20px]/6 font-bold tracking-[-0.3px]">
            <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-(image:--gradient-app-icon)">
              <Icon name="arrow-up-right" width={18} height={18} />
            </span>
            MoveNow
          </span>
          {!last && (
            <button type="button" onClick={done} className="press -mr-2 flex h-11 items-center rounded-lg px-2 text-body text-white/80 focus-visible:outline-mint">
              Überspringen
            </button>
          )}
        </div>
      </div>

      <section className="relative -mt-8 flex flex-1 flex-col rounded-t-sheet-top bg-background px-6 pt-6 pb-[max(var(--safe-bottom),24px)]">
        <div role="progressbar" aria-label="Seite" aria-valuemin={1} aria-valuemax={pages.length} aria-valuenow={index + 1} className="flex gap-1.5">
          {pages.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-[3px] transition-all ${i === index ? 'w-[22px] bg-primary' : 'w-1.5 bg-fill'}`} />
          ))}
        </div>
        {/* Der Fokus bleibt auf „Weiter"; die neue Seite wird daher als höfliche Live-Region angesagt (WCAG 4.1.3) */}
        <div aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3 pt-6">
              <h1 className="m-0 whitespace-pre-line text-title1">{page.title}</h1>
              <p className="m-0 text-body text-text-secondary">{page.text}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="mt-auto pt-6">
          <Button onClick={() => (last ? done() : setIndex(index + 1))}>{last ? 'Los geht’s' : 'Weiter'}</Button>
        </div>
      </section>
    </main>
  )
}
