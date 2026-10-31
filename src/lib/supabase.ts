import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../supabase/functions/_shared/database.types.ts'

// Nur URL und Publishable Key; alles Weitere regeln RLS und Edge Functions.
export const supabase = createClient<Database>(
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL,
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  // Sonst würde ein Link mit `#access_token=…` still eine fremde Sitzung übernehmen (Login-CSRF); die App liest die URL selbst (`/anmelden`).
  { auth: { detectSessionInUrl: false } },
)
