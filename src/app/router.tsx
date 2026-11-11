import type { ReactElement } from 'react'
import { createBrowserRouter, redirect, type LoaderFunctionArgs, type RouteObject } from 'react-router'
import { paths, services } from '../lib/draft'
import { hasOnboarded } from '../lib/onboarding'
import { supabase } from '../lib/supabase'
import { Onboarding } from '../screens/Onboarding'
import { Profil } from '../screens/Profil'
import { Datenschutz, Fehler, Folgt, Impressum } from '../screens/Seiten'
import { Start } from '../screens/Start'
import { Shell, type Handle } from './Shell'

// Flows laden erst beim ersten Aufruf (eigene Chunks); Start, Profil, Info-Sheet, Onboarding und Rechtstexte bleiben im Einstiegs-Chunk.
// Vite teilt gemeinsame Module (Preismodul, Entwurf, Anfrage) selbst auf. Der Router wartet vor dem Seitenwechsel auf den Chunk,
// die Seitenübergänge der Shell bleiben deshalb unverändert.
const screens = {
  konfigurator: () => import('../screens/Konfigurator'),
  entruempelung: () => import('../screens/entruempelung/Wizard'),
  ergebnis: () => import('../screens/entruempelung/Ergebnis'),
  montage: () => import('../screens/Montage'),
  termin: () => import('../screens/anfrage/Termin'),
  zusammenfassung: () => import('../screens/anfrage/Zusammenfassung'),
  gesendet: () => import('../screens/anfrage/Gesendet'),
  anmelden: () => import('../screens/Anmelden'),
  auftraege: () => import('../screens/Auftraege'),
  auftrag: () => import('../screens/Auftrag'),
}

const page = (path: string, element: RouteObject['element'], handle: Handle, extra?: Partial<RouteObject>): RouteObject => ({ path, element, handle, ...extra })

/** Wie `page`, das Element entsteht aber erst nach dem Laden seines Chunks. `handle` bleibt statisch (Shell, Titel). */
const lazyPage = (path: string, element: () => Promise<ReactElement>, handle: Handle, extra?: Partial<RouteObject>): RouteObject => ({ path, handle, lazy: async () => ({ element: await element() }), ...extra })

const backTo = (path: string) =>
  path.startsWith('profil') ? { to: '/profil', label: 'Profil' } : path.includes('/') ? { to: `/${path.split('/')[0]}`, label: 'Zurück' } : { to: '/', label: 'Start' }

// Ablauf nach dem Konfigurator: Termin, Zusammenfassung, Bestätigung. Ohne Tab-Bar.
const anfrage = paths.flatMap((path) => [
  lazyPage(`${path}/termin`, async () => { const { Termin } = await screens.termin(); return <Termin path={path} /> }, { key: `${path}/termin`, title: `${services[path].title}: Termin`, bar: false }),
  lazyPage(`${path}/zusammenfassung`, async () => { const { Zusammenfassung } = await screens.zusammenfassung(); return <Zusammenfassung path={path} /> }, { key: `${path}/zusammenfassung`, title: `${services[path].title}: Zusammenfassung`, bar: false }),
  lazyPage(`${path}/gesendet`, async () => { const { Gesendet } = await screens.gesendet(); return <Gesendet path={path} /> }, { key: `${path}/gesendet`, title: `${services[path].title}: Anfrage gesendet`, bar: false }),
])

// Noch nicht gebaut (S9): „Folgt“.
const flows = [{ path: 'profil/vermieter', title: 'Für Vermieter' }].map(({ path, title }) => page(path, <Folgt title={title} back={backTo(path)} />, { key: path, title, bar: false }))

/** Geschützter Bereich: ohne Sitzung zur Anmeldung, danach zurück hierher. Ein Loader läuft einmal je Navigation (kein Render-Guard, der beim Ausblenden die neue URL sähe). */
async function requireSession({ request }: LoaderFunctionArgs) {
  const { data } = await supabase.auth.getSession()
  if (data.session) return null
  const { pathname, search } = new URL(request.url)
  return redirect(`/anmelden?next=${encodeURIComponent(pathname + search)}`)
}

