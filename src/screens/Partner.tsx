import { useState } from 'react'
import { Navigate } from 'react-router'
import { NavBar } from '../components/Bars'
import { StatusChip } from '../components/Controls'
import { ErrorState, Loading } from '../components/States'
import { Card } from '../components/Surfaces'
import { loadPartner, statusInfo, type Partner as Firm } from '../lib/partner'
import { useLoad } from '../lib/prices'
import { useSession } from '../lib/session'
import { Anfragen } from './partner/Anfragen'
import { PartnerAuftraege } from './partner/Auftraege'
import { Dokumente } from './partner/Dokumente'
import { MfaGate } from './partner/Mfa'
import { Registrierung } from './partner/Registrierung'

// Status, in denen die Firma Dokumente hochladen darf (wie `partner_document_slot` in 0024); dahinter folgt ab s9i-6 das übrige Portal
const ACCESS: Firm['status'][] = ['pending', 'active', 'payment_hold']

/** Partner-Portal (s9i-5a, 5b): ohne Firma die Registrierung, mit Firma der Status, dahinter die Schranke (aal2) und die Dokumente. */
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
  // Nach der Registrierung fällt der Fokus mit dem Formular weg: die Statuskarte übernimmt ihn (WCAG 2.4.3)
  const [registered, setRegistered] = useState(false)
  if (result.status === 'loading') return <Loading label="Partner laden" />
  if (result.status === 'error') return <ErrorState text="Der Status konnte nicht geladen werden. Prüfe deine Verbindung." onRetry={retry} />
  return result.data ? (
    <Status firm={result.data} focus={registered} />
  ) : (
    <Registrierung
      onDone={() => {
        setRegistered(true)
        retry()
      }}
    />
  )
}

function Status({ firm, focus }: { firm: Firm; focus: boolean }) {
  const info = statusInfo[firm.status]
  // zählt, wie oft Anfragen etwas geändert haben (Annahme, Angebot): die Aufträge laden dann still neu
  const [changes, setChanges] = useState(0)
  return (
    <>
      <div className="flex flex-col gap-4 px-5 pt-2 pb-4">
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 ref={(el) => (focus ? el?.focus() : undefined)} tabIndex={-1} className="m-0 min-w-0 break-words text-headline outline-none">
              {firm.name}
            </h2>
            <StatusChip status={info.chip}>{info.label}</StatusChip>
          </div>
          <p className="m-0 text-body">{info.text}</p>
          {firm.status_reason && <p className="m-0 break-words text-body text-text-secondary">Begründung: {firm.status_reason}</p>}
        </Card>
      </div>
      {/* Abgelehnte und gesperrte Firmen haben dahinter nichts zu sehen; alle anderen brauchen aal2 (zweiter Faktor) für die Dokumente */}
      {ACCESS.includes(firm.status) && (
        <MfaGate>
          {(recheck) => (
            <>
              {/* Aufträge wickelt eine aktive oder pausierte Firma ab (my_job_partner_id); Anfragen sehen und annehmen darf nur eine aktive (pending: der Server liefert nichts, der Abruf bleibt aus) */}
              {firm.status === 'active' && <Anfragen onChange={() => setChanges((n) => n + 1)} />}
              {(firm.status === 'active' || firm.status === 'payment_hold') && <PartnerAuftraege reloadKey={changes} />}
              <Dokumente partnerId={firm.id} onDenied={recheck} />
            </>
          )}
        </MfaGate>
      )}
    </>
  )
}
