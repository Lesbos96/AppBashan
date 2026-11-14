// Sitzungsprotokoll (Hooks SessionStart, SubagentStart, SubagentStop, UserPromptSubmit).
// Das Modell kommt vom Programm (Feld `model`, laut Doku optional), nicht von der Selbstauskunft des Modells.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const projekt = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
const root = process.env.PROOF_ROOT ?? join(projekt, 'tmp', 'proof')
const sessionDatei = join(root, 'session.json')

function schreibe(datei, inhalt, anhaengen = false) {
  mkdirSync(dirname(datei), { recursive: true })
  if (anhaengen) appendFileSync(datei, inhalt)
  else writeFileSync(datei, inhalt)
}

// Gibt den Blockgrund zurück oder null.
export function pruefePrompt(prompt, modell, erwartet) {
  if (!/^\s*\/schritt\b/.test(prompt ?? '')) return null
  if (!modell) return null // Feld fehlt (z. B. nach /clear): nicht blockieren, Doku nennt es optional
  if (modell.toLowerCase().includes(erwartet.toLowerCase())) return null
  return `Falsches Modell: ${modell}. Dieser Schritt läuft mit "${erwartet}" (settings.json). Modell im Wähler umstellen und den Prompt erneut senden.`
}

export function verarbeite(e) {
  const jetzt = new Date().toISOString()
  switch (e.hook_event_name) {
    case 'SessionStart': {
      const modell = e.model ?? null
      schreibe(sessionDatei, JSON.stringify({ modell, quelle: e.source ?? null, zeit: jetzt, session_id: e.session_id ?? null }, null, 2) + '\n')
      return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: `Sitzungsprotokoll (Hook): Modell ${modell ?? 'unbekannt (Feld fehlt)'}, Quelle ${e.source ?? '?'}.` } }
    }
    case 'SubagentStart':
    case 'SubagentStop':
      schreibe(join(root, 'agents.jsonl'), JSON.stringify({ zeit: jetzt, ereignis: e.hook_event_name, agent_type: e.agent_type ?? null, agent_id: e.agent_id ?? null }) + '\n', true)
      return null
    case 'UserPromptSubmit': {
      const modell = existsSync(sessionDatei) ? JSON.parse(readFileSync(sessionDatei, 'utf8')).modell : null
      const erwartet = JSON.parse(readFileSync(join(projekt, '.claude', 'settings.json'), 'utf8')).model ?? ''
      const grund = erwartet ? pruefePrompt(e.prompt, modell, erwartet) : null
      return grund ? { decision: 'block', reason: grund } : null
    }
    default:
      return null
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const antwort = verarbeite(JSON.parse(readFileSync(0, 'utf8').replace(/^﻿/, '')))
  if (antwort) process.stdout.write(JSON.stringify(antwort) + '\n')
}
