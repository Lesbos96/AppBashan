import { useEffect, useRef, useState } from 'react'

import { Link, Navigate, useNavigate } from 'react-router'
import { ActionBar, NavBar } from '../../components/Bars'
import { Button } from '../../components/Button'
import { Illustration } from '../../components/Illustration'
import { ErrorState, Loading } from '../../components/States'
import { Card, Field, GroupedList } from '../../components/Surfaces'
import { leaveAccount } from '../../lib/auth'
import { type Path, finishDraft, readContact, writeContact, readShown, readShownFull, readTermin, rememberShown, services, stashDraft, timeWindows } from '../../lib/draft'
import { readClearanceFlow, readFlow, readMontageFlow } from '../../lib/flow'
import { clearPhotos, getPhotos, renewPhotoIds, usePhotos } from '../../lib/photos'
import { loadPrices, useLoad } from '../../lib/prices'
import { floorText, lmText, toTariffs } from '../../lib/preview'
import { formatEuro } from '../../lib/money'
import { type Terms, QuoteError, buildBody, errorText, invalidTarget, invalidText, loadTerms, priceLabel, refBody, refFor, rejectedText, sendQuote, shownFromSnapshot, shownLabel, termsText } from '../../lib/quote'
import { useSession } from '../../lib/session'
import { supabase } from '../../lib/supabase'
import { type UploadFailure, discardStaging, failureText, forgetStaging, photoRejectedText, uploadAll } from '../../lib/uploads'
import { objectOf } from '../entruempelung/options'
import { dayText } from './format'

const goods = { normal: 'Möbel', piano: 'Klavier', grand: 'Flügel', safe: 'Tresor' }
const shortAddress = (label: string) => label.split(',')[0]?.trim() ?? label

type Row = [label: string, value: string]
type Summary = { place: Row[]; scope: Row[]; route: string }

/** Anzeige der Angaben aus dem sessionStorage (ohne Preise); `null`, wenn der Entwurf unvollständig ist. */
function summaryOf(path: Path): Summary | null {
  const termin = readTermin(path)
  const window = timeWindows.find((w) => w.value === termin.window)?.label ?? ''
  switch (services[path].service) {
    case 'transport':
    case 'move': {
      const f = readFlow(services[path].service as 'transport' | 'move')
      if (!f.from || !f.to) return null
      return {
        place: [
          ['Abholung', `${f.from.label} · ${floorText(f.fromFloor)}${f.fromLift ? ', mit Lift' : ''}`],
          ['Ziel', `${f.to.label} · ${floorText(f.toFloor)}${f.toLift ? ', mit Lift' : ''}`],
          ['Strecke', f.route ? `${f.route.distanceKm.toFixed(1).replace('.', ',')} km${f.route.outsideKm > 0 ? ` · ${f.route.outsideKm.toFixed(1).replace('.', ',')} km außerhalb Wiens` : ' · innerhalb Wiens'}` : 'wird beim Absenden berechnet'],
        ],
        scope: [
          ['Transportgut', goods[f.goods]],
          ['Ladevolumen', `ca. ${f.volume} m³`],
          ['Team', `${f.crew} ${f.crew === 1 ? 'Person' : 'Personen'} · ${f.vehicles} ${f.vehicles === 1 ? 'Fahrzeug' : 'Fahrzeuge'}`],
          ...(f.assembly ? ([['Montage', lmText(f.assemblyLm)]] as Row[]) : []),
          ...(f.boxes > 0 ? ([['Umzugskartons', `${f.boxes} Stück`]] as Row[]) : []),
          ...(f.parking > 0 ? ([['Halteverbotszone', `${f.parking} ${f.parking === 1 ? 'Adresse' : 'Adressen'}`]] as Row[]) : []),
        ],
        route: `${shortAddress(f.from.label)} → ${shortAddress(f.to.label)}`,
      }
    }
    case 'clearance': {
      const f = readClearanceFlow()
      const object = objectOf(f)
      if (!object || !termin.place.trim() || !termin.point) return null
      return {
        place: [
          ['Ort', termin.place.trim()],
          ['Zeitfenster', window],
        ],
        scope: [
          [object.label, `${f.area} m²`],
          ['Zugang', f.floor === 0 ? floorText(0) : `${floorText(f.floor)}, ${f.lift ? 'mit' : 'ohne'} Lift`],
          ...(f.assembly ? ([['Montage', f.draft.kind === 'kitchen' ? 'Küche' : 'Standardmöbel']] as Row[]) : []),
        ],
        route: shortAddress(termin.place),
      }
    }
    case 'assembly': {
      const f = readMontageFlow()
      if (!termin.place.trim() || !termin.point) return null
      return {
        place: [
          ['Ort', termin.place.trim()],
          ['Zeitfenster', window],
        ],
        scope: [[f.draft.kind === 'kitchen' ? 'Küche' : 'Standardmöbel', lmText(f.draft.lm)]],
        route: shortAddress(termin.place),
      }
    }
  }
}

