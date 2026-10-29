import { createBrowserRouter, redirect, type RouteObject } from 'react-router'
import { hasOnboarded } from '../lib/onboarding'
import { Auftraege } from '../screens/Auftraege'
import { Onboarding } from '../screens/Onboarding'
import { Profil } from '../screens/Profil'
import { Datenschutz, Fehler, Folgt, Impressum } from '../screens/Seiten'
import { Start } from '../screens/Start'
import { Shell, type Handle } from './Shell'

const page = (path: string, element: RouteObject['element'], handle: Handle, extra?: Partial<RouteObject>): RouteObject => ({ path, element, handle, ...extra })

// Flows ohne Tab-Bar, gebaut in S6 bis S9; bis dahin „Folgt".
const flows = [
  { path: 'transport', title: 'Möbeltransport' },
  { path: 'umzug', title: 'Umzug' },
  { path: 'entruempelung', title: 'Entrümpelung' },
  { path: 'montage', title: 'Montage' },
  { path: 'profil/vermieter', title: 'Für Vermieter' },
].map(({ path, title }) => page(path, <Folgt title={title} back={{ to: path.startsWith('profil') ? '/profil' : '/', label: path.startsWith('profil') ? 'Profil' : 'Start' }} />, { key: path, bar: false }))

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
      ...flows,
    ],
  },
  // Galerie nur im Dev-Build; der Build lässt den Zweig samt Import weg.
  ...(import.meta.env.DEV
    ? [{ path: '/dev/fundament', HydrateFallback: () => null, lazy: async () => ({ Component: (await import('../dev/Fundament')).Fundament }) }]
    : []),
])
