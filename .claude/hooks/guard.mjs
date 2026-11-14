// Wächter-Hook (PreToolUse): verweigert nur (Exit 2 + Grund auf stderr), erlaubt nie und baut keinen Befehl um.
// Muster treffen die übliche Schreibweise; sie sind keine Sicherheitsgrenze (Doku). Die zweite Ebene sind run.mjs/runs.jsonl, fertig und der pre-push-Hook.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCHREIBEN = /^(tee|out-file|set-content|add-content|new-item|ni|sc|ac|touch)\b/i
const KOPIEREN = /^(cp|mv|copy|move|copy-item|move-item)\b/i
// Dateien, die nur ein Skript bzw. der Berater schreiben darf (nur unter tmp/proof).
const SKRIPT_DATEI = /(^|[\\/])(runs\.jsonl|\d{3}-[^\\/]*\.log|db-antrag-[^\\/]*|loesch-lauf\.jsonl|session\.json|agents\.jsonl)$/
const BERATER_DATEI = /(^|[\\/])(db-freigabe-[^\\/]*|loesch-freigabe-[^\\/]*|[^\\/]*-abnahme\.md)$/
const SQL_SCHREIBEND =
  /\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|call|copy|do|merge|execute|perform|into|set|reset|lock|refresh|vacuum|comment|prepare)\b|\b(admin_\w+|set_config|setval|pg_terminate_backend|pg_cancel_backend|dblink\w*|lo_\w+)\s*\(|\b(cron|net)\./i
const SHELL = '(?:bash|sh|zsh|dash|ksh|pwsh|powershell|cmd)'
const PROGRAMME = '(?:npm|npx|node|vitest|playwright|supabase|psql|bash|sh|zsh|dash|ksh|pwsh|powershell|cmd|python3?|deno|tsx|dotenv)'
const MCP_DB = /(execute_sql|apply_migration|reset_branch|restore_project|delete_branch|merge_branch|deploy_edge_function)/i

// Führende Hüllen (Umgebungsvariablen, time, & , npx, npm exec, dotenv -e … --, Klammern, then/do/exec/env …, node …/supabase.js) entfernen, damit das Programm vorn steht;
// Verzeichnis und .cmd/.exe vor bekannten Programmnamen entfallen (node_modules/.bin/vitest, npm.cmd).
function kern(segment) {
  let s = segment.trim().replace(/^&\s*/, '')
  for (let i = 0; i < 4; i++) {
    s = s
      .replace(/^(\w+=\S*\s+)+/, '')
      .replace(/^[({!]+\s*|^\$\(\s*/, '')
      .replace(/^(time|call|then|do|else|elif|exec|env|nohup|command|builtin|sudo)\s+/i, '')
      .replace(/^(npx|npm\s+exec)\s+(--\s+)?/, '')
      .replace(/^dotenv\s+(-e\s+\S+\s+)*--\s+/, '')
      .replace(/^node\s+\S*supabase\.js\s+/, 'supabase ')
  }
  s = s.replace(/\s*[)}]+$/, '')
  return s.replace(new RegExp(`^["']?(?:[^\\s"']*[\\\\/])?(${PROGRAMME})(?:\\.cmd|\\.exe|\\.ps1)?["']?(?=\\s|$)`, 'i'), (_m, name) => name.toLowerCase())
}

// Inhalt von Anführungszeichen durch Unterstriche ersetzen (Länge bleibt gleich): Trennzeichen und Sperrwörter im Text zählen nicht.
const maskiere = (s) => s.replace(/"[^"]*"|'[^']*'/g, (m) => m[0] + '_'.repeat(m.length - 2) + m[m.length - 1])

// trenner: das Zeichen vor dem Segment (`|` heißt: die Eingabe kommt aus dem vorigen Segment).
function segmente(befehl) {
  const maske = maskiere(befehl)
  const out = []
  let start = 0
  let trenner = null
  for (const t of maske.matchAll(/\r?\n|;|&&|\|\||\||(?<![>&])&(?![&>])/g)) {
    out.push({ roh: befehl.slice(start, t.index), kahl: maske.slice(start, t.index), trenner })
    start = t.index + t[0].length
    trenner = t[0]
  }
  out.push({ roh: befehl.slice(start), kahl: maske.slice(start), trenner })
  return out
}

const SUPABASE = String.raw`\bsupabase(?:\.js)?(?:\s+-\S+)*\s+`
const norm = (p) => p.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase()
// Innentext verschachtelter Shells grob entquotet (alle Anführungszeichen und Escapes entfernt) neu prüfen, statt ihn genau zu parsen.
const grob = (t) => t.trim().replace(/\\(["'])/g, '$1').replace(/["'`]/g, '')

// Liefert den Innentext einer Shell, die einen Befehl bekommt (bash -c, powershell -Command, cmd /c, eval, iex), sonst null; { verweigern } bei EncodedCommand.
function innentext(k) {
  let m
  if ((m = new RegExp(`^(?:bash|sh|zsh|dash|ksh)\\s+(?:-\\S+\\s+)*?-[a-z]*c\\s+([\\s\\S]*)$`, 'i').exec(k))) return grob(m[1])
  if (/^(?:powershell|pwsh)\s(?:[\s\S]*?\s)?-(?:e|ec|enc\w*|encodedcommand)\s/i.test(k)) return { verweigern: 'PowerShell -EncodedCommand ist nicht prüfbar und gesperrt.' }
  if ((m = /^(?:powershell|pwsh)\s+(?:-\S+(?:\s+[^-\s]\S*)?\s+)*?-(?:c|com\w*)\s+([\s\S]*)$/i.exec(k))) return grob(m[1])
  if ((m = /^cmd\s+(?:\/\S+\s+)*?\/[ck]\s+([\s\S]*)$/i.exec(k))) return grob(m[1])
  if ((m = /^(?:eval|iex|invoke-expression)\s+([\s\S]*)$/i.exec(k))) return grob(m[1])
  return null
}

// Wörter eines Befehls, Anführungszeichen als ein Wort (Pfade mit Leerzeichen).
const woerter = (k) => [...k.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3])

// Skriptdatei, die eine Shell ausführt (bash x.sh, ./x.sh, . x.sh, source x.sh, pwsh -File x.ps1, auch mit Optionswerten, .\x.ps1, cmd /c call x.bat): Pfad oder null.
// k ist der Kern ohne Hüllen (Umgebungsvariablen, dotenv, time, call …). Bei bash, sh, source und `.` zählt auch ein erstes Wort ohne Option und ohne Endung.
function skriptDatei(k) {
  const w = woerter(k)
  const ENDUNG = /\.(sh|ps1|bat|cmd)$/i
  if (!/^(bash|sh|zsh|dash|ksh|source|\.|cmd|powershell|pwsh)(\.exe)?$/i.test(w[0] ?? '')) return ENDUNG.test(w[0] ?? '') ? w[0] : null
  const rest = w.slice(1).filter((x) => !/^call$/i.test(x))
  return rest.find((x) => ENDUNG.test(x)) ?? (/^(bash|sh|zsh|dash|ksh|source|\.)(\.exe)?$/i.test(w[0]) ? rest.find((x) => !/^[-/]/.test(x)) ?? null : null)
}

let registerCache
function ladeRegister() {
  if (registerCache !== undefined) return registerCache
  try {
    const skripte = Object.keys(JSON.parse(readFileSync(join(WURZEL, 'scripts/sys/loesch-register.json'), 'utf8')).skripte)
    const pkg = JSON.parse(readFileSync(join(WURZEL, 'package.json'), 'utf8')).scripts
    registerCache = { skripte, aliase: Object.entries(pkg).filter(([n, t]) => n !== 'loesch' && skripte.some((p) => norm(t).includes(p))).map(([n]) => n) }
  } catch {
    registerCache = null
  }
  return registerCache
}

// Direktaufruf eines Registerskripts (Lösch-Gate) am Gate vorbei: Grund oder null.
function loeschDirekt(k) {
  const interpreter = /^(node|deno|tsx|bun)\b/.test(k)
  const npmRun = /^npm\s+(?:run|run-script|rum|urn)\s+(\S+)/.exec(k)
  if (!interpreter && !npmRun) return null
  const r = ladeRegister()
  if (!r) return 'Das Lösch-Register (scripts/sys/loesch-register.json) oder package.json ist nicht lesbar; Aufruf sicherheitshalber verweigert.'
  // Nur das Skript zählt, das der Interpreter startet (erstes Wort mit Skript-Endung, Optionen samt Werten und Anführungszeichen übersprungen), nicht Wörter in den Argumenten.
  const ziel = norm(woerter(k).slice(1).find((x) => /\.(mjs|cjs|js|mts|ts)$/i.test(x)) ?? '')
  if (interpreter && r.skripte.some((p) => ziel.endsWith(p) || (p.endsWith('.mjs') && ziel === p.split('/').pop()))) return 'Skripte, die auf Dev löschen oder Status ändern, nur über `npm run loesch -- <skript.mjs>` (Lösch-Gate mit Fable-Freigabe).'
  if (npmRun && r.aliase.includes(npmRun[1])) return `\`npm run ${npmRun[1]}\` startet ein Lösch-Skript: nur über \`npm run loesch -- <skript.mjs>\` (Lösch-Gate mit Fable-Freigabe).`
  return null
}

export function entscheideBefehl(befehl, tiefe = 0) {
  if (tiefe > 4) return 'Shell-Verschachtelung tiefer als 4: nicht prüfbar.'
  for (const { roh, kahl, trenner } of segmente(befehl)) {
    const seg = roh.trim()
    if (!seg) continue
    const k = kern(seg)
    const kk = kern(kahl.trim())
    if (/^(vitest|playwright\s+test)\b/.test(k) || /^npm\s+(t|tst|test)(\s|$)/.test(k) || /^npm\s+(?:run|run-script|rum|urn)\s+(check|test|test:\S+|shots(:all)?)(\s|$)/.test(k)) {
      return 'Tests nur über das Start-Programm: `npm run t -- check|e2e|rls|shots|<testdatei>`. Es schreibt das Log mit Hash, Sauber-Angabe, Befehl und EXIT selbst.'
    }
    if (new RegExp(`${SUPABASE}(db\\s+(push|reset)|migration\\s+(repair|up|down|squash)|storage\\s+(rm|cp|mv)|functions\\s+delete|secrets\\s+unset|backups\\s+restore|branches\\s+(delete|pause)|projects\\s+delete)\\b`).test(kk) || (/^supabase\b/.test(kk) && /(^|\s)--db-url\b/.test(kk))) {
      return 'Datenbank-Änderungen nur über `npm run db:push` (Gate mit Fable-Freigabe). Direkt verboten.'
    }
    if (/^psql\b/.test(k)) return 'psql ist gesperrt: SQL nur über versionierte Skripte, Migrationen (db:push) oder das Lösch-Gate.'
    if (new RegExp(`${SUPABASE}db\\s+query\\b`).test(kk)) {
      if (!/^(supabase|echo|printf|grep|rg|cat|type|ls|dir|get-content|select-string|git|npm|node)\b/i.test(kk)) return '`db query` nur als eigener Befehl (nicht hinter xargs, einer Hülle o. ä.).'
      // Schreibendes SQL im Segment (Mehrfachanweisungen in Anführungszeichen bleiben im Segment; Heredoc und `<` verweigert die Regel darunter), Dateiinhalt (-f) ist unsichtbar.
      if (/^supabase\b/.test(kk)) {
        if (SQL_SCHREIBEND.test(roh) || /\s(--file|-f)(\s|=)/.test(kahl)) return 'Schreibendes SQL (auch aus Datei) nur über versionierte Skripte oder Migrationen.'
        const ohneEinfache = roh.replace(/'[^']*'/g, "''")
        if (trenner === '|' || /</.test(kahl) || /\$[\w({]|`/.test(ohneEinfache)) return 'SQL aus Pipe, Datei-Umleitung oder Ersetzung ($…, Backtick) ist nicht prüfbar: nur ein wörtliches select als Argument.'
        // Erlaubtform: nach `db query` nur Optionen (mit Wert) und höchstens ein Argument in Anführungszeichen; Klammerausdrücke, @, bloße Wörter werden verweigert.
        let vorOption = false
        let zitate = 0
        for (const t of kk.replace(new RegExp(`^${SUPABASE}db\\s+query\\b`), '').trim().split(/\s+/).filter(Boolean)) {
          if (t.startsWith('-')) vorOption = !t.includes('=')
          else if (/^(["']).*\1$/.test(t)) {
            zitate++
            vorOption = false
          } else if (vorOption && /^[\w.:-]+$/.test(t)) vorOption = false
          else return 'Die Argumente von `db query` sind nicht prüfbar: nur Optionen und ein wörtliches select in Anführungszeichen.'
        }
        if (zitate > 1) return 'Die Argumente von `db query` sind nicht prüfbar: genau ein wörtliches select in Anführungszeichen.'
      }
    }
    if (trenner === '|' && (new RegExp(`^(${SHELL}|iex|invoke-expression)\\b`, 'i').test(k) || /^(node|deno|tsx|python3?|bun|ruby|perl)(\s+-)?\s*$/.test(k))) {
      return 'Ein Befehl per Pipe an eine Shell oder einen Interpreter ist nicht prüfbar.'
    }
    if (/^(node|tsx)\s+(-p|--print|-pe|-e|--eval)\b/.test(k) || /^deno\s+eval\b/.test(k)) return 'Kein Inline-JavaScript (-e/-p/eval): Skript unter tmp/ nutzen.'
    const innen = innentext(k)
    if (innen !== null) {
      if (typeof innen === 'object') return innen.verweigern
      const g = entscheideBefehl(innen, tiefe + 1)
      if (g) return g
    }
    const datei = skriptDatei(k)
    if (datei !== null && innen === null) {
      let inhalt
      try {
        inhalt = readFileSync(datei, 'utf8')
      } catch {
        return `Skriptdatei ${datei} nicht lesbar: ihr Inhalt lässt sich nicht prüfen, Aufruf verweigert.`
      }
      const g = entscheideBefehl(inhalt, tiefe + 1)
      if (g) return `${g} (in der Skriptdatei ${datei})`
    }
    const direkt = loeschDirekt(k)
    if (direkt) return direkt
    if (/^git\b/.test(k) && /--no-verify\b/.test(kahl)) return 'Git-Hooks bleiben an (`--no-verify` ist gesperrt).'
    if (/^git\b/.test(k) && /core\.hooksPath/.test(kahl)) {
      // Lesen (`git config core.hooksPath`, `--get`) bleibt erlaubt; Setzen, Löschen und `-c core.hooksPath=…` nicht.
      const nurLesen = /^git\s+config\s+(--get\s+)?core\.hooksPath\s*$/.test(kahl.trim())
      if (!nurLesen) return 'Git-Hooks bleiben an (`core.hooksPath` setzen ist gesperrt; `npm run prepare` setzt es richtig).'
    }
    if (/^python3?\s+-(\s|$)/.test(k)) return 'Kein Python über stdin (hängt unter Windows). Node-Skript oder temporäre Datei unter tmp/ nutzen.'
    // docs/freigaben (Lösch-Freigaben) schreibt nur `npm run loesch -- uebernehme`: jedes Segment mit diesem Pfad, das kein Lesebefehl ist, und jede Umleitung dorthin wird verweigert.
    // Steht der Pfad nur in Anführungszeichen (Text, Argument eines Programms), zählt er nur bei einem schreibenden Programm oder einer Umleitung.
    if (/docs[\\/]+freigaben/i.test(seg)) {
      const offen = /docs[\\/]+freigaben/i.test(kahl)
      // node und npm gelten als Leser: ein Skript kann überall schreiben (Grenze, OPEN_ISSUES u1b-3), ein Pfad als Argument ändert daran nichts.
      const lesen = /^(cat|ls|dir|grep|rg|head|tail|type|wc|echo|printf|diff|cmp|stat|sha256sum|get-content|get-childitem|get-filehash|select-string|test-path|node|npm)\b/i.test(k) || /^git\s+(status|log|show|diff|ls-files|ls-tree|add|commit|blame|rev-parse)\b/i.test(k)
      const schreibt = /^(cp|mv|copy|move|copy-item|move-item|tee|out-file|set-content|add-content|new-item|ni|sc|ac|touch|rm|del|erase|remove-item|ri|install|rsync|robocopy|xcopy)\b/i.test(k) || /^git\s+(mv|rm|checkout|restore|apply|am)\b/i.test(k)
      const umleitung = [...kahl.matchAll(/(^|\s)(\d|&|\*)?>>?\s*/g)].some((m) => /^['"]?\S*docs[\\/]+freigaben/i.test(roh.slice(m.index + m[0].length))) // `>` außerhalb von Anführungszeichen
      if ((offen && !lesen) || schreibt || umleitung) return 'docs/freigaben schreibt nur `npm run loesch -- uebernehme <tmp/proof/…/loesch-freigabe-N.md>`; nur Lesen und git add sind erlaubt.'
    }
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
  const p = resolve(pfad).replace(/\\/g, '/').toLowerCase() // aufgelöst und kleingeschrieben: unter Windows ist TMP\.\Proof dieselbe Datei wie tmp/proof
  if (/(^|\/)\.git\//.test(p)) return 'Schreiben in .git ist gesperrt (Hooks und Konfiguration bleiben unangetastet).'
  if (/\/docs\/freigaben\//.test(p)) return 'docs/freigaben schreibt nur `npm run loesch -- uebernehme` (Lösch-Gate), nie ein Schreibwerkzeug.'
  if (/\/tmp\/proof\//.test(p) && SKRIPT_DATEI.test(p)) return 'Läufe, Logs, Anträge und Protokolle schreibt nur ein Skript (npm run t, gate-db, Hooks).'
  if (/\/tmp\/proof\//.test(p) && BERATER_DATEI.test(p) && agentType !== 'advisor-report') return 'Freigaben und Abnahmen schreibt nur der Subagent advisor-report.'
  if (/\/docs\/proof\//.test(p) && vorhanden(pfad)) return 'Nachweise in docs/proof sind unveränderlich (nach dem Schreiben nie ändern).'
  return null
}

export function entscheide(e) {
  const eingabe = e?.tool_input ?? {}
  if (typeof e?.tool_name === 'string' && e.tool_name.startsWith('mcp__') && MCP_DB.test(e.tool_name)) return 'Datenbank-Werkzeuge des MCP-Servers sind gesperrt (Gate: npm run db:push, Lösch-Gate).'
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
