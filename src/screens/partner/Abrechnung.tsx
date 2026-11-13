import { useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { JobError, jobErrorText } from '../../lib/jobs'
import { loadJournalCsv, saveCsv } from '../../lib/partnerJournal'

// Aktueller Monat nach Wiener Zeit (Standard der Auswahl; der Server rechnet den Abrechnungsmonat selbst)
function viennaMonth(): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit' }).formatToParts(new Date()).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}`
}

/** Journal des Monats als CSV (s9i-7c1): nur die eigene Firma, keine Kundendaten (Server: `my_commissions`). */
export function Abrechnung() {
  const [month, setMonth] = useState(viennaMonth)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Sperre gegen Doppelklick schon vor dem nächsten Rendern (genau ein Aufruf)
  const running = useRef(false)

  async function download() {
    if (running.current) return
    running.current = true
    setBusy(true)
    setError('')
    try {
      const file = await loadJournalCsv(month)
      saveCsv(file.name, file.csv)
    } catch (e) {
      setError(jobErrorText[e instanceof JobError ? e.kind : 'unavailable'])
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="abrechnung" className="flex flex-col gap-3 px-5 pb-4">
      <h2 id="abrechnung" className="m-0 text-headline">
        Abrechnung
      </h2>
      <div className="flex flex-col gap-3 rounded-grouped-list bg-surface p-4 shadow-card">
        <p className="m-0 text-subhead text-text-secondary">Dein Journal mit Buchungen, Nachträgen, Stornos und Provision als CSV. Aufträge erscheinen im Monat ihres Abschlusses.</p>
        <label className="flex min-h-12 items-center gap-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
          <span className="shrink-0 text-body">Monat</span>
          <input
            type="month"
            value={month}
            disabled={busy}
            onChange={(e) => setMonth(e.target.value)}
            aria-describedby="abrechnung-format"
            className="min-h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-right text-body outline-none [color-scheme:light_dark]"
          />
        </label>
        <p id="abrechnung-format" className="m-0 text-footnote text-text-secondary">
          Zeigt dein Browser ein Textfeld, schreibe JJJJ-MM, zum Beispiel 2026-10.
        </p>
        {error && (
          <p role="alert" className="m-0 text-body text-destructive">
            {error}
          </p>
        )}
        <Button variant="tinted" disabled={busy} onClick={() => void download()}>
          {busy ? 'Wird erstellt …' : 'Journal herunterladen'}
        </Button>
      </div>
    </section>
  )
}
