import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { vaultMissing } from '../support/cleanup.ts'

// Der Text der Exception steht in Migration 0014; der RLS-Test erkennt den fehlenden Vault daran.
const sql = readFileSync('supabase/migrations/20261101150000_0014_photo_cleanup_loud.sql', 'utf8')
const raised = /raise exception '([^']+)'/.exec(sql)![1]!

describe('photo_cleanup ohne Vault', () => {
  it('die Exception aus Migration 0014 wird zur klaren Meldung', () => {
    expect(vaultMissing({ message: raised })?.message).toBe('Vault-Secrets fehlen – npm run setup:photo-cleanup ausführen')
  })
  it('kein Fehler und fremde Fehler bleiben unberührt', () => {
    expect(vaultMissing(null)).toBeNull()
    expect(vaultMissing({ message: 'permission denied' })).toBeNull()
  })
})
