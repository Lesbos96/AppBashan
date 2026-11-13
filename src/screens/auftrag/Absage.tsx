import { Link } from 'react-router'
import { ErrorState, Loading } from '../../components/States'
import { loadPartnerCancel } from '../../lib/cancel'
import { formatEuro } from '../../lib/money'
import { useLoad } from '../../lib/prices'

const link = 'inline-flex min-h-11 items-center font-semibold text-accent underline'

/**
 * Absage der Firma: ob der Kunde etwas schuldet und wie es weitergeht. Beträge nur aus `my_cancel_info` (die Pauschale, nie die Gebühr).
 * VORLÄUFIG bis zur Rechtsprüfung (S9_KONZEPT.md:361, docs/GOLIVE.md): alle Texte zur Pauschale. Ein Widerspruchsweg (Support-Kontakt) fehlt in der App noch.
 */
export function Absage({ id, userId }: { id: string; userId: string }) {
  const [result, retry] = useLoad(() => loadPartnerCancel(id, userId))
  if (result.status === 'loading') return <Loading label="Absage laden" />
  if (result.status === 'error') return <ErrorState text="Die Einzelheiten zur Absage konnten nicht geladen werden. Prüfe deine Verbindung." onRetry={retry} />
  const { feeCents, next } = result.data
  const reissued = next !== null && next.status !== 'unmatched'
  return (
    <section aria-labelledby="absage" className="flex flex-col gap-3 rounded-grouped-list bg-surface p-4 shadow-card">
      <h2 id="absage" className="m-0 text-headline">
        Absage der Firma
      </h2>
      {feeCents > 0 ? (
        <>
          <p className="m-0 text-body">
            Die Firma macht eine Pauschale von <span className="whitespace-nowrap font-semibold tabular-nums">{formatEuro(feeCents)}</span> geltend. Die Firma stellt sie dir außerhalb der App in Rechnung. Wir vermitteln diese Anfrage nicht weiter.
          </p>
          <Link to="/" className={link}>
            Neue Anfrage
          </Link>
        </>
      ) : reissued ? (
        <>
          <p className="m-0 text-body">Dir entstehen keine Kosten. Wir haben deine Anfrage an andere Firmen weitergegeben.</p>
          <Link to={`/auftraege/${next.id}`} className={link}>
            Zur neuen Anfrage
          </Link>
        </>
      ) : (
        <>
          <p className="m-0 text-body">
            {next !== null ? 'Dir entstehen keine Kosten. Wir haben leider keine andere Firma gefunden. Du kannst jederzeit eine neue Anfrage stellen.' : 'Dir entstehen keine Kosten. Du kannst jederzeit eine neue Anfrage stellen.'}
          </p>
          <Link to="/" className={link}>
            Neue Anfrage
          </Link>
        </>
      )}
    </section>
  )
}
