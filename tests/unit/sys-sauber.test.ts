// Arbeitsbaum „sauber“ (scripts/sys/lib.mjs) im echten Git-Repo: Nachweise, die `npm run bericht` in den Index legt, zählen nur für run.mjs und bericht.mjs nicht als Änderung.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const lib = pathToFileURL(join(process.cwd(), 'scripts/sys/lib.mjs')).href

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'sauber-'))
  const git = (...a: string[]) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' })
  const datei = (p: string, text: string) => {
    mkdirSync(join(dir, p, '..'), { recursive: true })
    writeFileSync(join(dir, p), text)
  }
  git('init', '-q')
  datei('.gitignore', '*.log\n')
  for (const p of ['docs/proof/gruen.json', 'docs/proof/u3/bericht.md', 'docs/proof/u3/alt.md', 'docs/proof/u3/weg.md', 'docs/STAND.md', 'src/a.ts']) datei(p, 'a\n')
  git('add', '.')
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'start')
  // `sauber()` läuft im Arbeitsordner des Prozesses, darum ein Kindprozess im Test-Repo
  const sauber = (mitNachweisen: boolean) => {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { sauber } from '${lib}'; console.log(sauber(${mitNachweisen}))`], { cwd: dir, encoding: 'utf8' })
    expect(r.status).toBe(0)
    return r.stdout.trim() === 'true'
  }
  return { git, datei, sauber, weg: () => rmSync(dir, { recursive: true, force: true }) }
}

describe('sauber()', () => {
  it('unverändertes Repo ist sauber, unverfolgte Datei unter docs/ ebenfalls (beide Formen)', () => {
    const r = repo()
    for (const m of [false, true]) expect(r.sauber(m)).toBe(true)
    r.datei('docs/neu.md', 'x\n')
    for (const m of [false, true]) expect(r.sauber(m)).toBe(true)
    r.weg()
  })

  it('Zustand nach `npm run bericht` (neue Nachweise per add -f, gruen.json und bericht.md neu geschrieben, gestaged): nur mit nachweiseImIndex sauber', () => {
    const r = repo()
    r.datei('docs/proof/u4/bericht.json', '{}\n')
    r.datei('docs/proof/u4/033-e2e.log', 'EXIT=0\n') // ignoriert, wird erzwungen aufgenommen
    r.datei('docs/proof/gruen.json', '{"check":1}\n')
    r.datei('docs/proof/u3/bericht.md', 'neu\n')
    r.git('add', '-f', 'docs/proof/u4/bericht.json', 'docs/proof/u4/033-e2e.log', 'docs/proof/gruen.json', 'docs/proof/u3/bericht.md')
    expect(r.git('status', '--porcelain')).toMatch(/^A {2}docs\/proof\/u4\/033-e2e\.log$/m)
    expect(r.sauber(true)).toBe(true)
    expect(r.sauber(false)).toBe(false) // fertig und start-schritt verlangen einen leeren Index
    r.weg()
  })

  it.each([
    ['gestagete Änderung eines alten Nachweises', (r: ReturnType<typeof repo>) => { r.datei('docs/proof/u3/alt.md', 'b\n'); r.git('add', 'docs/proof/u3/alt.md') }],
    ['ungestagete Änderung an gruen.json', (r: ReturnType<typeof repo>) => r.datei('docs/proof/gruen.json', 'b\n')],
    ['gestagt und danach weiter geändert (MM)', (r: ReturnType<typeof repo>) => { r.datei('docs/proof/gruen.json', 'b\n'); r.git('add', 'docs/proof/gruen.json'); r.datei('docs/proof/gruen.json', 'c\n') }],
    ['neu gestagt und danach geändert (AM)', (r: ReturnType<typeof repo>) => { r.datei('docs/proof/u4/x.md', 'b\n'); r.git('add', '-f', 'docs/proof/u4/x.md'); r.datei('docs/proof/u4/x.md', 'c\n') }],
    ['gelöschter Nachweis (D )', (r: ReturnType<typeof repo>) => r.git('rm', '-q', 'docs/proof/u3/weg.md')],
    ['umbenannter Nachweis (R )', (r: ReturnType<typeof repo>) => r.git('mv', 'docs/proof/u3/weg.md', 'docs/proof/u3/weg2.md')],
    ['gestagte Doku außerhalb von docs/proof/', (r: ReturnType<typeof repo>) => { r.datei('docs/STAND.md', 'b\n'); r.git('add', 'docs/STAND.md') }],
    ['gestagter Code', (r: ReturnType<typeof repo>) => { r.datei('src/a.ts', 'b\n'); r.git('add', 'src/a.ts') }],
    ['unverfolgter Code', (r: ReturnType<typeof repo>) => r.datei('src/neu.ts', 'x\n')],
    ['Nachweis im Index plus ungestagte Codeänderung (nicht die erste Zeile)', (r: ReturnType<typeof repo>) => { r.datei('docs/proof/u4/bericht.json', '{}\n'); r.git('add', '-f', 'docs/proof/u4/bericht.json'); r.datei('src/a.ts', 'b\n') }],
  ])('%s ist unsauber, auch mit nachweiseImIndex', (_name, aendere) => {
    const r = repo()
    aendere(r)
    for (const m of [false, true]) expect(r.sauber(m)).toBe(false)
    r.weg()
  })
})
