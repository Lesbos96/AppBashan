import { createBrowserRouter, redirect, type RouteObject } from 'react-router'
import { hasOnboarded } from '../lib/onboarding'
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

// Flows ohne Tab-Bar, gebaut in S6 bis S9; bis dahin „Folgt".
const flows = [
  { path: 'transport/termin', title: 'Ort & Termin' },
  { path: 'umzug/termin', title: 'Ort & Termin' },
  { path: 'entruempelung/termin', title: 'Ort & Termin' },
  { path: 'montage/termin', title: 'Ort & Termin' },
  { path: 'profil/vermieter', title: 'Für Vermieter' },
].map(({ path, title }) => page(path, <Folgt title={title} back={backTo(path)} />, { key: path, bar: false }))

export const router = createBrowserRouter([
  {
    element: <Shell />,
    errorElement: <Fehler />,
    HydrateFallback: () => null,
    children: [
      page('/', <Start />, { key: 'start', root: true }, { loader: () => (hasOnboarded() ? null : redirect('/willkommen')) }),
      page('miete', <Folgt title="Transporter mieten" />, { key: 'miete', root: true }),
      page('auftraege', <Auftraege />, { key: 'auftraege', root: true }),
      // Info-Sheet „Wie rechnet MoveNow?" liegt über dem Profil und teilt dessen Seite
      page('profil', <Profil />, { key: 'profil', root: true }),
      page('profil/preise', <Profil />, { key: 'profil', root: true }),
      page('profil/datenschutz', <Datenschutz />, { key: 'datenschutz' }),
      page('profil/impressum', <Impressum />, { key: 'impressum' }),
      page('willkommen', <Onboarding />, { key: 'willkommen', bar: false }),
      page('transport', <Konfigurator service="transport" />, { key: 'transport', bar: false }),
      page('umzug', <Konfigurator service="move" />, { key: 'umzug', bar: false }),
      page('entruempelung', <Entruempelung />, { key: 'entruempelung', bar: false }),
      page('entruempelung/ergebnis', <EntruempelungErgebnis />, { key: 'entruempelung/ergebnis', bar: false }),
      page('montage', <Montage />, { key: 'montage', bar: false }),
      ...flows,
    ],
  },
  // Galerie nur im Dev-Build; der Build lässt den Zweig samt Import weg.
  ...(import.meta.env.DEV
    ? [{ path: '/dev/fundament', HydrateFallback: () => null, lazy: async () => ({ Component: (await import('../dev/Fundament')).Fundament }) }]
    : []),
])
