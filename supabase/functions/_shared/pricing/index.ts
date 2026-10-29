// Preismodul (S2). Rein, ohne Abhängigkeiten, läuft in Vite und Deno; Importe mit .ts-Endung.

/** Rundung wie cents() im Prototyp (Zeile 34): erst am Ende auf Cent runden. */
export const cents = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100
