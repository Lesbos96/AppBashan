import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const GUARD = resolve('.claude/hooks/guard.mjs')
function guard(eingabe: unknown, roh?: string, cwd?: string) {
  const r = spawnSync(process.execPath, [GUARD], { input: roh ?? JSON.stringify(eingabe), encoding: 'utf8', cwd })
  return { exit: r.status, stderr: r.stderr }
}
const bash = (command: string, tool_name = 'Bash', cwd?: string) => guard({ tool_name, tool_input: { command } }, undefined, cwd)
const datei = (file_path: string, agent_type?: string) => guard({ tool_name: 'Write', agent_type, tool_input: { file_path } })

describe('Wächter-Hook guard.mjs: verweigert (Exit 2 mit Grund)', () => {
  it.each([
    'npm run check',
    'npm run check; echo EXIT=$?',
    'cd x && npm run test:rls',
    '& npm run test:e2e',
    'FOO=1 npm run shots',
    'time npm test',
    'npm t',
    'npx vitest run --project unit',
    'vitest run',
    'npx dotenv -e .env.local -- vitest run --project rls',
    'npx playwright test --project=e2e',
  ])('Test am Start-Programm vorbei: %s', (c) => {
    const r = bash(c)
    expect(r.exit).toBe(2)
    expect(r.stderr).toMatch(/npm run t/)
  })
  it.each([
    'npx supabase db push --linked',
    'npx dotenv -e .env.local -- supabase db push --linked --yes',
    'node node_modules/supabase/dist/supabase.js db push',
    'supabase migration repair --status applied 1',
    'npx supabase db reset',
    'supabase db query "delete from public.x" --linked',
    'supabase db query --linked "DROP TABLE x"',
    'supabase db query "select 1; delete from public.x" --linked',
    'supabase db query "select 1;\ndelete from public.x" --linked',
    'supabase db query --linked <<EOF\nselect 1;\nupdate public.x set a = 1;\nEOF',
    'supabase db query --linked "create table x (a int)"',
    'supabase db query --linked --file tmp/x.sql',
    'supabase db query --linked -f tmp/x.sql',
    'supabase --debug db push',
    'supabase migration up --linked',
    'npx supabase migration squash',
  ])('Datenbank am Gate vorbei: %s', (c) => {
    expect(bash(c).exit).toBe(2)
  })
  it('SQL-Sperre gilt auch im PowerShell-Werkzeug', () => {
    expect(bash('supabase db query "select 1; delete from public.x" --linked', 'PowerShell').exit).toBe(2)
  })
  it.each([
    'git commit --no-verify -m x',
    'git push --no-verify',
    'git config core.hooksPath /dev/null',
    'git config --global core.hooksPath x',
    'git config --unset core.hooksPath',
    'git -c core.hooksPath=x push',
    'python - <<EOF',
  ])('Git-Hooks und Python-stdin: %s', (c) => {
    expect(bash(c).exit).toBe(2)
  })
  it.each([
    'echo x > tmp/proof/u1/001-check.log',
    'echo x >> docs/proof/u1/a.log',
    'cat a 1> tmp\\proof\\u1\\b.txt',
    'cmd &> tmp/proof/u1/a.txt',
    'Get-Process *> tmp/proof/u1/a.txt',
    'Set-Content tmp/proof/u1/a.txt x',
    'Out-File docs/proof/u1/a.txt',
    'cp foo tmp/proof/u1/runs.jsonl',
    'Copy-Item foo tmp/proof/u1/003-rls.log',
    'cp foo tmp/proof/u1/db-freigabe-1.md',
    'cp foo tmp/proof/u1-abnahme.md',
    'cp foo tmp/proof/u1/session.json',
  ])('Nachweise fälschen: %s', (c) => {
    expect(bash(c).exit).toBe(2)
  })
  it('PowerShell-Werkzeug wird wie Bash geprüft', () => {
    expect(bash('npm run check; "EXIT=$LASTEXITCODE"', 'PowerShell').exit).toBe(2)
  })

  it('Write auf Läufe, Logs, Protokolle und .git', () => {
    for (const p of ['/p/tmp/proof/u1/runs.jsonl', 'C:\\p\\tmp\\proof\\u1\\003-check.log', '/p/tmp/proof/u1/db-antrag-1.json', '/p/tmp/proof/session.json', '/p/tmp/proof/agents.jsonl', '/p/.git/config']) {
      expect(datei(p).exit, p).toBe(2)
      expect(datei(p, 'advisor-report').exit, `${p} (auch advisor-report)`).toBe(2)
    }
  })
  it('Freigabe und Abnahme nur von advisor-report', () => {
    for (const p of ['/p/tmp/proof/u1/db-freigabe-1.md', '/p/tmp/proof/u1-abnahme.md']) {
      expect(datei(p).exit, p).toBe(2)
      expect(datei(p, 'reviewer').exit, `${p} (reviewer)`).toBe(2)
      expect(datei(p, 'advisor-report').exit, `${p} (advisor-report)`).toBe(0)
    }
  })
  it('vorhandene Nachweise in docs/proof sind unveränderlich, neue Pfade nicht betroffen', () => {
    const dir = mkdtempSync(join(tmpdir(), 'guard-'))
    mkdirSync(join(dir, 'docs', 'proof'), { recursive: true })
    const vorhanden = join(dir, 'docs', 'proof', 'a.log')
    writeFileSync(vorhanden, 'x')
    expect(datei(vorhanden).exit).toBe(2)
    expect(datei(join(dir, 'docs', 'proof', 'neu.log')).exit).toBe(0)
  })
})

