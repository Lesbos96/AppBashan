// Edge Function `route`: Geocoding (Kandidaten) und Routenfakten. Geheimnisse (Function-Secrets):
// SECRET_KEY (neuer Secret Key des Projekts), ORS_API_KEY, RATE_LIMIT_SECRET, PUBLISHABLE_KEY, ALLOWED_ORIGINS (kommagetrennt),
// TURNSTILE_SECRET_KEY (Cloudflare Turnstile; Dev: Testsecret, Produktion: echtes Secret). SUPABASE_URL setzt die Plattform.
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Database } from '../_shared/database.types.ts'
import { hmacHex } from '../_shared/route/hmac.ts'
import { routeDb } from '../_shared/route/db.ts'
import { handleRoute } from '../_shared/route/handler.ts'
import { orsProvider } from '../_shared/route/provider.ts'
import { verifyTurnstile } from '../_shared/turnstile.ts'

const env = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} fehlt`)
  return v
}

const db = createClient<Database>(env('SUPABASE_URL'), env('SECRET_KEY'), { auth: { persistSession: false } })
const provider = orsProvider(Deno.env.get('ORS_API_KEY'))
const hmac = hmacHex(env('RATE_LIMIT_SECRET'))
const publishableKey = env('PUBLISHABLE_KEY')
const turnstileSecret = env('TURNSTILE_SECRET_KEY')
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean)

Deno.serve((req) =>
  handleRoute(req, {
    provider,
    hmac,
    publishableKey,
    allowedOrigins,
    verifyCaptcha: (token) => verifyTurnstile(token, turnstileSecret),
    log: (entry) => console.log(JSON.stringify(entry)),
    ...routeDb(db),
  }),
)
