// Edge Function `quote`: speichert Anfragen und Mietanfragen mit serverseitig berechnetem Preis (S8a).
// verify_jwt ist aus (config.toml): das Nutzer-JWT prüft die Function selbst über auth.getUser. Function-Secrets:
// SECRET_KEY, ORS_API_KEY, RATE_LIMIT_SECRET, ALLOWED_ORIGINS (kommagetrennt). SUPABASE_URL setzt die Plattform.
// Der Secret-Key-Client bekommt nie den Authorization-Header des Nutzers.
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Database } from '../_shared/database.types.ts'
import { hmacHex } from '../_shared/route/hmac.ts'
import { orsProvider } from '../_shared/route/provider.ts'
import { quoteDb } from '../_shared/quote/db.ts'
import { handleQuote } from '../_shared/quote/handler.ts'

const env = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} fehlt`)
  return v
}

const db = createClient<Database>(env('SUPABASE_URL'), env('SECRET_KEY'), { auth: { persistSession: false } })
const hmac = hmacHex(env('RATE_LIMIT_SECRET'))
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean)
const provider = orsProvider(Deno.env.get('ORS_API_KEY'))
const { route, ...rest } = quoteDb(db)

Deno.serve((req) =>
  handleQuote(req, {
    ...rest,
    allowedOrigins,
    hmac,
    now: Date.now,
    route: { ...route, provider, hmac },
    log: (entry) => console.log(JSON.stringify(entry)),
  }),
)
