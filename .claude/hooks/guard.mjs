// Wächter-Hook (PreToolUse): verweigert nur (Exit 2 + Grund auf stderr), erlaubt nie und baut keinen Befehl um.
// Muster treffen die übliche Schreibweise; sie sind keine Sicherheitsgrenze (Doku). Die zweite Ebene sind run.mjs/runs.jsonl und der pre-push-Hook.
import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const SCHREIBEN = /^(tee|out-file|set-content|add-content|new-item|ni|sc|ac|touch)\b/i
const KOPIEREN = /^(cp|mv|copy|move|copy-item|move-item)\b/i
// Dateien, die nur ein Skript bzw. der Berater schreiben darf (nur unter tmp/proof).
const SKRIPT_DATEI = /(^|[\\/])(runs\.jsonl|\d{3}-[^\\/]*\.log|db-antrag-[^\\/]*|db-push-geplant\.json|session\.json|agents\.jsonl)$/
const BERATER_DATEI = /(^|[\\/])(db-freigabe-[^\\/]*|[^\\/]*-abnahme\.md)$/
const SQL_SCHREIBEND = /\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|call|copy)\b/i

// Führende Hüllen (Umgebungsvariablen, time, & , cmd /c, npx, npm exec, dotenv -e … --, node …/supabase.js) entfernen, damit das Programm vorn steht.
function kern(segment) {
  let s = segment.trim().replace(/^&\s*/, '').replace(/^cmd(\.exe)?\s+\/c\s+/i, '')
  for (let i = 0; i < 4; i++) {
    s = s
      .replace(/^(\w+=\S*\s+)+/, '')
      .replace(/^(time|call)\s+/i, '')
      .replace(/^(npx|npm\s+exec)\s+(--\s+)?/, '')
      .replace(/^dotenv\s+(-e\s+\S+\s+)*--\s+/, '')
      .replace(/^node\s+\S*supabase\.js\s+/, 'supabase ')
  }
  return s
}

// Inhalt von Anführungszeichen durch Unterstriche ersetzen (Länge bleibt gleich): Trennzeichen und Sperrwörter im Text zählen nicht.
const maskiere = (s) => s.replace(/"[^"]*"|'[^']*'/g, (m) => m[0] + '_'.repeat(m.length - 2) + m[m.length - 1])

function segmente(befehl) {
  const maske = maskiere(befehl)
  const out = []
  let start = 0
  for (const t of maske.matchAll(/\r?\n|;|&&|\|\||\|/g)) {
    out.push({ roh: befehl.slice(start, t.index), kahl: maske.slice(start, t.index) })
    start = t.index + t[0].length
  }
  out.push({ roh: befehl.slice(start), kahl: maske.slice(start) })
  return out
}

const SUPABASE = String.raw`\bsupabase(?:\.js)?(?:\s+-\S+)*\s+`

