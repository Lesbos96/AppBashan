import { useState } from 'react'
import { Button } from '../../components/Button'
import { ErrorState, Loading } from '../../components/States'
import { completeJob, loadReportInfo, reportNotDone } from '../../lib/jobs'
import { useLoad } from '../../lib/prices'
import { Bestaetigen } from './Bestaetigen'

const until = (d: Date) => d.toLocaleString('de-AT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' }).replace(',', ' um') + ' Uhr'

/**
 * Frage nach dem Termin: Hat der Auftrag stattgefunden? Ob sie offen ist, sagt allein der Server (`my_report_info`, auch nach dem Abschluss
 * durch die Firma). Nach dem Abschluss der Firma bleibt nur die Meldung „nicht stattgefunden“. Beide Antworten sind endgültig und werden im Sheet bestätigt.
 */
export function Termin({ id, completed, onDone }: { id: string; completed: boolean; onDone: (notice?: string) => void }) {
  const [info, retry] = useLoad(() => loadReportInfo(id))
  const [mode, setMode] = useState<'yes' | 'no' | null>(null)
  const close = () => setMode(null)
  if (info.status === 'loading') return <Loading label="Frage zum Termin laden" />
  if (info.status === 'error') return <ErrorState text="Die Frage zum Termin konnte nicht geladen werden. Prüfe deine Verbindung." onRetry={retry} />
  if (!info.data.canReport) return null
  const deadline = info.data.reportUntil
  return (
    <section aria-labelledby="termin" className="flex flex-col gap-3 rounded-grouped-list bg-surface p-4 shadow-card">
      <h2 id="termin" className="m-0 text-headline">
        Hat der Auftrag stattgefunden?
      </h2>
      <p className="m-0 text-body">
        {completed ? 'Die Firma hat den Auftrag als erledigt gemeldet. Stimmt das nicht, melde es hier.' : 'Der Termin hat begonnen. Sag uns kurz, ob alles geklappt hat.'}
        {deadline && ` Du kannst das bis ${until(deadline)} melden.`}
      </p>
      {!completed && <Button onClick={() => setMode('yes')}>Ja, er hat stattgefunden</Button>}
      <Button variant={completed ? 'primary' : 'tinted'} onClick={() => setMode('no')}>
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
