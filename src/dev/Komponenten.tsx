import { useState, type ReactNode } from 'react'
import { ActionBar, NavBar, Progress, TabBar } from '../components/Bars'
import { Button } from '../components/Button'
import { Segmented, Stepper, StatusChip, Toggle } from '../components/Controls'
import { Illustration } from '../components/Illustration'
import { Sheet } from '../components/Sheet'
import { AmountRow, Card, Field, GroupedList, ListRow, ServiceCard } from '../components/Surfaces'

const tabs = [
  { to: '/', label: 'Start', icon: 'home' },
  { to: '/dev/fundament', label: 'Miete', icon: 'truck' },
  { to: '/dev/aufträge', label: 'Aufträge', icon: 'orders' },
  { to: '/dev/profil', label: 'Profil', icon: 'profile' },
]

// Die transformierte Hülle macht `fixed`-Kinder (Leisten) relativ zum Rahmen.
function Frame({ height, children }: { height: number; children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-grouped-list bg-background transform-[translateZ(0)]" style={{ height }}>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-hero-card bg-surface p-6 shadow-card-raised">
      <h2 className="m-0 text-section-header font-semibold uppercase tracking-[0.8px] text-text-secondary">{title}</h2>
      {children}
    </section>
  )
}

export function Komponenten() {
  const [segment, setSegment] = useState('moebel')
  const [count, setCount] = useState(3)
  const [on, setOn] = useState(true)
  const [off, setOff] = useState(false)
  const [sheet, setSheet] = useState(false)

  return (
    <>
      <Section title="Komponenten">
        <Button>Weiter</Button>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="tinted">Tinted</Button>
          <Button variant="plain">Plain</Button>
        </div>
        <Segmented
          label="Segmented Control"
          value={segment}
          onChange={setSegment}
          options={[
            { value: 'moebel', label: 'Möbel' },
            { value: 'klavier', label: 'Klavier' },
            { value: 'fluegel', label: 'Flügel' },
            { value: 'tresor', label: 'Tresor' },
          ]}
        />
        <div className="flex items-center justify-between gap-3">
          <Stepper label="Personen" value={count} min={1} max={8} onChange={setCount} />
          <Toggle label="Schalter A" checked={on} onChange={setOn} />
          <Toggle label="Schalter B" checked={off} onChange={setOff} />
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusChip status="requested">Angefragt</StatusChip>
          <StatusChip status="review">Besichtigung</StatusChip>
          <StatusChip status="confirmed">Bestätigt</StatusChip>
          <StatusChip status="done">Abgeschlossen</StatusChip>
        </div>
        <Progress label="Schritt" value={3} max={6} />
        <Button variant="tinted" onClick={() => setSheet(true)}>
          Bottom Sheet öffnen
        </Button>
      </Section>

      <Section title="Karten und Listen">
        <div className="grid grid-cols-2 gap-3">
          <ServiceCard
            to="/dev/fundament"
            title="Möbeltransport"
            description="Ab Haustür"
            illustration={<Illustration name="service-moebel" className="h-auto max-h-full max-w-full" />}
          />
          <Card className="flex items-center justify-center p-4 text-subhead text-text-secondary">Karte · 22 px</Card>
        </div>
        <GroupedList title="Liste">
          <ListRow label="Profil" icon="profile" to="/dev/profil" />
          <ListRow label="Datenschutz" detail="Platzhalter" icon="shield" to="/dev/datenschutz" tileClassName="bg-[#3a7f9a]" />
          <Field label="Name" placeholder="Vor- und Nachname" />
        </GroupedList>
        <GroupedList>
          <AmountRow label="Team, 3 Personen, 5 Stunden und eine sehr lange Beschreibung, die umbrechen darf" cents={68961} />
          <AmountRow label="Gesamt" cents={117500} strong />
        </GroupedList>
      </Section>

      <Section title="Leisten">
        <Frame height={150}>
          <NavBar title="Aufträge" back={{ to: '/dev/fundament', label: 'Start' }} />
        </Frame>
        <Frame height={160}>
          <ActionBar>
            <Button>Weiter</Button>
          </ActionBar>
        </Frame>
        <Frame height={90}>
          <TabBar tabs={tabs} />
        </Frame>
      </Section>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Beispiel-Sheet">
        <h2 className="m-0 mb-3 text-title2">Preis im Detail</h2>
        <GroupedList>
          <AmountRow label="Team" cents={68961} />
          <AmountRow label="Gesamt" cents={68961} strong />
        </GroupedList>
      </Sheet>
    </>
  )
}
