// Hilfen für die Integrationstests gegen das Dev-Projekt (npm run test:rls): Clients, Testnutzer, Aufräumen.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../supabase/functions/_shared/database.types.ts'

export type Db = SupabaseClient<Database>

export function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} fehlt. Tests über npm run test:rls starten.`)
  return value
}

export const client = (key: string): Db => createClient<Database>(env('NEXT_PUBLIC_SUPABASE_URL'), key, { auth: { persistSession: false, autoRefreshToken: false } })
export const service = client(env('SUPABASE_SECRET_KEY'))
export const anon = client(env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'))

/** Gepaced wegen der Auth-Rate-Limits. */
export const pause = () => new Promise((resolve) => setTimeout(resolve, 400))
export const run = Date.now().toString(36)

export const must = <T>(r: { data: T; error: unknown }): NonNullable<T> => {
  if (r.error || r.data == null) throw r.error ?? new Error('keine Daten')
  return r.data
}

export type TestUser = { id: string; db: Db; jwt: string }
const created: string[] = []

export async function makeUser(tag: string): Promise<TestUser> {
  const email = `${tag}-${run}@movenow.test`
  const password = `${crypto.randomUUID()}Aa1!`
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  created.push(data.user.id)
  await pause()
  const db = client(env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'))
  const signIn = await db.auth.signInWithPassword({ email, password })
  if (signIn.error) throw signIn.error
  await pause()
  return { id: data.user.id, db, jwt: signIn.data.session.access_token }
}

export async function deleteUsers(): Promise<void> {
  for (const id of created.splice(0)) await service.auth.admin.deleteUser(id)
}

/** PostgREST-Fehlercode eines verweigerten Zugriffs (Rechte widerrufen): nicht „leeres Ergebnis", sondern 42501. */
export const DENIED = '42501'
