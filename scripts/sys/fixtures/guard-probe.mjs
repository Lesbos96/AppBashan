// Fixture für Proben: schickt Befehle als Hook-Eingabe an .claude/hooks/guard.mjs und zeigt je Befehl Werkzeug, Guard-Antwort und Guard-Exit (2 = verweigert, 0 = durchgelassen).
// Aufruf: node guard-probe.mjs <verweigert|frei> <Bash|PowerShell> <befehl>…
// Exit 0 nur, wenn jeder Befehl wie erwartet ausging; sonst 1 (die Zeile „ABWEICHUNG“ nennt den Befehl).
import { spawnSync } from 'node:child_process'

const [erwartet, werkzeug, ...befehle] = process.argv.slice(2)
if (!['verweigert', 'frei'].includes(erwartet) || !['Bash', 'PowerShell'].includes(werkzeug) || befehle.length === 0) {
  console.error('Aufruf: guard-probe.mjs <verweigert|frei> <Bash|PowerShell> <befehl>…')
  process.exit(2)
}
const soll = erwartet === 'verweigert' ? 2 : 0
let abweichungen = 0
for (const befehl of befehle) {
  const r = spawnSync(process.execPath, ['.claude/hooks/guard.mjs'], { input: JSON.stringify({ tool_name: werkzeug, tool_input: { command: befehl } }), encoding: 'utf8' })
  console.log(`Werkzeug: ${werkzeug}\nBefehl: ${befehl}\nGuard-Antwort: ${r.stderr.trim() || '(keine, durchgelassen)'}\nGuard-Exit: ${r.status}\n`)
  if (r.status !== soll) {
    abweichungen++
    console.log(`ABWEICHUNG: erwartet ${erwartet} (Exit ${soll}), war Exit ${r.status}: ${befehl}\n`)
  }
}
console.log(`Ergebnis: ${befehle.length - abweichungen} von ${befehle.length} wie erwartet (${erwartet})`)
process.exit(abweichungen ? 1 : 0)
