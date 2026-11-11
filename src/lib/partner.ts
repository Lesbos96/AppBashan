import type { Database } from '../../supabase/functions/_shared/database.types.ts'
import { supabase } from './supabase'
import type { Chip } from './orders'

type Args = Database['public']['Functions']['register_partner']['Args']
export type PartnerStatus = Database['public']['Enums']['partner_status']

/** Platzhalter bis zur Rechtsklärung (docs/AUTOPILOT.md, Entscheidung 3); der Server prüft nur das Format. */
export const TERMS_VERSION = 'partner-2026-11-entwurf'

// Werte wie der Check an `partners.legal_form`
export const LEGAL_FORMS = [
  { value: 'einzelunternehmen', label: 'Einzelunternehmen' },
  { value: 'eu', label: 'Eingetragenes Einzelunternehmen (e. U.)' },
  { value: 'gmbh', label: 'GmbH' },
  { value: 'og', label: 'OG' },
  { value: 'kg', label: 'KG' },
  { value: 'sonstige', label: 'Sonstige' },
] as const

export type PartnerForm = {
  name: string
  legalForm: string
  smallBusiness: boolean
  uid: string
  street: string
  postcode: string
  city: string
  contactName: string
  phone: string
  email: string
  districts: number[]
  terms: boolean
}

export const emptyForm: PartnerForm = {
  name: '',
  legalForm: LEGAL_FORMS[0].value,
  smallBusiness: false,
  uid: '',
  street: '',
  postcode: '',
  city: '',
  contactName: '',
  phone: '',
  email: '',
  districts: [],
  terms: false,
}

export type FieldKey = Exclude<keyof PartnerForm, 'legalForm' | 'smallBusiness'>

const normalUid = (uid: string) => uid.trim().toUpperCase()
const between = (s: string, min: number, max: number) => s.trim().length >= min && s.trim().length <= max

/** Grenzen wie die Checks an `partners` (Migration 0023); der Server bleibt die Instanz, die Oberfläche spart nur den Umweg. */
export function validate(f: PartnerForm): Partial<Record<FieldKey, string>> {
  const e: Partial<Record<FieldKey, string>> = {}
  if (!between(f.name, 2, 120)) e.name = 'Gib den Namen deiner Firma an.'
  if (!between(f.street, 2, 120)) e.street = 'Gib Straße und Hausnummer an.'
  if (!/^[0-9]{4}$/.test(f.postcode.trim())) e.postcode = 'Die Postleitzahl hat vier Ziffern.'
  if (!between(f.city, 2, 80)) e.city = 'Gib den Ort an.'
  if (!between(f.contactName, 2, 100)) e.contactName = 'Gib eine Kontaktperson an.'
  if (!between(f.phone, 5, 40)) e.phone = 'Gib eine Telefonnummer an.'
  const mail = f.email.trim()
  if (mail.length < 5 || mail.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(mail)) e.email = 'Prüfe die E-Mail-Adresse.'
  const uid = normalUid(f.uid)
  if (uid ? !/^ATU[0-9]{8}$/.test(uid) : !f.smallBusiness) e.uid = f.smallBusiness || uid ? 'Die UID-Nummer lautet ATU und acht Ziffern.' : 'Gib die UID-Nummer an oder wähle Kleinunternehmer.'
  if (f.districts.length === 0 || f.districts.some((d) => !Number.isInteger(d) || d < 1 || d > 23)) e.districts = 'Wähle mindestens einen Bezirk.'
  if (!f.terms) e.terms = 'Ohne Zustimmung können wir deine Registrierung nicht annehmen.'
  return e
}

/** Alle zwölf Schlüssel, nie weglassen (die Funktion hat keine Vorgaben). Leere UID wird `null`; das generierte Argumenttyp kennt kein `null`. */
export function toArgs(f: PartnerForm): Args {
  return {
    p_name: f.name.trim(),
    p_legal_form: f.legalForm,
    p_uid: (normalUid(f.uid) || null) as string,
    p_small_business: f.smallBusiness,
    p_street: f.street.trim(),
    p_postcode: f.postcode.trim(),
    p_city: f.city.trim(),
    p_contact_name: f.contactName.trim(),
    p_contact_phone: f.phone.trim(),
    p_contact_email: f.email.trim(),
    p_districts: [...new Set(f.districts)].sort((a, b) => a - b),
    p_terms_version: TERMS_VERSION,
  }
}

export type PartnerErrorKind = 'already_member' | 'not_customer' | 'not_authenticated' | 'invalid_input' | 'offline' | 'unavailable'

export class PartnerError extends Error {
  constructor(readonly kind: PartnerErrorKind) {
    super(kind)
  }
}

export const partnerErrorText: Record<PartnerErrorKind, string> = {
  already_member: 'Für dieses Konto gibt es schon eine Firma.',
  not_customer: 'Mit diesem Konto kannst du dich nicht als Partner registrieren.',
  not_authenticated: 'Deine Anmeldung gilt nicht mehr. Melde dich neu an.',
  invalid_input: 'Prüfe die Angaben und versuche es erneut.',
  offline: 'Keine Verbindung. Prüfe dein Netz und versuche es erneut.',
  unavailable: 'Das hat nicht geklappt. Versuche es gleich noch einmal.',
}

type Failure = { code?: string; message?: string }

function kindOf({ code, message }: Failure, status: number): PartnerErrorKind {
  if (status === 0) return 'offline'
  if (message === 'already_member') return 'already_member'
  if (message === 'not_customer') return 'not_customer'
  if (message === 'not_authenticated' || code === 'PGRST301' || code === '42501') return 'not_authenticated'
  if (message === 'scope_incomplete' || code === '23514' || code === '23505') return 'invalid_input'
  return 'unavailable'
}

/** Legt die Firma an (Status `pending`, das Konto bleibt ein Kunde). Gibt die Firmen-ID zurück. */
export async function registerPartner(args: Args): Promise<string> {
  const { data, error, status } = await supabase.rpc('register_partner', args)
  if (error) throw new PartnerError(kindOf(error, status))
  if (typeof data !== 'string' || !data) throw new PartnerError('unavailable')
  return data
}

export type Partner = { id: string; name: string; status: PartnerStatus; status_reason: string | null }

/** Die Firma des Kontos oder `null`. Über die Mitgliedschaft gelesen: ein admin-Konto sähe über `partners` allein alle Firmen. */
export async function loadPartner(userId: string): Promise<Partner | null> {
  const { data, error } = await supabase.from('partner_members').select('partners(id, name, status, status_reason)').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data?.partners ?? null
}

export const statusInfo: Record<PartnerStatus, { label: string; chip: Chip['chip']; text: string }> = {
  pending: { label: 'In Prüfung', chip: 'review', text: 'Wir prüfen deine Angaben. Hier siehst du, sobald sich der Status ändert.' },
  active: { label: 'Aktiv', chip: 'confirmed', text: 'Deine Firma ist freigeschaltet.' },
  payment_hold: { label: 'Pausiert', chip: 'requested', text: 'Deine Firma ist vorübergehend pausiert. Neue Aufträge nimmst du erst nach der Klärung wieder an.' },
  suspended: { label: 'Gesperrt', chip: 'requested', text: 'Deine Firma ist gesperrt. Neue Aufträge sind nicht möglich.' },
  rejected: { label: 'Abgelehnt', chip: 'done', text: 'Deine Registrierung wurde abgelehnt. Mit diesem Konto kannst du dich nicht noch einmal registrieren.' },
}
