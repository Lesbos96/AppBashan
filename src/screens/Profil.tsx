import { useMatch, useNavigate } from 'react-router'
import { version } from '../../package.json'
import { NavBar } from '../components/Bars'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { Card, GroupedList, ListRow } from '../components/Surfaces'
import { PreiseSheet } from './PreiseSheet'

const value = (text: string) => <span className="text-body text-text-secondary">{text}</span>

export function Profil() {
  const navigate = useNavigate()
  const sheet = useMatch('/profil/preise') !== null

  return (
    <main>
      <NavBar title="Profil" />
      <div className="flex flex-col gap-6 px-5 pt-4">
        <Card className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-tint text-accent">
              <Icon name="profile" width={28} height={28} />
            </span>
            <div className="flex flex-col gap-0.5">
              <h2 className="m-0 text-headline">Noch kein Konto</h2>
              <p className="m-0 text-[14px]/[19px] text-text-secondary">Brauchst du erst, wenn du eine Anfrage sendest.</p>
            </div>
          </div>
          {/* Die Anmeldung kommt mit S8b. */}
          <Button variant="tinted" disabled className="flex items-center justify-center gap-2">
            <Icon name="mail" width={20} height={20} />
            Mit E-Mail-Link anmelden
          </Button>
        </Card>

        <GroupedList>
          <ListRow icon="key" label="Für Vermieter" detail="Fahrzeuge und Tarife verwalten" to="/profil/vermieter" />
        </GroupedList>

        <GroupedList title="Einstellungen">
          <ListRow icon="contrast" tileClassName="bg-primary-night" label="Darstellung" trailing={value('Automatisch')} />
          <ListRow icon="pin" tileClassName="bg-[#2e918a]" label="Region" trailing={value('Wien, AT')} />
        </GroupedList>

        <GroupedList title="Info">
          <ListRow icon="calculator" label="Wie rechnet MoveNow?" to="/profil/preise" />
          <ListRow icon="lock" tileClassName="bg-[#4a5f63]" label="Datenschutz" to="/profil/datenschutz" />
          <ListRow icon="document" tileClassName="bg-[#4a5f63]" label="Impressum & AGB" to="/profil/impressum" />
        </GroupedList>

        <p className="m-0 text-center text-footnote text-text-secondary">MoveNow · Version {version}</p>
      </div>
      <PreiseSheet open={sheet} onClose={() => void navigate('/profil')} />
    </main>
  )
}
