import agb from '../assets/legal/agb.md?raw'
import datenschutz from '../assets/legal/datenschutz.md?raw'
import impressum from '../assets/legal/impressum.md?raw'
import { LegalPage } from '../components/Legal'

// Rechtstexte für Kundinnen und Kunden: der Wortlaut steht je Text in einer Datei unter `src/assets/legal/` (Entwurf, der Anwalt liefert den finalen Text).
export const Datenschutz = () => <LegalPage source={datenschutz} />
export const Impressum = () => <LegalPage source={impressum} />
export const Agb = () => <LegalPage source={agb} />