describe('Wächter-Hook guard.mjs: lässt durch (Exit 0, keine Ausgabe)', () => {
  it.each([
    'npm run t -- check',
    'npm run build',
    'npm run lint',
    'npm run check:deno',
    'npm run db:push',
    'git status',
    'git commit -m "erwähnt npm run check und supabase db push"',
    'git commit -m "a; npm run check; supabase db push\nzweite Zeile --no-verify"',
    'grep "x; supabase db push" docs/a.md',
    'git config core.hooksPath',
    'git config --get core.hooksPath',
    'supabase db query "select count(*) from public.x" --linked',
    'New-Item -ItemType Directory tmp/proof/u1',
    'grep -c vitest package.json',
    'npx supabase migration list',
    'cp tmp/proof/u1/001-check.log docs/proof/u1/001-check.log',
    'ls tmp/proof/u1',
    'echo ok > tmp/out.txt',
  ])('%s', (c) => {
    const r = bash(c)
    expect(r.exit).toBe(0)
    expect(r.stderr).toBe('')
  })
  it('Dateien außerhalb der Sperrlisten', () => {
    for (const p of ['/p/src/lib/x.ts', '/p/tmp/proof/u1-plan.md', '/p/docs/PROGRESS.md', '/p/tmp/proof/u1/probe.md', '/p/scripts/sys/fixtures/db/ok/db-freigabe-1.md']) expect(datei(p).exit, p).toBe(0)
  })
  it('Eingabe ohne tool_input wird nicht verweigert', () => {
    expect(guard({ tool_name: 'Read' }).exit).toBe(0)
    expect(guard({}).exit).toBe(0)
  })
})

describe('u1b M17: SQL und Befehle per Pipe', () => {
  it.each([
    'echo "delete from public.x" | psql',
    'echo "select 1" | psql -h x',
    'psql -c "select 1"',
    'dotenv -e .env.local -- psql',
    'Get-Content tmp/x.sql | supabase db query --linked',
    'cat tmp/x.sql | npx supabase db query --linked',
    'supabase db query --linked < tmp/x.sql',
    'supabase db query "$(cat tmp/x.sql)" --linked',
    'echo "supabase db push" | bash',
    '"npm run check" | powershell',
    'echo x | iex',
    'echo x | node',
  ])('verweigert (Bash): %s', (c) => {
    expect(bash(c).exit).toBe(2)
  })
  it.each(['Get-Content tmp/x.sql | psql', 'Get-Content tmp/x.sql | supabase db query --linked', '"npm run check" | Invoke-Expression'])('verweigert (PowerShell): %s', (c) => {
    expect(bash(c, 'PowerShell').exit).toBe(2)
  })
  it.each([
    'supabase db query "select public.admin_set_partner_status(1)" --linked',
    'supabase db query "do $$ begin null; end $$" --linked',
    'supabase db query "select set_config(1)" --linked',
    'supabase db query "merge into x using y" --linked',
    'supabase storage rm x',
    'supabase functions delete foo',
    'supabase db query --db-url x "select 1"',
  ])('Statusfunktionen und weitere schreibende Wege: %s', (c) => {
    expect(bash(c).exit).toBe(2)
  })
  it.each([
    'grep -n psql docs/BEKS_EINRICHTUNG.md',
    'echo "psql delete from x"',
    'cat docs/a.md | grep delete',
    'grep -rn "delete from" tests/support',
    'git commit -m "psql und delete from erwähnt"',
    'Get-Content docs/PROGRESS.md | Select-String psql',
    'supabase db query "select 1 where 2 < 3" --linked',
    'cat a.json | node scripts/sys/x.mjs',
  ])('Gegenprobe, kein Falschalarm: %s', (c) => {
    expect(bash(c).exit).toBe(0)
  })
})

