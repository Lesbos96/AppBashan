import { Navigate } from 'react-router'
import { NavBar } from '../components/Bars'
import { StatusChip } from '../components/Controls'
import { ErrorState, Loading } from '../components/States'
import { Card } from '../components/Surfaces'
import { loadPartner, statusInfo, type Partner as Firm } from '../lib/partner'
import { useLoad } from '../lib/prices'
import { useSession } from '../lib/session'
import { Registrierung } from './partner/Registrierung'

/** Partner-Portal 1a (s9i-5a): ohne Firma die Registrierung, mit Firma der Status. Der Rest des Portals folgt nach der MFA-Einrichtung (5b). */
export function Partner() {
  const session = useSession()
  return (
    <main>
      <NavBar title="Partner" back={{ to: '/profil', label: 'Profil' }} />
      {session === undefined && <Loading label="Partner laden" />}
      {session === null && <Navigate to="/anmelden?next=%2Fpartner" replace />}
      {session && <Firma key={session.user.id} userId={session.user.id} />}
    </main>
  )
}

function Firma({ userId }: { userId: string }) {
  const [result, retry] = useLoad(() => loadPartner(userId))
  if (result.status === 'loading') return <Loading label="Partner laden" />
  if (result.status === 'error') return <ErrorState text="Der Status konnte nicht geladen werden. Prüfe deine Verbindung." onRetry={retry} />
  return result.data ? <Status firm={result.data} /> : <Registrierung onDone={retry} />
}

function Status({ firm }: { firm: Firm }) {
  const info = statusInfo[firm.status]
  return (
    <div className="flex flex-col gap-4 px-5 pt-2 pb-8">
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="m-0 min-w-0 break-words text-headline">{firm.name}</h2>
          <StatusChip status={info.chip}>{info.label}</StatusChip>
        </div>
        <p className="m-0 text-body">{info.text}</p>
        {firm.status_reason && <p className="m-0 break-words text-body text-text-secondary">Begründung: {firm.status_reason}</p>}
      </Card>
    </div>
  )
}
