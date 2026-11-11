// Live-Aufruf der deployten Edge Function `delete-account` mit echtem Nutzer-JWT (s9i-4, Berater-Auflage; S9h4-5).
// Wegwerfkonten aus `makeUser`; das gelöschte Konto bleibt als Grabstein und wird danach über die Admin-API entfernt.
import { afterAll, describe, expect, it } from 'vitest'
import { deleteUsers, makeRequest, makeUser, must, pause, service } from '../support/db'

afterAll(deleteUsers)

/** Status und Body einer Fehlerantwort; ein Fehler ohne Antwort (Netz) wird durchgereicht, nie als Erfolg gewertet. */
const status = async (r: { error: unknown }) => {
  if (!r.error) return { status: 200, body: null }
  const ctx = (r.error as { context?: Response }).context
  if (!(ctx instanceof Response)) throw r.error
  return { status: ctx.status, body: (await ctx.json().catch(() => null)) as unknown }
}

describe('delete-account live (Dev)', () => {
  it('ohne Bestätigung 400, mit offener Anfrage 409, Konto bleibt', async () => {
    const u = await makeUser('del-open')
    expect(await status(await u.db.functions.invoke('delete-account', { body: { confirm: false } }))).toEqual({ status: 400, body: { error: 'invalid_input' } })
    await makeRequest(u.id)
    expect(await status(await u.db.functions.invoke('delete-account', { body: { confirm: true } }))).toEqual({ status: 409, body: { error: 'open_requests' } })
    const p = must(await service.from('profiles').select('deleted_at').eq('id', u.id).single())
    expect(p.deleted_at).toBeNull()
    const { data } = await service.auth.admin.getUserById(u.id)
    expect(data.user?.email).toMatch(/^del-open-/)
  })

  it('mit Bestätigung 200 { deleted: true }: Profil gelöscht, Auth-Konto anonym, Token danach wertlos', async () => {
    const u = await makeUser('del-ok')
    const r = await u.db.functions.invoke('delete-account', { body: { confirm: true } })
    expect(r.error).toBeNull()
    expect(r.data).toEqual({ deleted: true })
    const p = must(await service.from('profiles').select('deleted_at').eq('id', u.id).single())
    expect(p.deleted_at).not.toBeNull()
    const { data } = await service.auth.admin.getUserById(u.id)
    expect(data.user?.email ?? '').toBe('')
    await pause()
    // Zweiter Aufruf mit demselben Access-Token: Sitzung und Konto sind weg, die Function lehnt ab und löscht nichts erneut.
    expect(await status(await u.db.functions.invoke('delete-account', { body: { confirm: true } }))).toEqual({ status: 401, body: { error: 'unauthorized' } })
    // wie die App danach: lokal abmelden ohne Fehler, keine Sitzung mehr
    expect((await u.db.auth.signOut({ scope: 'local' })).error).toBeNull()
    expect((await u.db.auth.getSession()).data.session).toBeNull()
  })

  it('ohne Anmeldung 401', async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`, {
      method: 'POST',
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    })
    expect(res.status).toBe(401)
  })
})