const group = (title: string, rows: Row[]) => (
  <section className="flex flex-col gap-2">
    <h2 className="m-0 mx-4 text-section-header font-normal text-text-secondary">{title}</h2>
    <GroupedList>
      {rows.map(([label, value]) => (
        <li key={label} className="flex items-start justify-between gap-4 px-4 py-3 not-first:border-t-[0.5px] not-first:border-separator">
          <span className="shrink-0 text-body">{label}</span>
          <span className="min-w-0 text-right text-body break-words text-text-secondary">{value}</span>
        </li>
      ))}
    </GroupedList>
  </section>
)

const illustrations = { transport: 'service-moebel', umzug: 'summary-umzug', entruempelung: 'service-entruempelung', montage: 'service-montage' }

/** Strecke wie Screen 11: A und B mit Etage und Lift, darunter die Streckenlänge. Zeilen: Abholung, Ziel, Strecke. */
function Strecke({ rows }: { rows: Row[] }) {
  const [from, to, distance] = rows as [Row, Row, Row]
  const point = (letter: string, [, value]: Row) => {
    const cut = value.lastIndexOf(' · ')
    return (
      <li className="flex items-center gap-3 px-4 py-3 not-first:border-t-[0.5px] not-first:border-separator">
        <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-surface text-[12px]/4 font-bold text-accent">
          {letter}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-body break-words">{value.slice(0, cut)}</span>
          <span className="text-subhead text-text-secondary">{value.slice(cut + 3)}</span>
        </span>
      </li>
    )
  }
  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 mx-4 text-section-header font-normal text-text-secondary">Strecke</h2>
      <GroupedList>
        {point('A', from)}
        {point('B', to)}
        <li className="flex items-start justify-between gap-4 border-t-[0.5px] border-separator px-4 py-3">
          <span className="shrink-0 text-body text-text-secondary">Einfache Strecke</span>
          <span className="min-w-0 text-right text-body break-words">{distance[1]}</span>
        </li>
      </GroupedList>
    </section>
  )
}

export function Zusammenfassung({ path }: { path: Path }) {
  const [prices, retryPrices] = useLoad(loadPrices)
  const [terms, retryTerms] = useLoad(loadTerms)
  const retry = () => {
    retryPrices()
    retryTerms()
  }
  return (
    <main>
      <NavBar title="Zusammenfassung" back={{ to: `/${path}/termin`, label: 'Termin' }} />
      {(prices.status === 'loading' || terms.status === 'loading') && <Loading label="Angaben laden" />}
      {(prices.status === 'error' || terms.status === 'error') && <ErrorState text="Die Angaben konnten nicht geladen werden. Prüfe deine Verbindung." onRetry={retry} />}
      {prices.status === 'ready' && terms.status === 'ready' && <Inhalt path={path} tariffs={toTariffs(prices.data)} version={prices.data.version} terms={terms.data} />}
    </main>
  )
}

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'changed' } | { kind: 'photos'; failure: UploadFailure } | { kind: 'error'; error: QuoteError }
/** 422 von `quote`, nach denen das erneute Senden die Fotos mit neuen Namen hochlädt. */
const reuploadCodes = ['photo_missing', 'photo_expired']
/**
 * Vom Kunden bestätigte Änderungen nach einem 409; `clientRef` bleibt dabei stabil, weil nichts gespeichert wurde.
 * Der angenommene Preis steht im sessionStorage (`rememberShown`), wie der aus dem Konfigurator: Anzeige und gesendetes `shown` lesen dieselbe Quelle.
 * Die Preisversion gilt nur in dieser Ansicht; nach einem Neuladen gilt die frisch geladene (im Zweifel folgt ein weiteres 409).
 */