describe('u1b M18: verschachtelte Shells', () => {
  it.each([
    'bash -c "npm run check"',
    "sh -c 'npx vitest run'",
    'bash -lc "npm run check"',
    'bash.exe -c "npm run check"',
    'powershell -Command "npm run check"',
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "npm run test:rls"',
    'pwsh -c "vitest run"',
    'cmd /c npm run check',
    'cmd /c "npm run test:e2e"',
    'cmd /d /s /c "echo a & npm run check"',
    'C:\\Windows\\System32\\cmd.exe /c npm run check',
    'bash -c "supabase db push"',
    'sh -c "echo x | psql"',
    'powershell -Command "supabase db query \\"delete from x\\" --linked"',
    'bash -c "bash -c \\"npm run check\\""',
    'powershell -EncodedCommand bnBtIHJ1biBjaGVjaw==',
    'eval npm run check',
    'iex "npm run check"',
    'Invoke-Expression "supabase db push"',
  ])('verweigert: %s', (c) => {
    expect(bash(c).exit).toBe(2)
  })
  it('auch im PowerShell-Werkzeug', () => {
    expect(bash('powershell -Command "npm run check"', 'PowerShell').exit).toBe(2)
    expect(bash('cmd /c npm run check', 'PowerShell').exit).toBe(2)
  })
  it.each(['sleep 1 & npm run check', 'if true; then npm run check; fi', '(npm run check)', 'node_modules/.bin/vitest run', 'npm run-script check', 'npm.cmd run check', 'node -p "1"', 'deno eval "1"'])('weitere Schreibweisen: %s', (c) => {
    expect(bash(c).exit).toBe(2)
  })
  it('zu tiefe Verschachtelung wird verweigert', () => {
    let c = 'ls'
    for (let i = 0; i < 7; i++) c = `bash -c "${c.replace(/(["\\])/g, '\\$1')}"`
    expect(bash(c).exit).toBe(2)
  })
  it.each(['bash -c "ls"', 'sh -c "echo hallo"', 'powershell -Command "Get-ChildItem"', 'cmd /c dir'])('Gegenprobe, kein Falschalarm: %s', (c) => {
    expect(bash(c).exit).toBe(0)
  })
  it('Skriptdateien: der Inhalt wird mitgeprüft, nicht lesbar heißt verweigert', () => {
    const dir = mkdtempSync(join(tmpdir(), 'guard-skript-'))
    writeFileSync(join(dir, 'schlecht.sh'), 'echo a\nnpm run check\n')
    writeFileSync(join(dir, 'schlecht.ps1'), 'supabase db push --linked\n')
    writeFileSync(join(dir, 'gut.sh'), 'echo hallo\n')
    for (const c of ['bash schlecht.sh', './schlecht.sh', '. schlecht.sh', 'source schlecht.sh', 'pwsh -File schlecht.ps1', '.\\schlecht.ps1', 'cmd /c schlecht.ps1', 'bash fehlt.sh']) expect(bash(c, 'Bash', dir).exit, c).toBe(2)
    expect(bash('bash gut.sh', 'Bash', dir).exit).toBe(0)
  })
  it('Skriptdateien mit Optionswerten, Hüllen, Leerzeichen im Pfad und ohne Endung (Abnahme AM1)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'guard-skript2-'))
    mkdirSync(join(dir, 'mit leer'))
    writeFileSync(join(dir, 'schlecht.ps1'), 'supabase db push --linked\n')
    writeFileSync(join(dir, 'schlecht.sh'), 'npm run check\n')
    writeFileSync(join(dir, 'schlecht.bat'), 'npm run check\n')
    writeFileSync(join(dir, 'schlecht'), 'npm run check\n')
    writeFileSync(join(dir, 'mit leer', 'x.ps1'), 'npm run check\n')
    for (const c of [
      'powershell -NoProfile -ExecutionPolicy Bypass -File schlecht.ps1',
      'pwsh -NoLogo -File schlecht.ps1',
      'npx dotenv -e .env.local -- bash schlecht.sh',
      'FOO=1 bash schlecht.sh',
      'time ./schlecht.sh',
      '& "mit leer\\x.ps1"',
      'cmd /c call schlecht.bat',
      'bash schlecht',
    ]) expect(bash(c, 'Bash', dir).exit, c).toBe(2)
  })
})

