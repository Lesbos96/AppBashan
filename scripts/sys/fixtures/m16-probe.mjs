// Fixture für die Probe M16 (Marke und Freigabe binden den Inhalt): legt eine Attrappen-Migration an, gibt sie mit ihrem SHA-256 „frei“, ändert sie optional danach
// und lässt (1) die Marken-Logik des Push-Gates (marken) und (2) das Merge-Gate (pruefeFertig, R3) darüber urteilen. Keine Datenbank, kein Push.
// Aufruf: node m16-probe.mjs <unveraendert|geaendert|nach-push>   Exit 0: Marke gültig und Merge-Gate ohne Grund; Exit 1: blockiert.
//   geaendert: die Datei ändert sich nach der Freigabe, vor der Marke (während des Pushs); nach-push: nach dem Push, vor dem Merge-Gate.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pruefeFertig } from '../fertig.mjs'
import { marken } from '../gate-db-lib.mjs'
import { sha256, sha256Datei } from '../lib.mjs'

const modus = process.argv[2]
if (!['unveraendert', 'geaendert', 'nach-push'].includes(modus)) {
  console.error('Aufruf: m16-probe.mjs <unveraendert|geaendert|nach-push>')
  process.exit(2)
}
const dir = mkdtempSync(join(tmpdir(), 'm16-'))
mkdirSync(join(dir, 'migrations'))
const datei = join(dir, 'migrations', '20261201100000_probe.sql').replace(/\\/g, '/')
writeFileSync(datei, 'select 1;\n')
const freigegeben = sha256Datei(datei)
console.log(`Migration (Attrappe): ${datei}\nFreigegebener SHA256: ${freigegeben}`)
const aendere = () => {
  writeFileSync(datei, 'select 2; -- nach der Freigabe geändert\n')
  console.log(`Datei nach der Freigabe geändert, SHA256 jetzt: ${sha256Datei(datei)}`)
}
if (modus === 'geaendert') aendere()
const m = marken([{ version: '20261201100000', pfad: datei, sha256: freigegeben }], [], sha256Datei)
console.log(`Push-Gate: Marken ${JSON.stringify(m.marken)} Gründe ${JSON.stringify(m.gruende)}`)
if (modus === 'nach-push') aendere()

const jetzt = sha256Datei(datei)
const ab = { check: 'a1', e2e: 'a2', rls: 'a3' }
const lauf = (ziel, befehl) => ({ nr: 1, ziel, args: [], befehl, exit: 0, sauber: true, stabil: true, start: '2026-11-14T10:00:00.000Z', abdruck: ab[ziel], logOk: true })
const frei = { modell: 'claude-fable-5-2', dateien: [{ sha: freigegeben, pfad: datei }], urteil: 'frei', hoch: 0 }
const gruende = pruefeFertig({
  stufe: 'R3',
  sauber: true,
  runs: [lauf('check', 'npm run check'), lauf('e2e', 'npm run test:e2e'), lauf('rls', 'npm run test:rls')],
  abdruck: ab,
  jetzt: Date.parse('2026-11-14T12:00:00.000Z'), // der rls-Lauf muss bei R3 jung sein (fertig.mjs)
  neueMigrationen: [{ pfad: datei, sha256: jetzt }],
  dbPushes: [{ start: '2026-11-14T09:00:00.000Z', migrationen: m.marken }],
  freigaben: [frei],
  abnahme: { modell: 'claude-fable-5-2', dateien: [{ sha: sha256('x'), pfad: 'scripts/sys/run.mjs' }], urteil: '', hoch: 0 },
  neueRlsTests: [],
  berichtStand: 'a1',
  berichtGate: 'bestanden',
  standZeilen: null,
  schrittPruefen: true,
})
console.log(`Merge-Gate: ${gruende.length ? `BLOCKIERT:\n- ${gruende.join('\n- ')}` : 'ohne Grund (würde durchlassen)'}`)
process.exit(m.gruende.length || gruende.length ? 1 : 0)
