// sys1 (u5-3 M1): Löschen und Verschieben von Nachweisen unter tmp/proof ist gesperrt (Abnahmen, Freigaben, Läufe, Logs, Ordner, Platzhalter); lauf.lock bleibt löschbar.
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const GUARD = resolve('.claude/hooks/guard.mjs')
const bash = (command: string, tool_name = 'Bash') => {
  const r = spawnSync(process.execPath, [GUARD], { input: JSON.stringify({ tool_name, tool_input: { command } }), encoding: 'utf8' })
  return { exit: r.status, stderr: r.stderr }
}

describe('Guard: Löschen und Verschieben unter tmp/proof', () => {
  it.each([
    'rm tmp/proof/sys1-abnahme-1.md',
    'rm -f tmp/proof/sys1/runs.jsonl',
    'rm -r tmp/proof/sys1',
    'rm -rf tmp/proof',
    'del tmp\\proof\\*abnahme*',
    'del tmp\\proof\\sys1-abnahme-1.md',
    'erase tmp\\proof\\sys1\\001-check.log',
    'Remove-Item -LiteralPath tmp\\proof\\sys1-abnahme-2.md',
    'Remove-Item -Path tmp\\proof\\a.md,tmp\\proof\\sys1-abnahme-1.md',
    'REMOVE-ITEM "TMP\\Proof\\sys1\\runs.jsonl"',
    'ri tmp/proof/sys1 -Recurse',
    'rd /s /q tmp\\proof\\sys1',
    'rmdir /s /q tmp\\proof\\sys1',
    'rni tmp/proof/sys1-abnahme-1.md x',
    'unlink tmp/proof/sys1-abnahme-1.md',
    'mv tmp/proof/sys1-abnahme-1.md /tmp/x',
    'move tmp\\proof\\sys1-abnahme-1.md x',
    'mi tmp/proof/sys1-abnahme-1.md x',
    'Move-Item tmp/proof/sys1/runs.jsonl x',
    'ren tmp\\proof\\sys1-abnahme-1.md y.md',
    'git rm -f tmp/proof/sys1-abnahme-1.md',
    'git mv tmp/proof/sys1-abnahme-1.md y.md',
    'cd tmp/proof && rm sys1-abnahme-1.md',
    'cd tmp/proof/sys1; rm runs.jsonl',
    'cd tmp/proof/sys1; rm 003-rls.log',
    'rm *abnahme*',
    'cmd /c del tmp\\proof\\sys1-abnahme-1.md',
    'bash -c "rm tmp/proof/sys1-abnahme-1.md"',
    'powershell -Command "Remove-Item tmp\\proof\\sys1\\runs.jsonl"',
  ])('verweigert: %s', (befehl) => {
    const r = bash(befehl, /^(Remove-Item|REMOVE|ri |rni|mi |Move-Item|powershell)/i.test(befehl) ? 'PowerShell' : 'Bash')
    expect(r.exit, r.stderr).toBe(2)
    expect(r.stderr).toMatch(/tmp\/proof|Nachweise/)
  })

  // sys1-4: auch Elternordner (tmp, Wurzel), Schreibweisen (tmp//proof, tmp/./proof, Git-Bash-Pfad), Platzhalter, Klammerlisten und cd im selben Befehl.
  const gitBash = '/' + resolve('.')[0]!.toLowerCase() + resolve('.').slice(2).replace(/\\/g, '/')
  it.each([
    'rm -rf tmp',
    'rm -r tmp/',
    'Remove-Item tmp -Recurse',
    'Remove-Item -Recurse -Force .\\tmp',
    'ri tmp -Recurse',
    'rd /s /q tmp',
    'mv tmp x',
    'move tmp\\ x',
    'git mv tmp x',
    'rm -rf tmp//proof',
    'rm -rf tmp/./proof',
    'rm -rf ./tmp',
    'rm -rf .',
    'rm -rf ..',
    'rm -rf tmp/*',
    'rm -rf tmp/p*',
    'rm -rf t*',
    'rm -rf {tmp,dist}',
    'rm -rf dist tmp',
    `rm -rf ${gitBash}/tmp`,
    `rm -rf ${gitBash}/tmp/proof/sys1`,
    'cd tmp && rm -rf proof',
    'cd tmp/proof && rm -rf sys1',
    'cd tmp/proof/sys1; rm *.md',
    'Set-Location tmp; Remove-Item proof -Recurse',
  ])('sys1-4 verweigert: %s', (befehl) => {
    const r = bash(befehl, /^(Remove-Item|ri |Set-Location)/i.test(befehl) ? 'PowerShell' : 'Bash')
    expect(r.exit, r.stderr).toBe(2)
    expect(r.stderr).toMatch(/tmp\/proof|Nachweise/)
  })

  it.each([
    'rm -rf node_modules dist',
    'rm -f x 2>/dev/null',
    'rm tmp/x.txt',
    'rm -rf tmp/proof-alt',
    'rm src/x.ts',
    'mv x.png .',
    'git mv a.md ..',
    'mv tmp/x.txt tmp/shots/',
    'cd tmp/shots && rm a.png',
    'cd tmp && rm -rf shots',
    'Remove-Item -Path tmp\\shots -Recurse',
  ])('sys1-4 erlaubt: %s', (befehl) => {
    const r = bash(befehl, /^Remove-Item/i.test(befehl) ? 'PowerShell' : 'Bash')
    expect(r.exit, r.stderr).toBe(0)
  })

  it.each([
    'rm tmp/proof/lauf.lock',
    'rm -f tmp/proof/lauf.lock',
    'del tmp\\proof\\lauf.lock',
    'Remove-Item -LiteralPath tmp\\proof\\lauf.lock',
    'rm tmp/x/y.txt',
    'rm -rf tmp/shots',
    'ls tmp/proof',
    'cat tmp/proof/sys1-abnahme-1.md',
    'git status',
  ])('erlaubt: %s', (befehl) => {
    const r = bash(befehl, /^Remove-Item/i.test(befehl) ? 'PowerShell' : 'Bash')
    expect(r.exit, r.stderr).toBe(0)
  })
})