describe('u1b Abnahme AM2/AM3/AM4: weitere Schreibweisen', () => {
  it.each([
    'supabase db query --linked (Get-Content tmp/x.sql -Raw)',
    'supabase db query --linked @tmp/x.sql',
    'cat x.sql | xargs supabase db query --linked',
    'supabase db query wort --linked',
    'supabase db query "select 1" "select 2" --linked',
  ])('db query ohne wörtliches select wird verweigert: %s', (c) => {
    expect(bash(c).exit).toBe(2)
  })
  it.each([
    'supabase db query "select 1" --linked -o json',
    'supabase db query --linked -o json "select count(*) from public.x"',
    'supabase db query "select 1" --linked && git commit -m "update und set erwähnt"',
    'echo supabase db query',
  ])('Gegenprobe, kein Falschalarm: %s', (c) => {
    expect(bash(c).exit).toBe(0)
  })
  it.each([
    'node --env-file .env.local scripts/storage-reset.mjs',
    'node -r dotenv/config scripts/storage-reset.mjs',
    'node "scripts/storage-reset.mjs"',
    "node 'scripts/admin-call.mjs'",
  ])('Registerskript mit Optionswert oder Anführungszeichen: %s', (c) => {
    expect(bash(c).exit).toBe(2)
  })
  it('Pfade werden aufgelöst und ohne Beachtung der Schreibweise verglichen (Windows)', () => {
    for (const p of ['C:\\p\\TMP\\Proof\\u1b-abnahme.md', 'C:\\p\\Docs\\Freigaben\\x.md', 'C:\\p\\tmp\\.\\proof\\u1\\runs.jsonl', 'C:\\p\\tmp\\proof\\x\\..\\u1\\Loesch-Lauf.jsonl', 'C:\\p\\.GIT\\config']) {
      expect(datei(p).exit, p).toBe(2)
    }
  })
})

describe('u1b Lösch-Gate im Guard', () => {
  it.each([
    'node scripts/storage-reset.mjs',
    'npx dotenv -e .env.local -- node scripts/admin-call.mjs',
    'node SCRIPTS/Storage-Reset.mjs',
    'cd scripts && node storage-reset.mjs',
    'node ./scripts/live-test.mjs',
    'node --max-old-space-size=4096 scripts/live-test.mjs --x',
    'node scripts/live-test.mjs tests/support/sweep.ts',
    'dotenv -e .env.local -- node scripts/redproof-s9a4.mjs',
    'npm run admin:call',
    'npm run setup:photo-cleanup',
  ])('Registerskript am Gate vorbei: %s', (c) => {
    const r = bash(c)
    expect(r.exit).toBe(2)
    expect(r.stderr).toMatch(/npm run loesch/)
  })
  it.each([
    'supabase db query "delete from public.x" --linked',
    'echo "delete from public.x" | psql',
    'bash -c "supabase db query \\"delete from public.x\\" --linked"',
  ])('direktes DELETE am Gate vorbei: %s', (c) => {
    expect(bash(c).exit).toBe(2)
  })
  it.each([
    'cp foo docs/freigaben/x.md',
    'echo x > docs/freigaben/x.md',
    'cp -t docs/freigaben x',
    'git mv a docs/freigaben/b',
    'Copy-Item a -Destination docs/freigaben/b',
    'cat a > docs/freigaben/b',
    'rm docs/freigaben/u1b-loesch-freigabe-1.md',
    'cp x "docs/freigaben/y.md"',
    "Copy-Item a 'docs/freigaben/b'",
    'echo x > "docs/freigaben/y.md"',
    'cp foo tmp/proof/u1b/loesch-freigabe-1.md',
    'cp foo tmp/proof/u1b/loesch-lauf.jsonl',
    'echo x > tmp/proof/u1b/loesch-lauf.jsonl',
  ])('Freigaben und Lauf-Log fälschen: %s', (c) => {
    expect(bash(c).exit).toBe(2)
  })
  it('Write und Edit auf docs/freigaben immer verweigert, loesch-freigabe in tmp/proof nur von advisor-report, loesch-lauf nie', () => {
    for (const a of [undefined, 'advisor-report']) expect(datei('/p/docs/freigaben/u1b-loesch-freigabe-1.md', a).exit).toBe(2)
    expect(datei('/p/tmp/proof/u1b/loesch-freigabe-1.md').exit).toBe(2)
    expect(datei('/p/tmp/proof/u1b/loesch-freigabe-1.md', 'advisor-report').exit).toBe(0)
    for (const a of [undefined, 'advisor-report']) expect(datei('/p/tmp/proof/u1b/loesch-lauf.jsonl', a).exit).toBe(2)
  })
  it.each([
    'npm run loesch -- scripts/storage-reset.mjs',
    'npm run loesch -- uebernehme tmp/proof/u1b/loesch-freigabe-1.md',
    'npm run t -- cmd node scripts/sys/gate-loesch.mjs --trocken --register a.json --freigaben b scripts/storage-reset.mjs',
    'node scripts/sys/gate-loesch.mjs --trocken',
    'ls docs/freigaben',
    'cat docs/freigaben/u1b-loesch-freigabe-1.md',
    'git add docs/freigaben/u1b-loesch-freigabe-1.md',
    'git commit -m "docs/freigaben u1b"',
    'echo "docs/freigaben"',
    'npm run t -- cmd node scripts/sys/fixtures/guard-probe.mjs verweigert Bash "cp x docs/freigaben/y.md" "echo x > docs/freigaben/y.md"',
    'node tmp/scan.mjs',
    'node tmp/hash.mjs docs/freigaben/u1b-loesch-freigabe-1.md',
    'node tmp/hash.mjs tests/support/sweep.ts scripts/storage-reset.mjs',
    'node --max-old-space-size=4096 tmp/hash.mjs scripts/storage-reset.mjs',
  ])('erlaubt: %s', (c) => {
    expect(bash(c).exit).toBe(0)
  })
  it('MCP-Datenbankwerkzeuge werden verweigert, andere MCP-Werkzeuge nicht', () => {
    expect(guard({ tool_name: 'mcp__abc__execute_sql', tool_input: { query: 'select 1' } }).exit).toBe(2)
    expect(guard({ tool_name: 'mcp__abc__apply_migration', tool_input: {} }).exit).toBe(2)
    expect(guard({ tool_name: 'mcp__Claude_Browser__navigate', tool_input: { url: 'x' } }).exit).toBe(0)
  })
})

