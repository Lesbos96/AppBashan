// `npm run start-schritt -- <name>`: Ausgangslage prüfen (bricht bei Abweichung ab), Branch anlegen, Stand ausgeben.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { git, hooksAktiv, sauber } from './lib.mjs'

const name = process.argv[2]
const fehler = []
if (!/^[a-z0-9][a-z0-9-]*$/.test(name ?? '')) fehler.push('Aufruf: npm run start-schritt -- <name> (Kleinbuchstaben, Ziffern, Bindestrich)')
else {
  if (git('branch', '--show-current') !== 'main') fehler.push('nicht auf main')
  git('fetch')
  if (git('rev-parse', 'main') !== git('rev-parse', 'origin/main')) fehler.push('main weicht von origin/main ab')
  if (!sauber()) fehler.push('Arbeitsbaum nicht sauber')
  if (!hooksAktiv()) fehler.push('core.hooksPath ist nicht .githooks (npm run prepare ausführen)')
  const prozesse = execFileSync('powershell.exe', ['-NoProfile', '-Command', "(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'vitest|playwright' }).Count"], { encoding: 'utf8' }).trim()
  if (prozesse !== '0' && prozesse !== '') fehler.push(`${prozesse} laufende vitest/playwright-Prozesse`)
}
if (fehler.length) {
  console.error(`START BLOCKIERT:\n- ${fehler.join('\n- ')}`)
  process.exit(1)
}
git('checkout', '-b', name)
console.log(`Branch ${name} von main angelegt.`)
if (existsSync('docs/STAND.md')) console.log(readFileSync('docs/STAND.md', 'utf8'))
