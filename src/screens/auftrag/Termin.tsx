import { useState } from 'react'
import { Button } from '../../components/Button'
import { completeJob, reportNotDone } from '../../lib/jobs'
import { Bestaetigen } from './Bestaetigen'

/** Frage nach dem Termin: Hat der Auftrag stattgefunden? Beide Antworten sind endgültig und werden im Sheet bestätigt. */
export function Termin({ id, onDone }: { id: string; onDone: (notice?: string) => void }) {
  const [mode, setMode] = useState<'yes' | 'no' | null>(null)
  const close = () => setMode(null)
  return (
    <section aria-labelledby="termin" className="flex flex-col gap-3 rounded-grouped-list bg-surface p-4 shadow-card">
      <h2 id="termin" className="m-0 text-headline">
        Hat der Auftrag stattgefunden?
      </h2>
      <p className="m-0 text-body">Der Termin hat begonnen. Sag uns kurz, ob alles geklappt hat.</p>
      <Button onClick={() => setMode('yes')}>Ja, er hat stattgefunden</Button>
      <Button variant="tinted" onClick={() => setMode('no')}>
        Nein, er hat nicht stattgefunden
      </Button>
      <Bestaetigen open={mode === 'yes'} onClose={close} title="Auftrag bestätigen" label="Ja, bestätigen" action={() => completeJob(id)} onDone={onDone}>
        <p className="m-0 text-body">Damit gilt der Auftrag als erledigt. Danach kannst du ihn nicht mehr als „nicht stattgefunden“ melden und einen offenen Nachtrag nicht mehr entscheiden.</p>
      </Bestaetigen>
      <Bestaetigen open={mode === 'no'} onClose={close} title="Nicht stattgefunden" label="Meldung senden" action={() => reportNotDone(id)} onDone={onDone}>
        <p className="m-0 text-body">Wir prüfen den Auftrag und melden uns bei dir. Danach kannst du ihn nicht mehr als erledigt bestätigen.</p>
      </Bestaetigen>
    </section>
  )
}