describe('u1b Abnahme Runde 2: Befehlsersetzung, Umleitungen, Skriptpfade', () => {
  it.each([
    'x=$(supabase db query "delete from public.x" --linked)',
    'out=$(npm run check 2>&1)',
    'x=$(psql -c "select 1")',
    'export X=$(supabase db push)',
    'local x=$(npx vitest run)',
    'echo $(supabase db query "delete from public.x" --linked)',
    'echo `npm run check`',
    'echo "$(npm run check)"',
    'node --no-warnings node_modules/supabase/dist/supabase.js db query "delete from x" --linked',
    'supabase db query --linked -ftmp/x.sql',
    'node --import ./tmp/x.mjs scripts/storage-reset.mjs',
    'node -r ./tmp/x.js scripts/storage-reset.mjs',
    '& "C:\\Program Files\\Git\\bin\\bash.exe" -c "npm run check"',
  ])('verweigert: %s', (c) => {
    expect(bash(c).exit).toBe(2)
  })
  it.each([
    'x=$(git rev-parse HEAD)',
    'FOO=1 npm run build',
    'x=$(supabase db query "select 1" --linked)',
    'supabase db query "select 1" --linked 2>&1',
    'supabase db query "select 1" --linked 2>&1 | tail -5',
    'supabase db query "select 1" --linked > tmp/out.json',
    'echo $(git rev-parse HEAD)',
    'echo "a (b) c"',
    'git commit -m "$(cat <<\'EOF\'\nu1b: npm run check psql\nnode scripts/storage-reset.mjs (Beispiel)\nx=$(supabase db push) im Text\nEOF\n)"',
    'cp tmp/proof/u1b/001-x.log docs/proof/u1b/001-x.log',
    'mv a.txt b.txt',
    'bash -c "echo $(date)"',
  ])('Gegenprobe, kein Falschalarm: %s', (c) => {
    expect(bash(c).exit).toBe(0)
  })
  it.each([
    'cd tmp/proof/u1b && mv entwurf.md loesch-freigabe-2.md',
    'Rename-Item tmp/proof/u1b/entwurf.md loesch-freigabe-2.md',
    'cp x tmp/proof/u1b/Loesch-Freigabe-2.md',
    'Copy-Item x -Destination tmp/proof/u1b/loesch-freigabe-2.md -Force',
    'git mv x tmp/proof/u1b-abnahme.md',
  ])('Berater-Dateien per Umbenennen, -Destination oder in anderer Schreibweise: %s', (c) => {
    expect(bash(c).exit).toBe(2)
  })
  it('Skriptdateien: harmlose in denselben Formen gehen durch, absolute Pfade ohne Endung und Pfade mit Leerzeichen in Hüllen werden gelesen', () => {
    const dir = mkdtempSync(join(tmpdir(), 'guard-skript3-'))
    mkdirSync(join(dir, 'mit leer'))
    writeFileSync(join(dir, 'gut.ps1'), 'echo hallo\n')
    writeFileSync(join(dir, 'gut'), 'echo hallo\n')
    writeFileSync(join(dir, 'gut.bat'), 'echo hallo\n')
    writeFileSync(join(dir, 'mit leer', 'gut.ps1'), 'echo hallo\n')
    writeFileSync(join(dir, 'mit leer', 'schlecht.ps1'), 'npm run check\n')
    writeFileSync(join(dir, 'schlecht'), 'npm run check\n')
    for (const c of ['powershell -NoProfile -ExecutionPolicy Bypass -File gut.ps1', '& "mit leer\\gut.ps1"', 'bash gut', 'cmd /c call gut.bat']) expect(bash(c, 'Bash', dir).exit, c).toBe(0)
    for (const c of [`bash ${join(dir, 'schlecht').replace(/\\/g, '/')}`, `source ${join(dir, 'schlecht').replace(/\\/g, '/')}`, `powershell -Command "& 'mit leer\\schlecht.ps1'"`, 'cmd /c "mit leer\\schlecht.ps1"']) {
      expect(bash(c, 'Bash', dir).exit, c).toBe(2)
    }
  })
})

