// Redeploy der Function `quote` für redproof-s9a3 Teil 2 (H-B, M-B): der Arbeitsbaum wird nie verändert.
// Die Kopie entsteht nur aus `git show <Commit>:<Pfad>` (nie aus Dateien des Arbeitsbaums, `.env` bleibt außen vor), liegt außerhalb des
// Repositories (die CLI sucht sonst aufwärts nach supabase/), enthält supabase/config.toml (verify_jwt) und kein supabase/.temp.
// Deploy und Download laufen mit cwd = Kopie bzw. leerem Verzeichnis, --project-ref = DEV_REF und SUPABASE_PROJECT_ID = DEV_REF.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { DEV_REF } from './dev-ref.mjs'

export const FUNCTION = 'quote'
const PATHS = ['supabase/functions', 'supabase/config.toml']
const lf = (b) => Buffer.from(b).toString('utf8').replace(/\r/g, '')
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))

export function realDeployDeps(repoRoot = process.cwd()) {
  const sb = resolve(repoRoot, 'node_modules/supabase/dist/supabase.js')
  return {
    repoRoot: resolve(repoRoot), tmpRoot: tmpdir(), sb,
    run: (args, { cwd }) => execFileSync(process.execPath, [sb, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, SUPABASE_PROJECT_ID: DEV_REF }, maxBuffer: 1 << 26 }),
    gitList: (commit) => execFileSync('git', ['ls-tree', '-r', '--name-only', commit, '--', ...PATHS], { cwd: repoRoot, encoding: 'utf8' }).trim().split('\n').filter(Boolean),
    gitShow: (commit, path) => execFileSync('git', ['show', `${commit}:${path}`], { cwd: repoRoot, maxBuffer: 1 << 26 }),
    mkdtemp: (prefix) => mkdtempSync(join(tmpdir(), prefix)),
    write: (p, buf) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, buf) },
    read: (p) => readFileSync(p), exists: existsSync, list: walk, rm: (p) => rmSync(p, { recursive: true, force: true }),
  }
}

export function createDeployer(d) {
  const outside = (dir) => { const rel = relative(d.repoRoot, resolve(dir)); return rel.startsWith('..') || isAbsolute(rel) }
  const assertOutsideRepo = (dir) => { if (!outside(dir)) throw new Error(`Verzeichnis liegt im Repository: ${dir}`) }
  const cmdArgs = (extra) => [...extra, '--project-ref', DEV_REF]
  return {
    /** Kopie von Commit `commit` (supabase/functions und supabase/config.toml), optional mit einer Textänderung. */
    exportCommit(commit, edit) {
      const dir = d.mkdtemp(edit ? 'redproof-gelockert-' : 'redproof-sauber-')
      assertOutsideRepo(dir)
      for (const p of d.gitList(commit)) {
        let buf = d.gitShow(commit, p)
        if (edit && p === edit.file) {
          const text = Buffer.from(buf).toString('utf8')
          if (!text.includes(edit.from)) throw new Error(`Muster nicht gefunden: ${edit.from}`)
          buf = Buffer.from(text.replace(edit.from, edit.to))
        }
        d.write(join(dir, p), buf)
      }
      if (!d.exists(join(dir, 'supabase/config.toml'))) throw new Error('config.toml fehlt in der Kopie')
      if (d.exists(join(dir, 'supabase/.temp'))) throw new Error('supabase/.temp liegt in der Kopie')
      return dir
    },
    deploy(dir) {
      assertOutsideRepo(dir)
      if (d.exists(join(dir, 'supabase/.temp'))) throw new Error('supabase/.temp liegt in der Kopie')
      return d.run(cmdArgs(['functions', 'deploy', FUNCTION, '--use-api']), { cwd: dir })
    },
    /** Quelltext von Dev in ein leeres Verzeichnis außerhalb des Repositories laden. */
    download() {
      const dir = d.mkdtemp('redproof-dl-')
      assertOutsideRepo(dir)
      d.run(cmdArgs(['functions', 'download', FUNCTION, '--use-api']), { cwd: dir })
      return dir
    },
    /** Gleicht die von Dev geladenen Dateien (ohne CR-Unterschiede) mit Commit `commit` ab: { same, diff }. */
    matches(commit) {
      const dir = this.download()
      try {
        const root = join(dir, 'supabase/functions')
        const diff = []
        const files = d.list(root).map((p) => relative(root, p).replaceAll('\\', '/'))
        for (const f of files) {
          let head
          try { head = d.gitShow(commit, `supabase/functions/${f}`) } catch { diff.push(`${f}: nicht in ${commit}`); continue }
          if (lf(head) !== lf(d.read(join(root, f)))) diff.push(`${f}: abweichend`)
        }
        if (files.length === 0) diff.push('keine Dateien geladen')
        return { same: diff.length === 0, diff, files: files.length }
      } finally { d.rm(dir) }
    },
    info() {
      const dir = d.mkdtemp('redproof-ls-')
      try { return d.run(cmdArgs(['functions', 'list']), { cwd: dir }) } finally { d.rm(dir) }
    },
    remove: (dir) => d.rm(dir),
  }
}
