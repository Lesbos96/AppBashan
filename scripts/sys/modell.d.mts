export interface SitzungsDatei {
  modell?: string | null
  transcript?: string | null
  session_id?: string | null
}
export function beraterDesSchritts(zeilen: { ereignis?: string; agent_type?: string | null; schritt?: string | null }[], schritt: string): Record<string, number>
export function modelleAusTranskript(text: string): Record<string, number>
export function transkriptPfad(session: SitzungsDatei | null, projekt?: string): string | null
export function modellDerSitzung(
  session: SitzungsDatei | null,
  projekt?: string,
): { modell: string | null; modelle: Record<string, number>; quelle: 'Hook' | 'Transkript' | null }
