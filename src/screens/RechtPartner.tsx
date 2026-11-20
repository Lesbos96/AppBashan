import partnerbedingungen from '../assets/legal/partnerbedingungen.md?raw'
import { LegalPage } from '../components/Legal'

// Eigener Chunk: die Partnerbedingungen nennen die Provision und gehören nicht in den Chunk der Kunden-Rechtsseiten (`Recht.tsx`).
export const Partnerbedingungen = () => <LegalPage source={partnerbedingungen} fallback={{ to: '/partner', label: 'Partner' }} />
