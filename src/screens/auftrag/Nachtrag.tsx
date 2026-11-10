import { useState } from 'react'
import { Button } from '../../components/Button'
import { ErrorState, Loading } from '../../components/States'
import { decideChange, loadChange, loadReceipts } from '../../lib/jobs'
import { formatEuro } from '../../lib/money'
import { useLoad } from '../../lib/prices'
import { Bestaetigen } from './Bestaetigen'

/** Belegfotos des offenen Nachtrags; ein Fehler beim Laden verbirgt die Entscheidung nicht. */
function Belege({ id, photoIds }: { id: string; photoIds: string[] }) {
  const [result] = useLoad(() => loadReceipts(id, photoIds))
  if (result.status === 'loading') return <Loading label="Fotos laden" />
  if (result.status === 'error' || result.data.length === 0) return <p className="m-0 text-subhead text-text-secondary">Die Fotos konnten nicht geladen werden.</p>
  return (
    <div className="flex flex-wrap gap-2">
      {result.data.map((url, i) => (
        <img key={url} src={url} alt={`Beleg ${i + 1}`} className="size-24 rounded-md object-cover" />
      ))}
    </div>
  )
}

/** Nachtrag des Partners: neuer Gesamtpreis, Belege, Zustimmen oder Ablehnen. Gesendet wird genau der gezeigte Gesamtpreis. */
export function Nachtrag({ id, onDone }: { id: string; onDone: (notice?: string) => void }) {
  const [result, retry] = useLoad(() => loadChange(id))
  const [mode, setMode] = useState<'accept' | 'decline' | null>(null)
  if (result.status === 'loading') return <Loading label="Nachtrag laden" />
  if (result.status === 'error') return <ErrorState text="Der Nachtrag konnte nicht geladen werden. Prüfe deine Verbindung." onRetry={retry} />
  const c = result.data
  if (!c) return null
  const close = () => setMode(null)
  return (
    <section aria-labelledby="nachtrag" className="flex flex-col gap-3 rounded-grouped-list bg-surface p-4 shadow-card">
      <h2 id="nachtrag" className="m-0 text-headline">
        Nachtrag zum Preis
      </h2>
      <p className="m-0 text-body">Der Partner schlägt wegen Mehraufwand einen höheren Preis vor. Dein bisheriger Preis gilt, bis du zustimmst.</p>
      {c.extraCents !== null && (
        <span className="flex items-center justify-between gap-3">
          <span className="text-subhead text-text-secondary">Mehraufwand</span>
          <span className="whitespace-nowrap text-body tabular-nums">{formatEuro(c.extraCents)}</span>
        </span>
      )}
      <span className="flex items-center justify-between gap-3 border-t-[0.5px] border-separator pt-3">
        <span className="text-subhead text-text-secondary">Neuer Gesamtpreis</span>
        <span className="whitespace-nowrap text-headline tabular-nums">{formatEuro(c.totalCents)}</span>
      </span>
      <Belege id={id} photoIds={c.photoIds} />
      <Button onClick={() => setMode('accept')}>Zustimmen</Button>
      <Button variant="tinted" onClick={() => setMode('decline')}>
        Ablehnen
      </Button>
      <Bestaetigen open={mode === 'accept'} onClose={close} title="Nachtrag zustimmen" label={`Für ${formatEuro(c.totalCents)} zustimmen`} action={() => decideChange(c.id, true, c.totalCents)} onDone={onDone}>
        <span className="flex items-center justify-between gap-3">
          <span className="text-body">Neuer Gesamtpreis</span>
          <span className="whitespace-nowrap text-headline tabular-nums">{formatEuro(c.totalCents)}</span>
        </span>
      </Bestaetigen>
      <Bestaetigen open={mode === 'decline'} onClose={close} title="Nachtrag ablehnen" label="Ablehnen" action={() => decideChange(c.id, false)} onDone={onDone}>
        <p className="m-0 text-body">Dann bleibt dein bisheriger Preis.</p>
      </Bestaetigen>
    </section>
  )
}
