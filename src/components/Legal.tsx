import { Fragment, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { NavBar } from './Bars'
import { Card } from './Surfaces'

// Rechtstexte liegen je Text in einer Markdown-Datei unter `src/assets/legal/`. Der Anwalt liefert den finalen Wortlaut;
// dann wird nur diese Datei ersetzt. Unterstützt wird, was die Texte brauchen: Überschriften, Absätze, Listen, Tabellen, **fett**.
// Fehlende Angaben stehen als [ANWALT: …] im Text und erscheinen hervorgehoben.

const LEGAL_PAGES = [
  { to: '/recht/impressum', label: 'Impressum' },
  { to: '/recht/agb', label: 'AGB' },
  { to: '/recht/datenschutz', label: 'Datenschutz' },
] as const

const mark = 'rounded-sm bg-status-requested-bg px-1 text-status-requested-text'

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[ANWALT:?[^\]]*\])/).map((part, i) => {
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('[')) return <mark key={i} className={mark}>{part}</mark>
    return <Fragment key={i}>{part}</Fragment>
  })
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

type Block =
  | { kind: 'h'; level: number; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] }

function parse(source: string): Block[] {
  const lines = source.split(/\r?\n/)
  const blocks: Block[] = []
  const next = () => lines[0] ?? ''
  while (lines.length) {
    const line = lines.shift() ?? ''
    const heading = /^(#{1,3}) (.*)$/.exec(line)
    if (!line.trim()) continue
    if (heading) blocks.push({ kind: 'h', level: (heading[1] ?? '').length, text: heading[2] ?? '' })
    else if (line.startsWith('|')) {
      lines.shift() // Trennzeile
      const rows: string[][] = []
      while (next().startsWith('|')) rows.push(cells(lines.shift() ?? ''))
      blocks.push({ kind: 'table', head: cells(line), rows })
    } else if (line.startsWith('- ')) {
      const items = [line.slice(2)]
      while (next().startsWith('- ')) items.push((lines.shift() ?? '').slice(2))
      blocks.push({ kind: 'ul', items })
    } else if (line.startsWith('> ')) blocks.push({ kind: 'quote', text: line.slice(2) })
    else {
      const text = [line]
      while (next().trim() && !/^(#|\||- |> )/.test(next())) text.push(lines.shift() ?? '')
      blocks.push({ kind: 'p', text: text.join(' ') })
    }
  }
  return blocks
}

function Rendered({ blocks }: { blocks: Block[] }) {
  return blocks.map((b, i) => {
    if (b.kind === 'h') return b.level === 2 ? <h2 key={i} className="m-0 mt-2 text-title3">{inline(b.text)}</h2> : <h3 key={i} className="m-0 text-headline">{inline(b.text)}</h3>
    if (b.kind === 'p') return <p key={i} className="m-0 text-body text-text-secondary">{inline(b.text)}</p>
    if (b.kind === 'quote') return <p key={i} className="m-0 text-footnote text-text-secondary">{inline(b.text)}</p>
    if (b.kind === 'ul') return (
      <ul key={i} className="m-0 flex list-disc flex-col gap-2 pl-5 text-body text-text-secondary">
        {b.items.map((item, j) => <li key={j}>{inline(item)}</li>)}
      </ul>
    )
    // Tabellen werden je Zeile gestapelt: auf dem Telefon bleibt jede Zelle lesbar, auch bei vier Spalten
    return (
      <div key={i} className="flex flex-col">
        {b.rows.map((row, j) => (
          <dl key={j} className="m-0 flex flex-col gap-1 border-t-[0.5px] border-separator py-3">
            <dt className="text-body font-semibold text-text">{inline(row[0] ?? '')}</dt>
            {row.slice(1).map((cell, k) => (
              <dd key={k} className="m-0 break-words text-body text-text-secondary">
                {b.head[k + 1] && <span className="text-footnote">{b.head[k + 1]}: </span>}
                {inline(cell)}
              </dd>
            ))}
          </dl>
        ))}
      </div>
    )
  })
}

/** Zurück führt dorthin, von wo der Link kam (`LegalLink`); ohne Herkunft zum Profil. */
function useBack(fallback: { to: string; label: string }) {
  const from = (useLocation().state as { from?: string } | null)?.from
  return typeof from === 'string' && from.startsWith('/') ? { to: from, label: 'Zurück' } : fallback
}

/** Eine Rechtsseite aus einer Markdown-Quelle; die erste Überschrift ist der Seitentitel. `fallback`: Ziel von „Zurück“ ohne Herkunft (neuer Tab, direkter Aufruf). */
export function LegalPage({ source, fallback = { to: '/profil', label: 'Profil' } }: { source: string; fallback?: { to: string; label: string } }) {
  const [first, ...blocks] = parse(source)
  const title = first?.kind === 'h' ? first.text : ''
  const back = useBack(fallback)
  return (
    <main>
      <NavBar title={title} back={back} />
      <div className="flex flex-col gap-4 px-5 pt-4">
        <p className="m-0 rounded-chip border border-status-requested-text bg-status-requested-bg px-3 py-2 text-footnote font-semibold text-status-requested-text">Entwurf – noch nicht rechtlich geprüft</p>
        <Card className="flex flex-col gap-4 p-5">
          <Rendered blocks={blocks} />
        </Card>
        <LegalFooter />
      </div>
    </main>
  )
}

/** Link auf eine Rechtsseite; merkt sich die aktuelle Seite für „Zurück“. */
export function LegalLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  const { pathname, search } = useLocation()
  return (
    <Link to={to} state={{ from: pathname + search }} className={className ?? 'press flex min-h-11 items-center text-accent underline'}>
      {children}
    </Link>
  )
}

/** Fußzeile mit den Rechtsseiten für Kundinnen und Kunden. Die Partnerbedingungen nennen die Provision und stehen nur im Partnerbereich (Registrierung, Profil), nie hier. */
export function LegalFooter() {
  return (
    <nav aria-label="Rechtliches" className="flex flex-wrap justify-center gap-x-5 text-footnote">
      {LEGAL_PAGES.map((p) => (
        <LegalLink key={p.to} to={p.to}>
          {p.label}
        </LegalLink>
      ))}
    </nav>
  )
}
