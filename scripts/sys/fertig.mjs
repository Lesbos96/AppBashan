// Merge-Gate: `npm run fertig` prüft, dann ff-Merge nach main und Push. `--nur-pruefen`: nur prüfen. `--pre-push`: Git-Hook, prüft Pushes auf main.
// Liest immer den festen Ordner tmp/proof (nie PROOF_ROOT) und gruen.json nur aus origin/main (nie aus dem Arbeitsbaum).
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fingerabdruck, KANON, SUITEN } from './fingerabdruck.mjs'
import { parseFreigabe, pruefePush } from './gate-db-lib.mjs'
import { git, hooksAktiv, leseRuns, PROOF_ROOT, sauber, schrittName, sha256, sha256Datei } from './lib.mjs'
import { stufeAus } from './stufe.mjs'

const PFLICHT = { R0: [], R1: ['check', 'e2e'], R2: ['check', 'e2e', 'rls'], R3: ['check', 'e2e', 'rls'] }

// Reine Prüfung. Liefert die Liste der Gründe (leer = grün).
// c: { stufe, sauber, ffMoeglich, hooksAktiv, runs, dbPushes, abdruck, gruen, neueMigrationen, freigaben, abnahme, abnahmeVeraltet, neueRlsTests, berichtStand, standZeilen, schrittPruefen }
// runs: { nr, ziel, args, befehl, exit, sauber, stabil, start, abdruck, logOk }
// Gültiger Nachweis der ganzen Suite s oder null.
export function gueltigerLauf(c, s) {
  const spaetestePush = (c.dbPushes ?? []).reduce((m, x) => (x > m ? x : m), '')
  return (
    c.runs.find(
      (r) => r.ziel === s && (r.args ?? []).length === 0 && r.befehl === KANON[s] && r.exit === 0 && r.sauber && r.stabil !== false && r.logOk && r.abdruck === c.abdruck[s] && (s !== 'rls' || (r.start ?? '') > spaetestePush),
    ) ?? null
  )
}

export function pruefeFertig(c) {
  const g = []
  if (!c.sauber) g.push('Arbeitsbaum nicht sauber')
  if (c.hooksAktiv === false) g.push('core.hooksPath ist nicht .githooks (npm run prepare), der pre-push-Hook wäre wirkungslos')
  if (c.ffMoeglich === false) g.push('main ist kein Vorfahr des Branches oder main weicht von origin/main ab (kein ff-Merge möglich)')
  for (const s of PFLICHT[c.stufe] ?? PFLICHT.R3) {
    if (!gueltigerLauf(c, s) && c.gruen?.[s]?.abdruck !== c.abdruck[s]) {
      g.push(`${s}: kein grüner Lauf (kanonischer Befehl ohne Zusatzargumente, EXIT=0, sauber, Log unverändert${s === 'rls' ? ', nach dem letzten db-push' : ''}) für den aktuellen Fingerabdruck`)
    }
  }
  if (c.schrittPruefen) {
    if (c.stufe === 'R3') {
      g.push(...pruefePush(c.neueMigrationen, c.freigaben).gruende)
      if (!c.abnahme) g.push('R3: Abnahme-Datei fehlt')
      else {
        if (!c.abnahme.modell.toLowerCase().includes('fable')) g.push('R3: Abnahme nicht von Fable')
        if (c.abnahme.hoch !== 0) g.push('R3: Abnahme ohne genau eine Zeile „Offene Findings hoch: 0“')
        if (c.abnahme.dateien.length === 0) g.push('R3: Abnahme nennt keine geprüfte Datei (SHA256-Zeilen)')
        for (const p of c.abnahmeVeraltet ?? []) g.push(`R3: ${p} hat sich seit der Abnahme geändert`)
      }
      for (const t of c.neueRlsTests) {
        const lauf = c.runs.filter((r) => r.ziel === t && r.logOk).sort((a, b) => a.nr - b.nr)
        const ersterGruen = lauf.find((r) => r.exit === 0)
        if (!ersterGruen || !lauf.some((r) => r.exit !== 0 && r.nr < ersterGruen.nr)) g.push(`R3: ${t}: kein roter Lauf vor dem ersten grünen`)
      }
    }
    if (c.berichtStand !== c.abdruck.check) g.push('bericht.json fehlt oder ist nicht aktuell (npm run bericht)')
  }
  if (c.standZeilen !== null && c.standZeilen > 40) g.push('docs/STAND.md hat mehr als 40 Zeilen')
  return g
}

// Läufe lesen und gegen die Logdatei prüfen: Hash, Kopf (Commit, Befehl, Sauber-Angabe), Schlusszeile EXIT.
export function leseGepruefteRuns() {
  const alle = leseRuns()
  const runs = alle.filter((r) => r.ziel !== 'db-push' && r.nr).map((r) => {
    const marke = r.ziel === 'cmd' ? 'cmd' : String(r.ziel).replace(/[\\/]/g, '_')
    const log = join(PROOF_ROOT, r.schritt, `${String(r.nr).padStart(3, '0')}-${marke}.log`)
    let logOk = false
    try {
      if (existsSync(log) && sha256Datei(log) === r.logSha) {
        const text = readFileSync(log, 'utf8')
        const kopf = text.split('\n').slice(0, 3)
        logOk =
          kopf[0] === `Commit: ${r.hash}` &&
          kopf[1] === `Arbeitsbaum sauber: ${r.sauber ? 'ja' : 'nein'}` &&
          kopf[2] === `Befehl: ${r.befehl}` &&
          new RegExp(`\\nEXIT=${r.exit}\\s*$`).test(text)
      }
    } catch {
      logOk = false
    }
    return { ...r, logOk }
  })
  return { runs, dbPushes: alle.filter((r) => r.ziel === 'db-push').map((r) => r.start) }
}

