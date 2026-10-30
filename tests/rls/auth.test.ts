// Anmeldung gegen das Dev-Projekt, ohne Mailversand: Der Code und der Link-Hash einer Anmelde-Mail entstehen über
// admin.generateLink und gehen durch denselben Aufruf (verifyOtp), den src/lib/auth.ts nutzt.
import { afterAll, describe, expect, it } from 'vitest'
import { anon, client, env, must, pause, run, service } from '../support/db.ts'

const emails: string[] = []
const newEmail = (tag: string) => {
  const email = `auth-${tag}-${run}@movenow.test`
  emails.push(email)
  return email
}

afterAll(async () => {
  const { data } = await service.auth.admin.listUsers({ perPage: 200 })
  for (const u of data.users) if (u.email && emails.includes(u.email)) await service.auth.admin.deleteUser(u.id)
})

const link = async (email: string) => {
  const { data, error } = await service.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw error
  await pause()
  return data.properties
}

describe('Magic-Link-Mail: Code und Link', () => {
  it('der Code meldet an; das Profil entsteht erst jetzt, als Kunde', async () => {
    const email = newEmail('code')
    const props = await link(email)
    expect(props.email_otp).toMatch(/^\d{6,10}$/)
    const db = client(env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'))
    const { data, error } = await db.auth.verifyOtp({ email, token: props.email_otp, type: 'email' })
    expect(error).toBeNull()
    expect(data.session?.user.email).toBe(email)
    const profile = must(await db.from('profiles').select('id, role').single())
    expect(profile).toMatchObject({ id: data.user?.id, role: 'customer' })
  })

  it('der Link (token_hash) meldet in jedem Browser an', async () => {
    const email = newEmail('hash')
    const props = await link(email)
    const db = client(env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'))
    const { data, error } = await db.auth.verifyOtp({ token_hash: props.hashed_token, type: 'email' })
    expect(error).toBeNull()
    expect(data.session?.user.email).toBe(email)
  })

  it('falscher oder schon benutzter Code wird abgelehnt', async () => {
    const email = newEmail('reuse')
    const props = await link(email)
    const db = client(env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'))
    const wrong = props.email_otp === '000000' ? '111111' : '000000'
    expect((await db.auth.verifyOtp({ email, token: wrong, type: 'email' })).error).not.toBeNull()
    expect((await db.auth.verifyOtp({ email, token: props.email_otp, type: 'email' })).error).toBeNull()
    expect((await client(env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')).auth.verifyOtp({ email, token: props.email_otp, type: 'email' })).error).not.toBeNull()
  })

  it('ohne Anmeldung sieht anon keine Profile', async () => {
    expect((await anon.from('profiles').select('id')).error?.code).toBe('42501')
  })
})
