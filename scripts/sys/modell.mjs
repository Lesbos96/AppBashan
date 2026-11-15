// Modell der Hauptsitzung für den Bericht. Die Hook-Eingabe SessionStart liefert in dieser Umgebung kein Feld `model` (tmp/proof/session.json: modell null, Stand 2026-11-14);
// Ersatzquelle ist das Transkript der letzten Sitzung (`message.model` der Assistenten-Einträge). Es ist ein Beleg zweiter Güte: sein Format ist nicht dokumentiert, kein Gate hängt daran.
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Anzahl der Assistenten-Einträge je Modell, ohne Sidechain (Subagenten) und ohne Platzhalter: { 'claude-sonnet-5-5': 44 }.
export function modelleAusTranskript(text) {
  const n = {}
  for (const zeile of text.split('\n')) {
    let e
    try {
      e = JSON.parse(zeile)
    } catch {
      continue
    }
    const m = e?.type === 'assistant' && !e.isSidechain ? e.message?.model : null
    if (m && m !== '<synthetic>') n[m] = (n[m] ?? 0) + 1
  }
  return n
}

// Berater (SubagentStart) je Art, nur die Zeilen von agents.jsonl mit `schritt` gleich dem Schritt: ältere Zeilen ohne Schritt und andere Schritte zählen nicht.
export function beraterDesSchritts(zeilen, schritt) {
  const n = {}
  for (const z of zeilen) if (z.ereignis === 'SubagentStart' && z.schritt === schritt) n[z.agent_type] = (n[z.agent_type] ?? 0) + 1
  return n
}

// Pfad aus session.json (`transcript`, vom Hook) oder, falls der Hook ihn nicht bekam, aus Konfigurationsordner, Projekt-Slug und Sitzungs-ID.
export function transkriptPfad(session, projekt = process.cwd()) {
  if (session?.transcript) return session.transcript
  if (!session?.session_id) return null
  return join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'), 'projects', projekt.replace(/[^A-Za-z0-9]/g, '-'), `${session.session_id}.jsonl`)
}

// { modell (das häufigste), modelle (alle mit Anzahl), quelle: 'Hook' | 'Transkript' | null }
export function modellDerSitzung(session, projekt) {
  if (session?.modell) return { modell: session.modell, modelle: { [session.modell]: 1 }, quelle: 'Hook' }
  const p = transkriptPfad(session, projekt)
  let modelle = {}
  try {
    if (p && existsSync(p)) modelle = modelleAusTranskript(readFileSync(p, 'utf8'))
  } catch {
    // Das Transkript ist nur ein Beleg: ein Lesefehler (gesperrt, zu groß) ergibt „keine Quelle“, nie einen Abbruch des Berichts.
  }
  const modell = Object.entries(modelle).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  return { modell, modelle, quelle: modell ? 'Transkript' : null }
}
