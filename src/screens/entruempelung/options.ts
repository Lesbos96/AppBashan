import type { ClearanceFlow } from '../../lib/flow'

type Object = Exclude<ClearanceFlow['object'], ''>

export const objects: { value: Object; label: string; description: string; icon: string }[] = [
  { value: 'flat', label: 'Wohnung', description: 'Einzelne Räume oder die ganze Wohnung', icon: 'home' },
  { value: 'house', label: 'Haus', description: 'Wohnbereiche und Nebenräume', icon: 'key' },
  { value: 'attic', label: 'Dachboden', description: 'Dachraum oder Speicher', icon: 'stairs' },
  { value: 'cellar', label: 'Keller', description: 'Abteil oder ganzer Keller', icon: 'boxes' },
  { value: 'office', label: 'Gewerbe & Büro', description: 'Individuelles Angebot nach Prüfung', icon: 'document' },
  { value: 'heavy', label: 'Stark belastete Räume', description: 'Diskret und individuell besichtigen', icon: 'shield' },
]

export const fills: { value: ClearanceFlow['fill']; label: string; short: string; description: string; illustration: string }[] = [
  { value: 'light', label: 'Wenig gefüllt', short: 'wenig gefüllt', description: 'Einige Möbel, viel freie Bodenfläche', illustration: 'fill-low' },
  { value: 'normal', label: 'Normal möbliert', short: 'normal möbliert', description: 'Übliche Einrichtung und Hausrat', illustration: 'fill-normal' },
  { value: 'full', label: 'Sehr voll', short: 'sehr voll', description: 'Viele Gegenstände, gefüllte Schränke', illustration: 'fill-full' },
]

export const objectOf = (flow: ClearanceFlow) => objects.find((o) => o.value === flow.object)
