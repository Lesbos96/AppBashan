export const titles = { transport: 'Möbeltransport', move: 'Umzug', clearance: 'Entrümpelung', assembly: 'Montage' }
export type Chip = { chip: 'requested' | 'review' | 'confirmed' | 'done'; label: string; active: boolean }
export const states: Record<string, Chip> = {
  requested: { chip: 'requested', label: 'Angefragt', active: true },
  awaiting_offer: { chip: 'review', label: 'Wartet auf Angebot', active: true },
  offered: { chip: 'review', label: 'Angebot liegt vor', active: true },
  accepted: { chip: 'confirmed', label: 'Bestätigt', active: true },
  in_progress: { chip: 'confirmed', label: 'Läuft', active: true },
  completed: { chip: 'done', label: 'Erledigt', active: false },
  withdrawn: { chip: 'done', label: 'Zurückgezogen', active: false },
  expired: { chip: 'done', label: 'Abgelaufen', active: false },
  declined: { chip: 'done', label: 'Abgelehnt', active: false },
  unmatched: { chip: 'done', label: 'Kein Partner gefunden', active: false },
  cancelled_by_customer: { chip: 'done', label: 'Storniert', active: false },
  cancelled_by_partner: { chip: 'done', label: 'Storniert', active: false },
}
