import { createBrowserRouter, redirect, type LoaderFunctionArgs, type RouteObject } from 'react-router'
import { paths, services } from '../lib/draft'
import { hasOnboarded } from '../lib/onboarding'
import { supabase } from '../lib/supabase'
import { Anmelden } from '../screens/Anmelden'
import { Gesendet } from '../screens/anfrage/Gesendet'
import { Termin } from '../screens/anfrage/Termin'
import { Zusammenfassung } from '../screens/anfrage/Zusammenfassung'
import { Auftraege } from '../screens/Auftraege'
import { Entruempelung } from '../screens/entruempelung/Wizard'
import { EntruempelungErgebnis } from '../screens/entruempelung/Ergebnis'
import { Konfigurator } from '../screens/Konfigurator'
import { Montage } from '../screens/Montage'
import { Onboarding } from '../screens/Onboarding'
import { Profil } from '../screens/Profil'
import { Datenschutz, Fehler, Folgt, Impressum } from '../screens/Seiten'
import { Start } from '../screens/Start'
import { Shell, type Handle } from './Shell'

const page = (path: string, element: RouteObject['element'], handle: Handle, extra?: Partial<RouteObject>): RouteObject => ({ path, element, handle, ...extra })

const backTo = (path: string) =>
  path.startsWith('profil') ? { to: '/profil', label: 'Profil' } : path.includes('/') ? { to: `/${path.split('/')[0]}`, label: 'Zurück' } : { to: '/', label: 'Start' }

// Ablauf nach dem Konfigurator: Termin, Zusammenfassung, Bestätigung. Ohne Tab-Bar.
const anfrage = paths.flatMap((path) => [
  page(`${path}/termin`, <Termin path={path} />, { key: `${path}/termin`, title: `${services[path].title}: Termin`, bar: false }),
  page(`${path}/zusammenfassung`, <Zusammenfassung path={path} />, { key: `${path}/zusammenfassung`, title: `${services[path].title}: Zusammenfassung`, bar: false }),
  page(`${path}/gesendet`, <Gesendet path={path} />, { key: `${path}/gesendet`, title: `${services[path].title}: Anfrage gesendet`, bar: false }),
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
      page('auftraege', <Auftraege />, { key: 'auftraege', title: 'Aufträge', root: true }, { loader: requireSession }),
      page('anmelden', <Anmelden />, { key: 'anmelden', title: 'Anmelden', bar: false }),
      // Info-Sheet „Wie rechnet MoveNow?" liegt über dem Profil und teilt dessen Seite
      page('profil', <Profil />, { key: 'profil', title: 'Profil', root: true }),
      page('profil/preise', <Profil />, { key: 'profil', title: 'Wie rechnet MoveNow?', root: true }),
      page('profil/datenschutz', <Datenschutz />, { key: 'datenschutz', title: 'Datenschutz' }),
      page('profil/impressum', <Impressum />, { key: 'impressum', title: 'Impressum & AGB' }),
      page('willkommen', <Onboarding />, { key: 'willkommen', title: 'Willkommen', bar: false }),
      page('transport', <Konfigurator service="transport" />, { key: 'transport', title: 'Möbeltransport', bar: false }),
      page('umzug', <Konfigurator service="move" />, { key: 'umzug', title: 'Umzug', bar: false }),
      page('entruempelung', <Entruempelung />, { key: 'entruempelung', title: 'Entrümpelung', bar: false }),
      page('entruempelung/ergebnis', <EntruempelungErgebnis />, { key: 'entruempelung/ergebnis', title: 'Entrümpelung: Richtwert', bar: false }),
      page('montage', <Montage />, { key: 'montage', title: 'Montage', bar: false }),
      ...anfrage,
      ...flows,
    ],
  },
  // Galerie nur im Dev-Build; der Build lässt den Zweig samt Import weg.
  ...(import.meta.env.DEV
    ? [{ path: '/dev/fundament', HydrateFallback: () => null, lazy: async () => ({ Component: (await import('../dev/Fundament')).Fundament }) }]
    : []),
])