export const router = createBrowserRouter([
  {
    element: <Shell />,
    errorElement: <Fehler />,
    HydrateFallback: () => null,
    children: [
      page('/', <Start />, { key: 'start', title: 'Start', root: true }, { loader: () => (hasOnboarded() ? null : redirect('/willkommen')) }),
      page('miete', <Folgt title="Transporter mieten" />, { key: 'miete', title: 'Transporter mieten', root: true }),
      lazyPage('auftraege', async () => { const { Auftraege } = await screens.auftraege(); return <Auftraege /> }, { key: 'auftraege', title: 'Aufträge', root: true }, { loader: requireSession }),
      lazyPage('auftraege/:id', async () => { const { Auftrag } = await screens.auftrag(); return <Auftrag /> }, { key: 'auftrag', title: 'Auftrag', bar: false }, { loader: requireSession }),
      lazyPage('anmelden', async () => { const { Anmelden } = await screens.anmelden(); return <Anmelden /> }, { key: 'anmelden', title: 'Anmelden', bar: false }),
      // Info-Sheet „Wie rechnet MoveNow?" liegt über dem Profil und teilt dessen Seite
      page('profil', <Profil />, { key: 'profil', title: 'Profil', root: true }),
      page('profil/preise', <Profil />, { key: 'profil', title: 'Wie rechnet MoveNow?', root: true }),
      page('profil/konto-loeschen', <Profil />, { key: 'profil', title: 'Konto löschen', root: true }),
      page('profil/datenschutz', <Datenschutz />, { key: 'datenschutz', title: 'Datenschutz' }),
      page('profil/impressum', <Impressum />, { key: 'impressum', title: 'Impressum & AGB' }),
      page('willkommen', <Onboarding />, { key: 'willkommen', title: 'Willkommen', bar: false }),
      lazyPage('transport', async () => { const { Konfigurator } = await screens.konfigurator(); return <Konfigurator service="transport" /> }, { key: 'transport', title: 'Möbeltransport', bar: false }),
      lazyPage('umzug', async () => { const { Konfigurator } = await screens.konfigurator(); return <Konfigurator service="move" /> }, { key: 'umzug', title: 'Umzug', bar: false }),
      lazyPage('entruempelung', async () => { const { Entruempelung } = await screens.entruempelung(); return <Entruempelung /> }, { key: 'entruempelung', title: 'Entrümpelung', bar: false }),
      lazyPage('entruempelung/ergebnis', async () => { const { EntruempelungErgebnis } = await screens.ergebnis(); return <EntruempelungErgebnis /> }, { key: 'entruempelung/ergebnis', title: 'Entrümpelung: Richtwert', bar: false }),
      lazyPage('montage', async () => { const { Montage } = await screens.montage(); return <Montage /> }, { key: 'montage', title: 'Montage', bar: false }),
      ...anfrage,
      ...flows,
    ],
  },
  // Galerie nur im Dev-Build; der Build lässt den Zweig samt Import weg.
  ...(import.meta.env.DEV
    ? [{ path: '/dev/fundament', HydrateFallback: () => null, lazy: async () => ({ Component: (await import('../dev/Fundament')).Fundament }) }]
    : []),
])

// Nach dem ersten Laden die Flow-Chunks im Hintergrund holen: spätere Seitenwechsel warten dann nicht aufs Netz,
// und nach kurzem Verbindungsverlust bleibt die App bedienbar. Fehler (offline) sind hier egal, der Router lädt beim Aufruf erneut.
// Im Leerlauf (nicht gleichzeitig mit dem ersten Tarifabruf) und nicht im Datensparmodus.
const prefetch = () => {
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return
  const run = () => Object.values(screens).forEach((load) => void load().catch(() => undefined))
  setTimeout(() => ('requestIdleCallback' in window ? window.requestIdleCallback(run, { timeout: 3000 }) : run()), 1500)
}
if (document.readyState === 'complete') prefetch()
else window.addEventListener('load', prefetch, { once: true })
