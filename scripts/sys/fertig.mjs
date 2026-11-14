// Merge-Gate: `npm run fertig` prüft, dann ff-Merge nach main und Push. `--nur-pruefen`: nur prüfen. `--pre-push`: Git-Hook, prüft Pushes auf main.
// Liest immer den festen Ordner tmp/proof (nie PROOF_ROOT), gruen.json nur aus origin/main und den Bericht nur aus dem Commit (nie aus dem Arbeitsbaum).
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fingerabdruck, KANON, SUITEN } from './fingerabdruck.mjs'
import { parseFreigabe, pruefePush } from './gate-db-lib.mjs'
import { freigabenAusGit, leseRegister } from './gate-loesch-lib.mjs'
import { git, hooksAktiv, leseRuns, PROOF_ROOT, sauber, schrittName, sha256, sha256Datei } from './lib.mjs'
import { stufeAus } from './stufe.mjs'

const PFLICHT = { R0: [], R1: ['check', 'e2e'], R2: ['check', 'e2e', 'rls'], R3: ['check', 'e2e', 'rls'] }
// Diese geänderten Pfade muss die Abnahme mit einer SHA256-Zeile nennen (Mindestmenge für R3).
export const MUSS_ABNAHME = /^(supabase\/functions\/|src\/lib\/money|scripts\/sys\/[^/]+\.mjs$|scripts\/sys\/loesch-register\.json$|tests\/support\/|docs\/freigaben\/|\.claude\/hooks\/|\.claude\/agents\/|\.claude\/settings\.json$|\.githooks\/|package\.json$)/
// Bei R3 ist ein übernommener rls-Lauf (gruen.json) nur dann gültig, wenn er höchstens so alt ist.
const RLS_MAX_ALTER_MS = 7 * 24 * 3600 * 1000

const spaetestePush = (c) => (c.dbPushes ?? []).reduce((m, p) => (p.start > m ? p.start : m), '')
// Zeitpunkt höchstens 7 Tage vor `c.jetzt` und nicht in der Zukunft; fehlendes `jetzt`, fehlende oder unlesbare Zeit gelten als abgelaufen (fail closed).
const frisch = (zeit, c) => {
  const alter = c.jetzt - Date.parse(zeit)
  return alter >= 0 && alter <= RLS_MAX_ALTER_MS
}

// Gültiger Nachweis der ganzen Suite s oder null. Bei R3 zählt ein rls-Lauf nur, wenn er höchstens 7 Tage alt ist (auch ein Lauf eines früheren Schritts).
export function gueltigerLauf(c, s) {
  const push = spaetestePush(c)
  return (
    c.runs.find(
      (r) =>
        r.ziel === s && (r.args ?? []).length === 0 && r.befehl === KANON[s] && r.exit === 0 && r.sauber && r.stabil !== false && r.logOk && r.abdruck === c.abdruck[s] &&
        (s !== 'rls' || ((r.start ?? '') > push && (c.stufe !== 'R3' || frisch(r.start, c)))),
    ) ?? null
  )
}