describe('u1b Abnahme Runde 3: Abtaster für Befehlsersetzungen (AM9, AN22, AN23, AN25)', () => {
  it.each([
    'OUT="$(supabase db query "insert into public.x (a) values (now())" --linked)"',
    'OUT="$(supabase db query "update public.x set a = 1 where id = 2; select 1" --linked)"',
    'OUT="$(supabase db query "update public.x set a = 1;\nselect 1" --linked)"',
    'echo $(supabase db query "delete from public.x where id = (select max(id) from public.y)" --linked)',
    'OUT="$(npm run check 2>&1 | grep -E "FAIL|Error")"',
    'OUT="$(psql -c "select 1; delete from public.x")"',
    'OUT="$(supabase db query "delete from public.x" --linked)"',
    'echo "$(npm run check)"',
    'echo "a $(echo "b $(npm run check)")"',
    'x=$(npm run check',
    'FOO=$(pwd) npm run check',
    'FOO=$(cat tmp/wert) supabase db query "delete from public.x" --linked',
    'FOO=$(cat tmp/wert) psql -c "select 1"',
    'node --import=./tmp/x.mjs scripts/storage-reset.mjs',
    'node --import ./scripts/storage-reset.mjs tmp/x.mjs',
  ])('verweigert: %s', (c) => {
    expect(bash(c).exit).toBe(2)
  })
  it.each([
    'OUT="$(supabase db query "select count(*) from public.x where a = coalesce(b, lower(c))" --linked)"',
    'OUT="$(git log --format="%h;%s" -1)"',
    'FOO=$(pwd) npm run build',
    'x="a b"',
    'export X=1',
    'git commit -m "update (a) und $(date)"',
    'echo "kosten: $(( 1 + 2 ))"',
    'x=$(( 1 + 2 ))',
    'echo \\$(npm run check)',
    "git commit -m \"$(cat <<'EOF'\nu1b: Guard (Rest (AM9)) sperrt\n1) supabase db push in `Backticks`\nund `npm run check`\nEOF\n)\"",
  ])('Gegenprobe, kein Falschalarm: %s', (c) => {
    expect(bash(c).exit).toBe(0)
  })
})

describe('Wächter-Hook guard.mjs: Absturz sperrt selbst', () => {
  it.each([
    ['leere Eingabe', ''],
    ['kaputtes JSON', '{nicht json'],
  ])('%s → Exit 2 mit „Guard-Fehler“', (_n, roh) => {
    const r = guard(null, roh)
    expect(r.exit).toBe(2)
    expect(r.stderr).toMatch(/Guard-Fehler/)
  })
})
