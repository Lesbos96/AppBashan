import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { beraterDesSchritts, modelleAusTranskript, modellDerSitzung, transkriptPfad } from '../../scripts/sys/modell.mjs'

const eintrag = (model: string, extra: object = {}) => JSON.stringify({ type: 'assistant', message: { model }, ...extra })

describe('Modell aus dem Transkript (Ersatz für das fehlende Hook-Feld)', () => {
  it('häufigstes Modell der Hauptsitzung; Subagenten, Platzhalter und fremde Zeilen zählen nicht', () => {
    const text = [
      eintrag('claude-sonnet-5-5'),
      eintrag('claude-sonnet-5-5'),
      eintrag('claude-fable-5-2', { isSidechain: true }),
      eintrag('claude-fable-5-2', { isSidechain: true }),
      eintrag('claude-fable-5-2', { isSidechain: true }),
      eintrag('<synthetic>'),
      JSON.stringify({ type: 'user', message: { model: 'claude-haiku-5-5' } }),
      'kein json',
    ].join('\n')
    expect(modelleAusTranskript(text)).toEqual({ 'claude-sonnet-5-5': 2 })
  })
  it('ohne Assistenten-Eintrag: leer', () => {
    expect(modelleAusTranskript('')).toEqual({})
    expect(modelleAusTranskript(JSON.stringify({ type: 'user' }))).toEqual({})
  })
  it('Hook-Wert geht vor; sonst Transkript aus session.json oder aus Projekt-Slug und Sitzungs-ID', () => {
    const dir = mkdtempSync(join(tmpdir(), 'modell-'))
    const datei = join(dir, 't.jsonl')
    writeFileSync(datei, eintrag('claude-sonnet-5-5'))
    expect(modellDerSitzung({ modell: 'claude-haiku-5-5', transcript: datei })).toEqual({ modell: 'claude-haiku-5-5', modelle: { 'claude-haiku-5-5': 1 }, quelle: 'Hook' })
    expect(modellDerSitzung({ modell: null, transcript: datei })).toEqual({ modell: 'claude-sonnet-5-5', modelle: { 'claude-sonnet-5-5': 1 }, quelle: 'Transkript' })
    expect(modellDerSitzung({ modell: null, transcript: join(dir, 'fehlt.jsonl') })).toEqual({ modell: null, modelle: {}, quelle: null })
    expect(modellDerSitzung(null)).toEqual({ modell: null, modelle: {}, quelle: null })
    expect(modellDerSitzung({ modell: null, transcript: dir })).toEqual({ modell: null, modelle: {}, quelle: null }) // Lesefehler (Ordner statt Datei): kein Abbruch
    expect(transkriptPfad({ session_id: 'abc' }, 'C:\\Users\\x\\Music\\MoveNow')).toMatch(/projects[\\/]C--Users-x-Music-MoveNow[\\/]abc\.jsonl$/)
  })
})

describe('Berater je Schritt (agents.jsonl)', () => {
  const z = (ereignis: string, agent_type: string, schritt?: string | null) => ({ ereignis, agent_type, ...(schritt === undefined ? {} : { schritt }) })
  it('zählt nur SubagentStart des aktuellen Schritts; ältere Zeilen ohne Schritt und andere Schritte zählen nicht', () => {
    const zeilen = [
      z('SubagentStart', 'advisor'), // Altbestand ohne Schritt
      z('SubagentStart', 'advisor', 'u3'),
      z('SubagentStart', 'advisor', 'u3b'),
      z('SubagentStop', 'advisor', 'u3b'),
      z('SubagentStart', 'advisor-report', 'u3b'),
      z('SubagentStart', 'advisor-report', 'u3b'),
      z('SubagentStart', 'Explore', null),
    ]
    expect(beraterDesSchritts(zeilen, 'u3b')).toEqual({ advisor: 1, 'advisor-report': 2 })
    expect(beraterDesSchritts(zeilen, 'u3')).toEqual({ advisor: 1 })
    expect(beraterDesSchritts([], 'u3b')).toEqual({})
  })
  it('der Hook stempelt jede Zeile mit dem Branch des Projektordners (ohne Git: null)', () => {
    const mitGit = mkdtempSync(join(tmpdir(), 'agents-git-'))
    const ohneGit = mkdtempSync(join(tmpdir(), 'agents-nogit-'))
    expect(spawnSync('git', ['init', '-b', 'probe-schritt'], { cwd: mitGit }).status).toBe(0)
    for (const [projekt, erwartet] of [[mitGit, 'probe-schritt'], [ohneGit, null]] as const) {
      const root = join(projekt, 'proof')
      spawnSync(process.execPath, [join(process.cwd(), '.claude/hooks/session.mjs')], {
        input: JSON.stringify({ hook_event_name: 'SubagentStart', agent_type: 'advisor', agent_id: 'a1' }),
        encoding: 'utf8',
        cwd: projekt,
        env: { ...process.env, CLAUDE_PROJECT_DIR: projekt, PROOF_ROOT: root, GIT_CEILING_DIRECTORIES: join(projekt, '..') },
      })
      expect(JSON.parse(readFileSync(join(root, 'agents.jsonl'), 'utf8').trim()).schritt).toBe(erwartet)
    }
  })
})

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
  it('SessionStart ohne Modellfeld hält Transkript und Feldnamen fest (Beleg für das fehlende Feld)', () => {
    hook({ hook_event_name: 'SessionStart', source: 'startup', session_id: 's', transcript_path: '/x/s.jsonl' })
    const s = JSON.parse(readFileSync(join(root, 'session.json'), 'utf8'))
    expect(s.modell).toBeNull()
    expect(s.transcript).toBe('/x/s.jsonl')
    expect(s.felder).toEqual(['hook_event_name', 'source', 'session_id', 'transcript_path'])
  })
  it('ein späteres Ereignis derselben Sitzung trägt den Transkript-Pfad nach, eine andere Sitzung nicht', () => {
    hook({ hook_event_name: 'SessionStart', source: 'startup', session_id: 's' })
    expect(JSON.parse(readFileSync(join(root, 'session.json'), 'utf8')).transcript).toBeNull()
    hook({ hook_event_name: 'UserPromptSubmit', prompt: 'x', session_id: 'andere', transcript_path: '/x/andere.jsonl' })
    expect(JSON.parse(readFileSync(join(root, 'session.json'), 'utf8')).transcript).toBeNull()
    hook({ hook_event_name: 'UserPromptSubmit', prompt: 'x', session_id: 's', transcript_path: '/x/s.jsonl' })
    expect(JSON.parse(readFileSync(join(root, 'session.json'), 'utf8')).transcript).toBe('/x/s.jsonl')
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