const lies = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null)
const ausOrigin = (p) => {
  try {
    return git('show', `origin/main:${p}`)
  } catch {
    return null
  }
}

export function sammle({ von, bis = 'HEAD', schritt, schrittPruefen }) {
  const bereich = `${von}...${bis}`
  const pfade = git('diff', '--no-renames', '--name-only', bereich).split('\n').filter(Boolean)
  const neue = (ordner) => git('diff', '--no-renames', '--name-only', '--diff-filter=A', bereich, '--', ordner).split('\n').filter(Boolean)
  const stand = lies('docs/STAND.md')
  const ordner = join(PROOF_ROOT, schritt)
  const bericht = lies(join('docs', 'proof', schritt, 'bericht.json'))
  const abnahmeText = lies(join(PROOF_ROOT, `${schritt}-abnahme.md`))
  const abnahme = abnahmeText === null ? null : parseFreigabe(abnahmeText)
  const { runs, dbPushes } = leseGepruefteRuns()
  return {
    stufe: stufeAus(pfade),
    sauber: sauber(),
    runs,
    dbPushes,
    abdruck: Object.fromEntries(SUITEN.map((s) => [s, fingerabdruck(s)])),
    gruen: JSON.parse(ausOrigin('docs/proof/gruen.json') ?? '{}'),
    neueMigrationen: neue('supabase/migrations').map((pfad) => ({ pfad, sha256: sha256Datei(pfad) })),
    freigaben: existsSync(ordner) ? readdirSync(ordner).filter((f) => /^db-freigabe-.*\.md$/.test(f)).map((f) => parseFreigabe(readFileSync(join(ordner, f), 'utf8'))) : [],
    abnahme,
    abnahmeVeraltet: (abnahme?.dateien ?? []).filter((d) => !existsSync(d.pfad) || sha256Datei(d.pfad) !== d.sha).map((d) => d.pfad),
    neueRlsTests: neue('tests/rls').filter((f) => f.endsWith('.test.ts')),
    berichtStand: bericht ? JSON.parse(bericht).stand : null,
    standZeilen: stand === null ? null : stand.split(/\r?\n/).length,
    schrittPruefen,
  }
}

// Schritt eines Berichts, dessen Stand dem aktuellen Code entspricht (nach dem Merge heißt der Branch main).
export function schrittAusBericht(checkAbdruck) {
  const wurzel = join('docs', 'proof')
  if (!existsSync(wurzel)) return null
  return (
    readdirSync(wurzel, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(wurzel, d.name, 'bericht.json')))
      .find((d) => JSON.parse(readFileSync(join(wurzel, d.name, 'bericht.json'), 'utf8')).stand === checkAbdruck)?.name ?? null
  )
}

function meldeUndEnde(gruende, modus) {
  if (gruende.length) {
    console.error(`FERTIG BLOCKIERT (${modus}):\n- ${gruende.join('\n- ')}`)
    process.exit(1)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  if (args.includes('--pre-push')) {
    const zeilen = readFileSync(0, 'utf8').split('\n').filter(Boolean).map((z) => z.split(' '))
    const aufMain = zeilen.filter(([, , remoteRef]) => remoteRef === 'refs/heads/main')
    if (aufMain.length === 0) process.exit(0)
    const [, lokal, , remote] = aufMain[0]
    if (lokal !== git('rev-parse', 'HEAD')) meldeUndEnde(['auf main darf nur HEAD gepusht werden (der Fingerabdruck gilt für den ausgecheckten Stand)'], 'pre-push')
    const von = /^0+$/.test(remote) ? git('rev-list', '--max-parents=0', 'HEAD').split('\n')[0] : remote
    const schritt = schrittAusBericht(fingerabdruck('check'))
    if (!schritt) meldeUndEnde(['kein docs/proof/<schritt>/bericht.json mit stand = aktuellem Code-Stand (fail-closed)'], 'pre-push')
    meldeUndEnde(pruefeFertig({ ...sammle({ von, schritt, schrittPruefen: true }), hooksAktiv: hooksAktiv() }), 'pre-push')
    process.exit(0)
  }
  if (git('branch', '--show-current') === 'main') {
    console.error('Auf main nicht aufrufbar: erst auf den Schritt-Branch wechseln.')
    process.exit(2)
  }
  git('fetch')
  const ctx = sammle({ von: 'origin/main', schritt: schrittName(), schrittPruefen: true })
  ctx.hooksAktiv = hooksAktiv()
  ctx.ffMoeglich = (() => {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', 'main', 'HEAD'], { stdio: 'ignore' })
    } catch {
      return false
    }
    return git('rev-parse', 'main') === git('rev-parse', 'origin/main')
  })()
  meldeUndEnde(pruefeFertig(ctx), 'merge')
  console.log(`FERTIG: Gate bestanden (Stufe ${ctx.stufe}, Code-Stand ${sha256(ctx.abdruck.check).slice(0, 12)})`)
  if (!args.includes('--nur-pruefen')) {
    const branch = git('branch', '--show-current')
    git('checkout', 'main')
    git('merge', '--ff-only', branch)
    console.log(execFileSync('git', ['push'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) || 'push ok')
  }
}