type Accepted = { priceVersion?: number; terms?: Terms }

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PHONE = /^[0-9+()/ .-]{5,40}$/
const digits = (v: string) => (v.match(/[0-9]/g) ?? []).length

function Inhalt({ path, tariffs, version, terms }: { path: Path; tariffs: Record<string, number>; version: number; terms: Terms }) {
  const navigate = useNavigate()
  const session = useSession()
  const config = services[path]
  const summary = summaryOf(path)
  const termin = readTermin(path)
  // Einwilligung gilt für das Konto, dessen E-Mail beim Haken zu sehen war; wechselt die Sitzung (z. B. anderer Tab), muss neu bestätigt werden.
  const [consentFor, setConsentFor] = useState<string | null>(null)
  const accountId = session?.user.id ?? 'anon'
  const consent = consentFor === accountId
  const accountSwitched = consentFor !== null && consentFor !== '' && consentFor !== 'anon' && !consent
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [wait, setWait] = useState(0)
  const photoKey = config.service
  const { photos } = usePhotos(photoKey)
  const [uploaded, setUploaded] = useState(0)
  const busy = useRef(false)
  const sentRef = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (sentRef.current) clearPhotos(photoKey)
    }
  }, [photoKey])
  const [accepted, setAccepted] = useState<Accepted>({})
  const [saved] = useState(() => readContact(path))
  const [name, setName] = useState(saved.name)
  const [phone, setPhone] = useState(saved.phone)
  const [email, setEmail] = useState(saved.email)
  const [stairsDoor, setStairsDoor] = useState(saved.stairsDoor)
  useEffect(() => writeContact(path, { name, phone, email, stairsDoor }), [path, name, phone, email, stairsDoor])
  const mail = email || session?.user.email || ''
  const contact = { name: name.trim(), phone: phone.trim(), email: mail.trim(), stairsDoor }
  const contactOk = contact.name.length > 0 && PHONE.test(contact.phone) && digits(contact.phone) >= 5 && EMAIL.test(contact.email)
  // Ohne Hinweis bliebe „Anfrage senden" ohne Erklärung gesperrt (WCAG 3.3.1). Der Hinweis erscheint beim Verlassen eines ungültigen Feldes
  // und verschwindet beim Tippen, sobald der Wert gültig ist; er kommt beim Tippen nicht neu dazu (keine Ansage je Tastendruck).
  const validField = { name: (v: string) => v.trim().length > 0, phone: (v: string) => PHONE.test(v.trim()) && digits(v.trim()) >= 5, email: (v: string) => EMAIL.test(v.trim()) }
  const [hints, setHints] = useState<{ name?: boolean; phone?: boolean; email?: boolean }>({})
  const leave = (field: keyof typeof validField, value: string) => setHints((h) => ({ ...h, [field]: !validField[field](value) }))
  const edit = (field: keyof typeof validField, value: string) => validField[field](value) && setHints((h) => (h[field] ? { ...h, [field]: false } : h))
  const hintText = { name: 'Gib deinen Namen an.', phone: 'Prüfe die Telefonnummer, sie braucht mindestens 5 Ziffern.', email: 'Prüfe die Mailadresse.' }
  // Der Hinweis steht direkt unter der Eingabe in der Zeile des Feldes (`Field` mit `hintId`), damit er beim Verlassen im Blick bleibt
  const hint = (field: keyof typeof validField) => ({ hint: hints[field] ? hintText[field] : null, hintId: `kontakt-${field}-hinweis` })

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  if (!summary || !termin.date) return <Navigate to={summary ? `/${path}/termin` : config.back} replace />
  // Ohne gemerkten Preis gibt es nichts, was der Kunde bestätigen könnte: zurück zum Preis-Schritt.
  const shownPrice = readShownFull(path)
  if (!shownPrice) return <Navigate to={config.back} replace />
  const storno = termsText(accepted.terms ?? terms)

  const toLogin = () => {
    stashDraft(path)
    void navigate(`/anmelden?next=${encodeURIComponent(`/${path}/zusammenfassung`)}`)
  }
  /** Für „Anderes Konto“ und nach einem 401: ohne Abmelden leitet die Anmeldung bei bestehender Sitzung sofort zurück. */
  const otherAccount = async () => {
    stashDraft(path)
    // noch mit der alten Sitzung: deren Staging-Dateien zählen sonst bis zum Aufräumen gegen ihr Kontingent
    await discardStaging(supabase)
    await leaveAccount()
    void navigate(`/anmelden?next=${encodeURIComponent(`/${path}/zusammenfassung`)}`)
  }

  /** `shownId`: das Konto, dessen E-Mail der Kunde gerade sieht. Hat sich die Sitzung geändert, wird nichts gesendet. `now`: die Annahme, die der Render noch nicht kennt. */
  async function send(shownId: string, now: Accepted = accepted) {
    if (busy.current) return
    busy.current = true
    setStatus({ kind: 'sending' })
    setUploaded(0)
    try {
      const { data } = await supabase.auth.getSession()
      const live = data.session
      if (!live) throw new QuoteError('unauthorized')
      if (live.user.id !== shownId) {
        setStatus({ kind: 'changed' })
        return
      }
      // `shown` kommt aus dem sessionStorage (buildBody), also aus derselben Quelle wie die Preiskarte
      const body = buildBody(path, tariffs, { priceVersion: now.priceVersion ?? version, termsHash: (now.terms ?? terms).termsHash, contact })
      if (!body) {
        void navigate(`/${path}/termin`, { replace: true })
        return
      }
      const toSend = getPhotos(photoKey)
      const photoIds = toSend.map((p) => p.id)
      // clientRef: Entwurf ohne die bestätigten Angaben (nach einem 409 bleibt sie) und mit dem Fotosatz (anderer Satz = neuer Versuch)
      const clientRef = refFor(path, refBody(body, photoIds))
      // Fotos zuerst ins Staging {user}/{clientRef}/{id}.jpg; ein Ref-Wechsel entfernt vorher die Dateien der alten Ref (uploads.ts).
      // `quote` übernimmt sie mit der Anfrage, danach lassen sie sich nicht mehr ändern
      const failure = await uploadAll(supabase, live.user.id, clientRef, toSend, setUploaded)
      if (failure) {
        setStatus({ kind: 'photos', failure })
        return
      }
      const quote = await sendQuote({ ...body, photoIds }, clientRef, live.access_token)
      forgetStaging()
      sentRef.current = true // geleert wird beim Verlassen: ein Re-Render vor der Navigation fände den Entwurf schon gelöscht
      if (!mounted.current) clearPhotos(photoKey) // Seite während des Sendens verlassen: der Cleanup lief schon
      finishDraft(path, { path, id: quote.id, status: quote.status, needsQuote: quote.needsQuote, snapshot: quote.snapshot, shownCents: readShown(path), date: termin.date, route: summary!.route })
      void navigate(`/${path}/gesendet`, { replace: true })
    } catch (e) {
      const error = e instanceof QuoteError ? e : new QuoteError('unavailable')
      if (error.kind === 'rate_limited') setWait(60)
      // Der Server nimmt die Staging-Dateien nicht an: alte Dateien wegräumen, beim erneuten Senden neue Namen
      if (error.kind === 'rejected' && reuploadCodes.includes(error.code ?? '')) {
        await discardStaging(supabase)
        renewPhotoIds(photoKey) // neue IDs = neue clientRef; gespeichert wurde nichts
      }
      // Ein 409 ohne alles, was der Kunde bestätigen müsste, ist nicht bestätigbar: wie nicht verfügbar behandeln (sonst Schleife aus 409)
      const incomplete = (error.kind === 'price_changed' && (!error.conflict.snapshot || error.conflict.priceVersion === undefined)) || (error.kind === 'terms_changed' && !error.conflict.terms)
      setStatus({ kind: 'error', error: incomplete ? new QuoteError('unavailable') : error })
    } finally {
      busy.current = false
    }
  }

  const sending = status.kind === 'sending'
  const error = status.kind === 'error' ? status.error : null
  const confirmChange = error?.kind === 'price_changed' || error?.kind === 'terms_changed' ? error : null
  // Einwilligung, Kontakt und Wartezeit gelten wie für die Leiste: die Karte ist im 409-Zustand der einzige Weg zum Senden
  const canSend = consent && contactOk && !sending && wait <= 0
  const acceptChange = () => {
    if (!confirmChange || !canSend) return
    const { conflict } = confirmChange
    let next: Accepted
    if (confirmChange.kind === 'price_changed') {
      const { snapshot, priceVersion } = conflict
      if (!snapshot || priceVersion === undefined) return
      const shown = shownFromSnapshot(snapshot)
      rememberShown(path, snapshot.kind === 'price' ? snapshot.totalCents : null, shown)
      // Ohne gespeicherten Wert würde die Karte einen anderen Preis zeigen, als gesendet wird: dann nichts senden
      if (JSON.stringify(readShownFull(path)) !== JSON.stringify(shown)) {
        setStatus({ kind: 'error', error: new QuoteError('unavailable') })
        return
      }
      next = { ...accepted, priceVersion }
    } else {
      if (!conflict.terms) return
      next = { ...accepted, terms: conflict.terms }
    }
    setAccepted(next)
    void send(session?.user.id ?? '', next)
  }
  const newSnapshot = confirmChange?.conflict.snapshot
  const text = error && error.kind !== 'price_changed' && error.kind !== 'terms_changed' ? (error.kind === 'invalid_input' ? invalidText(error.field) : error.kind === 'rejected' ? (photoRejectedText[error.code ?? ''] ?? rejectedText[error.code ?? ''] ?? 'Mit einer Angabe stimmt etwas nicht. Prüfe deine Eingaben.') : errorText[error.kind]) : status.kind === 'photos' ? failureText[status.failure] : status.kind === 'changed' || accountSwitched ? 'Du bist jetzt mit einem anderen Konto angemeldet. Prüfe die E-Mail-Adresse und sende die Anfrage dann erneut.' : null

  return (
    <>
      <div className="flex flex-col gap-5 px-5 pt-2 pb-48">
        <Card className="flex items-center gap-4 p-4">
          <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-icon-tile bg-tint p-2">
            <Illustration name={illustrations[path]} className="h-auto max-h-full max-w-full" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <h2 className="m-0 text-title3">{config.title}</h2>
            <p className="m-0 text-subhead text-text-secondary">{dayText(termin.date)}</p>
          </span>
        </Card>
        {config.hasAddresses ? <Strecke rows={summary.place} /> : group('Ort & Zeit', summary.place)}
        {group('Umfang', summary.scope)}

        {config.hasAddresses && <p className="m-0 px-4 text-subhead text-text-secondary">Die Abholung muss in Wien liegen. Abholung außerhalb Wiens ist noch nicht buchbar. Das Ziel kann in ganz Österreich liegen.</p>}

        {confirmChange?.kind !== 'price_changed' && (
          <Card className="flex flex-col gap-1 p-4">
            <span className="text-[12.5px]/4 text-text-secondary">{shownPrice.kind === 'offer' ? 'Preis' : 'Richtpreis'}</span>
            <strong className="text-title1 font-bold whitespace-nowrap tabular-nums">{shownLabel(shownPrice)}</strong>
            <p className="m-0 text-footnote text-text-secondary">{shownPrice.kind === 'offer' ? 'Ein Partner erstellt dir ein persönliches Angebot.' : 'Inklusive 20 % USt. Den Endpreis bestätigt der Partner.'}</p>
          </Card>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="m-0 mx-4 text-section-header font-normal text-text-secondary">Dein Kontakt</h2>
          <GroupedList>
            <Field label="Name" name="name" autoComplete="name" maxLength={120} placeholder="Vor- und Nachname" aria-required value={name} onChange={(e) => { setName(e.target.value); edit('name', e.target.value) }} onBlur={(e) => leave('name', e.target.value)} {...hint('name')} />
            <Field label="Telefon" name="tel" type="tel" autoComplete="tel" maxLength={40} placeholder="+43 660 1234567" aria-required value={phone} onChange={(e) => { setPhone(e.target.value); edit('phone', e.target.value) }} onBlur={(e) => leave('phone', e.target.value)} {...hint('phone')} />
            <Field label="Mailadresse" name="email" type="email" autoComplete="email" maxLength={200} placeholder="name@beispiel.at" aria-required value={mail} onChange={(e) => { setEmail(e.target.value); edit('email', e.target.value || session?.user.email || '') }} onBlur={(e) => leave('email', e.target.value)} {...hint('email')} />
            <Field label="Stiege / Tür" name="stairs" autoComplete="address-line2" maxLength={60} placeholder="optional" value={stairsDoor} onChange={(e) => setStairsDoor(e.target.value)} />
          </GroupedList>
          <p className="m-0 px-4 text-footnote text-text-secondary">Der Partner bekommt deinen Kontakt erst, wenn er die Anfrage annimmt.</p>
        </section>

        {photos.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="m-0 mx-4 text-section-header font-normal text-text-secondary">Fotos</h2>
            <Card className="flex flex-col gap-3 p-4">
              <ul className="m-0 grid list-none grid-cols-4 gap-2 p-0">
                {photos.map((p, i) => (
                  <li key={p.id}>
                    <img src={p.url} alt={`Foto ${i + 1}`} className="aspect-square w-full rounded-[10px] object-cover" />
                  </li>
                ))}
              </ul>
              {(sending || status.kind === 'idle') && (
                <p className="m-0 text-footnote text-pretty text-text-secondary">
                  {sending ? <span role="status" className="tabular-nums">{uploaded} von {photos.length} hochgeladen</span> : 'Nach dem Senden lassen sich die Fotos nicht mehr ändern. Prüfe sie jetzt.'}
                </p>
              )}
            </Card>
          </section>
        )}

        {confirmChange?.kind !== 'terms_changed' && (
          <section className="flex flex-col gap-2">
            <h2 className="m-0 mx-4 text-section-header font-normal text-text-secondary">Stornierung</h2>
            <GroupedList>
              {storno.storno.map((line) => (
                <li key={line} className="px-4 py-2.5 text-subhead">
                  {line}
                </li>
              ))}
              {storno.callOutCents > 0 && (
                <li className="px-4 py-2.5 text-subhead">
                  Anfahrtspauschale: <span className="whitespace-nowrap tabular-nums">{formatEuro(storno.callOutCents)}</span>
                </li>
              )}
            </GroupedList>
          </section>
        )}

        <label className="flex min-h-11 items-start gap-3 rounded-grouped-list bg-surface p-4 shadow-card">
          <input type="checkbox" checked={consent} onChange={(e) => setConsentFor(e.target.checked ? accountId : '')} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
          <span className="text-subhead">
            Ich sende eine unverbindliche Anfrage. Der Partner prüft und bestätigt Termin und Preis. Es gelten{' '}
            <Link to="/profil/impressum" className="py-3.5 text-accent underline">
              AGB
            </Link>{' '}
            und{' '}
            <Link to="/profil/datenschutz" className="py-3.5 text-accent underline">
              Datenschutz
            </Link>
            .
          </span>
        </label>

        {session ? (
          <div className="flex flex-col gap-1 px-4">
            <p className="m-0 text-body">
              Anfrage als <strong className="font-semibold break-all">{session.user.email}</strong> senden
            </p>
            <button type="button" onClick={() => void otherAccount()} className="press -ml-3 flex h-11 items-center self-start px-3 text-[15px] font-medium text-accent">
              Anderes Konto
            </button>
          </div>
        ) : (
          session === null && <p className="m-0 px-4 text-subhead text-text-secondary">Für den Versand legst du jetzt ein Konto an. Wir schicken dir dazu einen Anmeldelink per E-Mail.</p>
        )}

        {confirmChange && (
          <div role="alert" className="flex flex-col gap-2 rounded-grouped-list border border-accent/40 bg-surface p-4 shadow-card">
            {confirmChange.kind === 'price_changed' ? (
              <>
                <p className="m-0 text-headline">Der Preis wurde aktualisiert.</p>
                <p className="m-0 text-body">
                  {newSnapshot?.kind === 'price' ? (
                    <>
                      Neuer Preis: <strong className="font-semibold whitespace-nowrap tabular-nums">{priceLabel(newSnapshot).main}</strong>
                    </>
                  ) : (
                    'Für deine Angaben erstellt ein Partner ein persönliches Angebot.'
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="m-0 text-headline">Die Bedingungen wurden aktualisiert.</p>
                {confirmChange.conflict.terms &&
                  termsText(confirmChange.conflict.terms).storno.map((line) => (
                    <p key={line} className="m-0 text-body">
                      {line}
                    </p>
                  ))}
                {confirmChange.conflict.terms && termsText(confirmChange.conflict.terms).callOutCents > 0 && (
                  <p className="m-0 text-body">
                    Anfahrtspauschale: <span className="whitespace-nowrap tabular-nums">{formatEuro(termsText(confirmChange.conflict.terms).callOutCents)}</span>
                  </p>
                )}
              </>
            )}
            <Button variant="tinted" disabled={!canSend} onClick={acceptChange}>
              {confirmChange.kind === 'price_changed' ? 'Neuen Preis übernehmen und senden' : 'Bedingungen bestätigen und senden'}
            </Button>
          </div>
        )}

        {text && (
          <div className="flex flex-col gap-2 rounded-grouped-list border border-destructive/40 bg-surface p-4 shadow-card">
            {/* Nur die Meldung ist Live-Region; die Wartezeit zählt daneben, sonst läse ein Bildschirmleser sie jede Sekunde neu vor */}
            <p className="m-0 text-body">
              <span role="alert">{text}</span>
              {wait > 0 && ` Noch ${wait} s.`}
            </p>
            {error?.kind === 'unauthorized' && (
              <Button variant="tinted" onClick={() => void otherAccount()}>
                Neu anmelden
              </Button>
            )}
          </div>
        )}
      </div>
      <p role="status" className="sr-only">
        {sending ? 'Anfrage wird gesendet' : ''}
      </p>
      <ActionBar>
        {session === undefined ? (
          <Button disabled>Anfrage senden</Button>
        ) : session === null ? (
          <Button disabled={!consent} onClick={toLogin}>
            Anmelden und senden
          </Button>
        ) : (error?.kind === 'rejected' && !reuploadCodes.includes(error.code ?? '')) || error?.kind === 'invalid_input' ? (
            <Link to={error.kind === 'rejected' ? (config.hasAddresses ? config.back : `/${path}/termin`) : invalidTarget(path, error.field)} className="press flex h-[54px] w-full items-center justify-center rounded-button-primary bg-[image:var(--gradient-primary-button)] text-headline text-white shadow-primary-button">
              Angaben ändern
            </Link>
          ) : (
            <Button disabled={!canSend || confirmChange !== null} aria-busy={sending} className="disabled:opacity-70!" onClick={() => void send(session.user.id)}>
              {sending ? 'Wird gesendet …' : wait > 0 ? `Bitte warten (${wait} s)` : error || status.kind === 'photos' ? 'Erneut senden' : 'Anfrage senden'}
            </Button>
          )}
      </ActionBar>
    </>
  )
}
