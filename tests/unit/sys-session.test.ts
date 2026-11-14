import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Sitzungsprotokoll session.mjs', () => {
  const projekt = mkdtempSync(join(tmpdir(), 'session-'))
  mkdirSync(join(projekt, '.claude'))
  writeFileSync(join(projekt, '.claude', 'settings.json'), JSON.stringify({ model: 'sonnet' }))
  const root = join(projekt, 'proof')
  const hook = (e: object) => {
    const r = spawnSync(process.execPath, ['.claude/hooks/session.mjs'], { input: JSON.stringify(e), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: projekt, PROOF_ROOT: root } })
    return { exit: r.status, out: r.stdout.trim() ? JSON.parse(r.stdout) : null }
  }
  const start = (model?: string) => hook({ hook_event_name: 'SessionStart', source: 'startup', session_id: 's', model })
  const prompt = (p: string) => hook({ hook_event_name: 'UserPromptSubmit', prompt: p })

  it('SessionStart protokolliert das Modell vom Programm', () => {
    const r = start('claude-haiku-5-5')
    expect(r.out.hookSpecificOutput.additionalContext).toMatch(/claude-haiku-5-5/)
    expect(JSON.parse(readFileSync(join(root, 'session.json'), 'utf8')).modell).toBe('claude-haiku-5-5')
  })
  it('falsches Modell: /schritt wird geblockt', () => {
    start('claude-haiku-5-5')
    const r = prompt('/schritt s9p-1\nZiel: x')
    expect(r.out.decision).toBe('block')
    expect(r.out.reason).toMatch(/Falsches Modell: claude-haiku-5-5/)
  })
  it('richtiges Modell: nicht geblockt', () => {
    start('claude-sonnet-5-5')
    expect(prompt('/schritt s9p-1').out).toBeNull()
  })
  it('Prompts ohne /schritt werden nie geblockt', () => {
    start('claude-haiku-5-5')
    expect(prompt('Hallo').out).toBeNull()
  })
  it('Feld model fehlt (laut Doku optional): nicht blockieren', () => {
    start(undefined)
    expect(prompt('/schritt x').out).toBeNull()
  })
  it('SubagentStart und SubagentStop landen in agents.jsonl', () => {
    hook({ hook_event_name: 'SubagentStart', agent_type: 'advisor', agent_id: 'a1' })
    hook({ hook_event_name: 'SubagentStop', agent_type: 'advisor', agent_id: 'a1' })
    expect(existsSync(join(root, 'agents.jsonl'))).toBe(true)
    const zeilen = readFileSync(join(root, 'agents.jsonl'), 'utf8').trim().split('\n').map((z) => JSON.parse(z))
    expect(zeilen.map((z) => z.ereignis)).toEqual(['SubagentStart', 'SubagentStop'])
    expect(zeilen[0].agent_type).toBe('advisor')
  })
})