// Reine Prüfung. Liefert die Liste der Gründe (leer = grün).
// c: { stufe, sauber, ffMoeglich, hooksAktiv, runs, dbPushes: [{start, migrationen}], abdruck, gruen, neueMigrationen, freigaben, abnahme, abnahmeVeraltet, abnahmeFehlt, neueRlsTests,
//      berichtStand, berichtGate, standZeilen, schrittPruefen, ohneBericht }
// runs: { nr, ziel, args, befehl, exit, sauber, stabil, start, abdruck, logOk }
export function pruefeFertig(c) {
  const g = []
  if (!c.sauber) g.push('Arbeitsbaum nicht sauber')
  if (c.hooksAktiv === false) g.push('core.hooksPath ist nicht .githooks (npm run prepare), der pre-push-Hook wäre wirkungslos')
  if (c.ffMoeglich === false) g.push('main ist kein Vorfahr des Branches oder main weicht von origin/main ab (kein ff-Merge möglich)')
  for (const s of PFLICHT[c.stufe] ?? PFLICHT.R3) {
    if (gueltigerLauf(c, s)) continue
    if (c.gruen?.[s]?.abdruck !== c.abdruck[s]) {
      g.push(`${s}: kein grüner Lauf (kanonischer Befehl ohne Zusatzargumente, EXIT=0, sauber, Log unverändert${s === 'rls' ? ', nach dem letzten db-push' : ''}) für den aktuellen Fingerabdruck`)
    } else if (c.stufe === 'R3' && s === 'rls') {
      // Übernahme bei unverändertem Fingerabdruck nur mit frischem grünem Lauf (`zeit` = Start dieses Laufs, nie erneuert) nach dem letzten db-push.
      const zeit = c.gruen[s].zeit
      if (!(frisch(zeit, c) && zeit > spaetestePush(c))) g.push('rls: Übernahme aus gruen.json bei R3 nur mit einem grünen Lauf von höchstens 7 Tagen und nach dem letzten db-push (Feld zeit fehlt oder passt nicht): voller Lauf nötig')
    }
  }
  if (c.schrittPruefen) {
    if (c.stufe === 'R3') {
      g.push(...pruefePush(c.neueMigrationen, c.freigaben).gruende)
      for (const m of c.neueMigrationen) {
        if (!(c.dbPushes ?? []).some((p) => (p.migrationen ?? []).some((x) => x.pfad === m.pfad && x.sha256 === m.sha256))) {
          g.push(`${m.pfad}: keine Marke db-push für Pfad und SHA256 ${m.sha256} (Push nicht über npm run db:push, gescheitert oder Datei nach dem Push geändert)`)
        }
      }
      if (!c.abnahme) g.push('R3: Abnahme-Datei fehlt')
      else {
        if (!c.abnahme.modell.toLowerCase().includes('fable')) g.push('R3: Abnahme nicht von Fable')
        if (c.abnahme.hoch !== 0) g.push('R3: Abnahme ohne genau eine Zeile „Offene Findings hoch: 0“')
        if (c.abnahme.dateien.length === 0) g.push('R3: Abnahme nennt keine geprüfte Datei (SHA256-Zeilen)')
        for (const p of c.abnahmeVeraltet ?? []) g.push(`R3: ${p} hat sich seit der Abnahme geändert`)
        for (const p of c.abnahmeFehlt ?? []) g.push(`R3: ${p} ist geändert, aber nicht von der Abnahme genannt`)
      }
      for (const t of c.neueRlsTests) {
        const lauf = c.runs.filter((r) => r.ziel === t && r.logOk).sort((a, b) => a.nr - b.nr)
        const ersterGruen = lauf.find((r) => r.exit === 0)
        if (!ersterGruen || !lauf.some((r) => r.exit !== 0 && r.nr < ersterGruen.nr)) g.push(`R3: ${t}: kein roter Lauf vor dem ersten grünen`)
      }
    }
    // Lösch-Gate (zweite Ebene): geänderte Register-Skripte brauchen eine Freigabe für den neuen SHA-256, Freigaben bleiben unverändert.
    g.push(...pruefePush(c.loeschGeaendert ?? [], c.loeschFreigaben ?? []).gruende.map((x) => `Lösch-Gate: ${x}`))
    for (const p of c.freigabenGeaendert ?? []) g.push(`${p}: Freigaben in docs/freigaben sind unveränderlich (nur neue Dateien)`)
    for (const p of c.geloeschtMuss ?? []) {
      if (!(c.abnahme?.geloescht ?? []).includes(p)) g.push(`${p}: gelöscht, gehört aber zur Mindestmenge der Abnahme; die Abnahme muss die Löschung mit der Zeile „Geloescht: ${p}“ nennen`)
    }
    if (!c.ohneBericht) {
      for (const p of c.berichtKopienFehlen ?? []) g.push(`${p}: in bericht.json genannt, aber nicht im Commit (ignorierte Logs mit git add -f)`)
      // gruen.json im Commit: jeder Eintrag ist entweder der von origin/main oder der des gültigen Laufs (Abdruck, Hash, Schritt, Start); von Hand gesetzte Einträge zählen nicht.
      const gleich = (a, b) => ['abdruck', 'hash', 'schritt', 'zeit'].every((k) => a?.[k] === b?.[k])
      for (const [s, h] of Object.entries(c.gruenHead ?? {})) {
        if (gleich(h, c.gruen?.[s])) continue
        const r = gueltigerLauf(c, s)
        if (!r || !gleich(h, { abdruck: c.abdruck[s], hash: r.hash, schritt: r.schritt, zeit: r.start })) g.push(`docs/proof/gruen.json: Eintrag ${s} stammt weder aus origin/main noch von einem gültigen Lauf (npm run bericht neu ausführen)`)
      }
      if (c.berichtStand !== c.abdruck.check) g.push('bericht.json fehlt im Commit oder ist nicht aktuell (npm run bericht, dann committen)')
      else if (c.berichtGate !== 'bestanden') g.push('bericht.json meldet das Gate nicht als bestanden')
    }
  }
  if (c.standZeilen !== null && c.standZeilen > 40) g.push('docs/STAND.md hat mehr als 40 Zeilen')
  return g
}