export function entscheideBefehl(befehl) {
  const maske = maskiere(befehl)
  // Schreibendes SQL über `db query`: im ganzen Befehl (Mehrfachanweisungen, mehrzeilig, Heredoc), Dateiinhalt (-f) ist unsichtbar.
  if (new RegExp(`${SUPABASE}db\\s+query\\b`).test(maske)) {
    if (SQL_SCHREIBEND.test(befehl) || /\s(--file|-f)(\s|=)/.test(maske)) return 'Schreibendes SQL (auch aus Datei) nur über versionierte Skripte oder Migrationen.'
  }
  for (const { roh, kahl } of segmente(befehl)) {
    const seg = roh.trim()
    if (!seg) continue
    const k = kern(seg)
    if (/^(vitest|playwright\s+test)\b/.test(k) || /^npm\s+(t|tst|test)(\s|$)/.test(k) || /^npm\s+run\s+(check|test|test:\S+|shots(:all)?)(\s|$)/.test(k)) {
      return 'Tests nur über das Start-Programm: `npm run t -- check|e2e|rls|shots|<testdatei>`. Es schreibt das Log mit Hash, Sauber-Angabe, Befehl und EXIT selbst.'
    }
    if (new RegExp(`${SUPABASE}(db\\s+(push|reset)|migration\\s+(repair|up|down|squash))\\b`).test(kahl)) {
      return 'Datenbank-Änderungen nur über `npm run db:push` (Gate mit Fable-Freigabe). Direkt verboten.'
    }
    if (/^git\b/.test(k) && /--no-verify\b/.test(kahl)) return 'Git-Hooks bleiben an (`--no-verify` ist gesperrt).'
    if (/^git\b/.test(k) && /core\.hooksPath/.test(kahl)) {
      // Lesen (`git config core.hooksPath`, `--get`) bleibt erlaubt; Setzen, Löschen und `-c core.hooksPath=…` nicht.
      const nurLesen = /^git\s+config\s+(--get\s+)?core\.hooksPath\s*$/.test(kahl.trim())
      if (!nurLesen) return 'Git-Hooks bleiben an (`core.hooksPath` setzen ist gesperrt; `npm run prepare` setzt es richtig).'
    }
    if (/^python3?\s+-(\s|$)/.test(k)) return 'Kein Python über stdin (hängt unter Windows). Node-Skript oder temporäre Datei unter tmp/ nutzen.'
    const ziel = seg.split(/\s+/).pop().replace(/^['"]|['"]$/g, '')
    if (/(^|\s)(\d|&|\*)?>>?\s*['"]?[^\s'"]*\b(tmp|docs)[\\/]proof\b/.test(seg) || (SCHREIBEN.test(k) && /\b(tmp|docs)[\\/]proof\b/.test(seg) && !/-ItemType\s+Directory\b/i.test(seg))) {
      return 'Nachweise schreibt nur das Start-Programm (tmp/proof) bzw. werden byte-genau mit cp kopiert (docs/proof). Keine Umleitung dorthin; Berichte schreibt der Berater selbst mit Write.'
    }
    if ((KOPIEREN.test(k) || SCHREIBEN.test(k)) && /\btmp[\\/]proof\b/.test(ziel) && (SKRIPT_DATEI.test(ziel) || BERATER_DATEI.test(ziel))) {
      return 'Läufe, Logs, Anträge, Freigaben und Abnahmen entstehen nur durch Start-Programm bzw. advisor-report; nichts dorthin kopieren oder schreiben.'
    }
  }
  return null
}

export function entscheideDatei(pfad, agentType, vorhanden = existsSync) {
  const p = pfad.replace(/\\/g, '/')
  if (/(^|\/)\.git\//.test(p)) return 'Schreiben in .git ist gesperrt (Hooks und Konfiguration bleiben unangetastet).'
  if (/\/tmp\/proof\//.test(p) && SKRIPT_DATEI.test(p)) return 'Läufe, Logs, Anträge und Protokolle schreibt nur ein Skript (npm run t, gate-db, Hooks).'
  if (/\/tmp\/proof\//.test(p) && BERATER_DATEI.test(p) && agentType !== 'advisor-report') return 'Freigaben und Abnahmen schreibt nur der Subagent advisor-report.'
  if (/\/docs\/proof\//.test(p) && vorhanden(pfad)) return 'Nachweise in docs/proof sind unveränderlich (nach dem Schreiben nie ändern).'
  return null
}

export function entscheide(e) {
  const eingabe = e?.tool_input ?? {}
  if (typeof eingabe.command === 'string') return entscheideBefehl(eingabe.command)
  if (typeof eingabe.file_path === 'string') return entscheideDatei(eingabe.file_path, e.agent_type)
  return null
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let grund = null
  try {
    grund = entscheide(JSON.parse(readFileSync(0, 'utf8').replace(/^﻿/, '')))
  } catch (e) {
    grund = `Guard-Fehler (${e.message.split('\n')[0]}). Sicherheitshalber verweigert; Rettungsweg siehe docs/BEKS_EINRICHTUNG.md.`
  }
  if (grund) {
    process.stderr.write(`GUARD: ${grund}\n`)
    process.exit(2)
  }
}
