import { useState } from 'react'
import { useLocation, useMatch, useNavigate } from 'react-router'
import { version } from '../../package.json'
import { signOut } from '../lib/auth'
import { useSession } from '../lib/session'
import { NavBar } from '../components/Bars'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { Card, GroupedList, ListRow } from '../components/Surfaces'
import { accountErrorText } from '../lib/account'
import { KontoLoeschen, type AccountNotice } from './KontoLoeschen'
import { PreiseSheet } from './PreiseSheet'

const NOTICE: Record<AccountNotice, string> = { deleted: 'Dein Konto ist gelöscht.', unauthorized: accountErrorText.unauthorized }

const value = (text: string) => <span className="text-body text-text-secondary">{text}</span>

export function Profil() {
  const navigate = useNavigate()
  const sheet = useMatch('/profil/preise') !== null
  const session = useSession()
  const deleting = useMatch('/profil/konto-loeschen') !== null && !!session
  const account = (useLocation().state as { account?: AccountNotice } | null)?.account
  const notice = session === null && account && Object.hasOwn(NOTICE, account) ? NOTICE[account] : ''
  const [busy, setBusy] = useState(false)
  const out = async () => {
    setBusy(true)
    try {
      await signOut()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main>
      <NavBar title="Profil" />
      <div className="flex flex-col gap-6 px-5 pt-4">
        {/* dauerhaft vorhanden, damit Screenreader die Meldung nach dem Löschen ansagen */}
        <p role="status" className="m-0 text-body empty:sr-only">
          {notice}
        </p>
        <Card className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-tint text-accent">
              <Icon name="profile" width={28} height={28} />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 className="m-0 text-headline">{session ? 'Angemeldet' : 'Noch kein Konto'}</h2>
              <p className="m-0 break-words text-[14px]/[19px] text-text-secondary">
                {session ? session.user.email : 'Brauchst du erst, wenn du eine Anfrage sendest.'}
              </p>
            </div>
          </div>
          {session ? (
            <Button variant="tinted" disabled={busy} onClick={() => void out()}>
              Abmelden
            </Button>
          ) : (
            <Button variant="tinted" className="flex items-center justify-center gap-2" onClick={() => void navigate('/anmelden?next=%2Fprofil')}>
              <Icon name="mail" width={20} height={20} />
              Mit E-Mail-Link anmelden
            </Button>
          )}
        </Card>

        <GroupedList>
          <ListRow icon="truck" label="Als Partner arbeiten" detail="Firma registrieren und Aufträge übernehmen" to="/partner" />
          <ListRow icon="key" label="Für Vermieter" detail="Fahrzeuge und Tarife verwalten" to="/profil/vermieter" />
        </GroupedList>

        <GroupedList title="Einstellungen">
          <ListRow icon="contrast" tileClassName="bg-primary-night" label="Darstellung" trailing={value('Automatisch')} />
          <ListRow icon="pin" tileClassName="bg-[#2e918a]" label="Region" trailing={value('Wien, AT')} />
        </GroupedList>

        <GroupedList title="Info">
          <ListRow icon="calculator" label="Wie rechnet MoveNow?" to="/profil/preise" />
          <ListRow icon="document" tileClassName="bg-[#4a5f63]" label="Impressum" to="/recht/impressum" />
          <ListRow icon="document" tileClassName="bg-[#4a5f63]" label="AGB" to="/recht/agb" />
          <ListRow icon="lock" tileClassName="bg-[#4a5f63]" label="Datenschutz" to="/recht/datenschutz" />
        </GroupedList>

        {session && (
          <GroupedList title="Konto">
            <ListRow icon="profile" tileClassName="bg-[#4a5f63]" label="Konto löschen" to="/profil/konto-loeschen" />
          </GroupedList>
        )}

        <p className="m-0 text-center text-footnote text-text-secondary">MoveNow · Version {version}</p>
      </div>
      <PreiseSheet open={sheet} onClose={() => void navigate('/profil')} />
      <KontoLoeschen open={deleting} email={session?.user.email ?? ''} onClose={() => void navigate('/profil')} onDone={(n) => void navigate('/profil', { replace: true, state: { account: n } })} />
    </main>
  )
}