// Läufe lesen und gegen die Logdatei prüfen: Hash, Kopf (Commit, Befehl, Sauber-Angabe), Schlusszeile EXIT.
export function leseGepruefteRuns() {
  const alle = leseRuns()
  const runs = alle
    .filter((r) => r.ziel !== 'db-push' && r.nr)
    .map((r) => {
      const log = join(PROOF_ROOT, r.schritt, `${String(r.nr).padStart(3, '0')}-${String(r.ziel).replace(/[\\/:]/g, '_')}.log`)
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
  return { runs, dbPushes: alle.filter((r) => r.ziel === 'db-push').map((r) => ({ start: r.start, migrationen: r.migrationen ?? [] })) }
}

const imHead = (p) => {
  try {
    git('cat-file', '-e', `HEAD:${p}`)
    return true
  } catch {
    return false
  }
}
const lies = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null)
const ausGit = (rev, p) => {
  try {
    return git('show', `${rev}:${p}`)
  } catch {
    return null
  }
}

export function sammle({ von, bis = 'HEAD', schritt, schrittPruefen, ohneBericht = false }) {
  const bereich = `${von}...${bis}`
  const pfade = git('diff', '--no-renames', '--name-only', bereich).split('\n').filter(Boolean)
  const geaendert = (filter, ordner) => git('diff', '--no-renames', '--name-only', `--diff-filter=${filter}`, bereich, '--', ordner).split('\n').filter(Boolean)
  const stand = lies('docs/STAND.md')
  const ordner = join(PROOF_ROOT, schritt)
  const berichtText = ausGit('HEAD', `docs/proof/${schritt}/bericht.json`)
  const bericht = berichtText ? JSON.parse(berichtText) : null
  const abnahmeText = lies(join(PROOF_ROOT, `${schritt}-abnahme.md`))
  const abnahme = abnahmeText === null ? null : parseFreigabe(abnahmeText)
  const genannt = new Set((abnahme?.dateien ?? []).map((d) => d.pfad))
  const { runs, dbPushes } = leseGepruefteRuns()
  const loesch = Object.entries(leseRegister().skripte).flatMap(([p, bindet]) => [p, ...bindet])
  return {
    loeschGeaendert: [...new Set(pfade.filter((p) => loesch.includes(p) && existsSync(p)))].map((pfad) => ({ pfad, sha256: sha256Datei(pfad) })),
    loeschFreigaben: freigabenAusGit('HEAD'),
    freigabenGeaendert: geaendert('MD', 'docs/freigaben'),
    stufe: stufeAus(pfade),
    sauber: sauber(),
    runs,
    dbPushes,
    abdruck: Object.fromEntries(SUITEN.map((s) => [s, fingerabdruck(s)])),
    jetzt: Date.now(),
    gruen: JSON.parse(ausGit('origin/main', 'docs/proof/gruen.json') ?? '{}'),
    gruenHead: JSON.parse(ausGit('HEAD', 'docs/proof/gruen.json') ?? '{}'),
    neueMigrationen: geaendert('AM', 'supabase/migrations').map((pfad) => ({ pfad, sha256: sha256Datei(pfad) })),
    freigaben: existsSync(ordner) ? readdirSync(ordner).filter((f) => /^db-freigabe-.*\.md$/.test(f)).map((f) => parseFreigabe(readFileSync(join(ordner, f), 'utf8'))) : [],
    abnahme,
    abnahmeVeraltet: (abnahme?.dateien ?? []).filter((d) => !existsSync(d.pfad) || sha256Datei(d.pfad) !== d.sha).map((d) => d.pfad),
    abnahmeFehlt: pfade.filter((p) => MUSS_ABNAHME.test(p) && existsSync(p) && !genannt.has(p)),
    geloeschtMuss: pfade.filter((p) => MUSS_ABNAHME.test(p) && !existsSync(p)),
    // Kopien und Logs, die bericht.json nennt, müssen im Commit liegen (`*.log` ist ignoriert: ein vergessenes `git add -f` fiele sonst nicht auf).
    berichtKopienFehlen: [...(bericht?.kopien ?? []), ...Object.values(bericht?.laeufe ?? {}).map((l) => l?.log)].filter(Boolean).map((p) => p.replace(/\\/g, '/')).filter((p) => !imHead(p)),
    neueRlsTests: geaendert('A', 'tests/rls').filter((f) => f.endsWith('.test.ts')),
    berichtStand: bericht?.stand ?? null,
    berichtGate: bericht?.gate ?? null,
    standZeilen: stand === null ? null : stand.replace(/\r?\n$/, '').split(/\r?\n/).length,
    schrittPruefen,
    ohneBericht,
  }
}

// Schritt des Berichts, der in diesem Push hinzugefügt oder geändert wurde: genau einer, und sein Stand muss dem aktuellen Code entsprechen (nach dem Merge heißt der Branch main).
export function schrittAusBericht(von, checkAbdruck) {
  const berichte = git('diff', '--no-renames', '--name-only', '--diff-filter=AM', `${von}...HEAD`, '--', 'docs/proof')
    .split('\n')
    .map((p) => /^docs\/proof\/([^/]+)\/bericht\.json$/.exec(p)?.[1])
    .filter(Boolean)
  if (berichte.length !== 1) return null
  const text = ausGit('HEAD', `docs/proof/${berichte[0]}/bericht.json`)
  return text && JSON.parse(text).stand === checkAbdruck ? berichte[0] : null
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
    const schritt = schrittAusBericht(von, fingerabdruck('check'))
    if (!schritt) meldeUndEnde(['im Push fehlt genau ein neuer/geänderter docs/proof/<schritt>/bericht.json mit stand = aktuellem Code-Stand (fail-closed)'], 'pre-push')
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
