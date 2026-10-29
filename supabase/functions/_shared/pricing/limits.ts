// Grenzen für Kundeneingaben (parse*Input). Der Prototyp kennt sie nicht; Begründung in docs/PRICING.md.
// Paare [min, max] werden direkt an int()/dec() gespreizt.
export const LIMITS = {
  crew: [1, 8],
  vehicles: [1, 3],
  hours: [0.5, 100],
  floor: [0, 20],
  boxes: [0, 200],
  parking: [0, 2],
  assemblyLm: [0, 50],
  clearanceArea: [1, 2000],
  rentalKm: [0, 10000],
  /** Längste Miete in Tagen. */
  rentalMaxDays: 90,
} as const
