import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

// `undefined` solange die Sitzung noch geladen wird, `null` ohne Anmeldung.
const SessionContext = createContext<Session | null | undefined>(undefined)

/** Ein einziges Abo auf die Sitzung für die ganze App (sonst laden zwei Seiten bei Übergängen getrennt). */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    // meldet sofort den gespeicherten Zustand (INITIAL_SESSION) und danach jede Änderung
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])
  return <SessionContext value={session}>{children}</SessionContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSession = () => useContext(SessionContext)
