import { Link } from 'react-router'
import { NavBar } from '../components/Bars'
import { Backdrop } from '../components/Backdrop'
import { Icon } from '../components/Icon'
import { Illustration } from '../components/Illustration'
import { ServiceCard } from '../components/Surfaces'

const services = [
  { to: '/transport', title: 'Möbeltransport', description: 'Einzelne Möbel', illustration: 'service-moebel' },
  { to: '/umzug', title: 'Umzug', description: 'Ganzes Zuhause', illustration: 'service-umzug' },
  { to: '/entruempelung', title: 'Entrümpelung', description: 'Räumen & entsorgen', illustration: 'service-entruempelung' },
  { to: '/montage', title: 'Montage', description: 'Auf- und Abbau', illustration: 'service-montage' },
]

// Es gibt vorerst nur Wien; die Region ist eine Angabe, keine Auswahl.
function Region() {
  return (
    <span className="mr-3 flex h-[34px] items-center gap-1.5 rounded-full bg-tint pr-3 pl-2.5 text-subhead font-semibold text-accent">
      <Icon name="pin" width={17} height={17} />
      <span className="sr-only">Region:</span>
      Wien, AT
    </span>
  )
}

export function Start() {
  return (
    <main>
      <NavBar title="Start" trailing={<Region />} />
      <div className="flex flex-col px-5 pt-4">
        <section
          aria-label="MoveNow"
          className="relative h-[204px] overflow-hidden rounded-hero-card bg-primary-night text-white shadow-[0_1px_2px_rgba(16,47,53,0.08),0_10px_30px_rgba(5,41,46,0.18)] dark:bg-[#03181b] dark:shadow-[inset_0_0_0_0.5px_rgba(143,214,207,0.14)]"
        >
          <Backdrop />
          <Illustration name="hero" preserveAspectRatio="xMaxYMin slice" className="absolute inset-0 size-full" />
          <p className="absolute top-5 left-5 m-0 text-eyebrow text-mint">ALLES FÜR DEINEN NÄCHSTEN MOVE</p>
          <div className="absolute bottom-5 left-5 flex flex-col gap-2">
            <h2 className="m-0 text-[27px]/[31px] font-bold tracking-[-0.6px]">
              Mehr bewegen.
              <br />
              Weniger Aufwand.
            </h2>
            <p className="m-0 text-footnote text-white/75">Dein Service. Dein Termin. Klar geplant.</p>
          </div>
        </section>

        <h2 className="m-0 mt-[30px] mb-3 text-title3">Was hast du vor?</h2>
        <div className="grid grid-cols-2 gap-3">
          {services.map((s) => (
            <ServiceCard key={s.to} to={s.to} title={s.title} description={s.description} illustration={<Illustration name={s.illustration} />} />
          ))}
        </div>

        <Link
          to="/miete"
          className="press relative mt-3 flex h-[104px] items-center overflow-hidden rounded-hero-card bg-(image:--gradient-rent-card) text-white"
        >
          <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(60%_90%_at_85%_20%,rgba(143,214,207,0.22)_0%,rgba(143,214,207,0)_70%)]" />
          <span className="relative flex w-[212px] flex-col gap-[3px] pl-[18px]">
            <span className="text-eyebrow text-mint">SELBST FAHREN</span>
            <span className="text-[19px]/[23px] font-bold tracking-[-0.3px] whitespace-nowrap">Transporter mieten</span>
            <span className="text-[12.5px]/4 text-white/75">Tageweise, von 6 bis 17 m³</span>
          </span>
          <Illustration name="van-start" className="absolute -right-3.5 bottom-1.5" />
        </Link>

        <p className="m-0 mt-3 text-center text-footnote text-text-secondary">Richtpreis ohne Konto. Anmelden erst beim Absenden.</p>
      </div>
    </main>
  )
}
