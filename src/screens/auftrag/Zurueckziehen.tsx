import { useState } from 'react'
import { Button } from '../../components/Button'
import { withdrawRequest } from '../../lib/jobs'
import { Bestaetigen } from './Bestaetigen'

/** Anfrage zurückziehen, solange keine Firma zugesagt hat (Status requested, awaiting_offer, offered). Der Server prüft Eigentümer und Status. */
export function Zurueckziehen({ id, onDone }: { id: string; onDone: (notice?: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="tinted" onClick={() => setOpen(true)}>
        Anfrage zurückziehen
      </Button>
      <Bestaetigen open={open} onClose={() => setOpen(false)} title="Anfrage zurückziehen" label="Ja, zurückziehen" action={() => withdrawRequest(id)} onDone={onDone}>
        <p className="m-0 text-body">Die Anfrage ist danach beendet, offene Angebote verfallen. Das lässt sich nicht rückgängig machen.</p>
      </Bestaetigen>
    </>
  )
}
