// Dauer je Datei: node tmp/dauer.mjs rls <alt.json> <alt.log> <neu.json> <neu.log> | e2e <alt.json> <neu.json>
import { readFileSync } from 'node:fs'
const rd = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '')
const [kind, ...a] = process.argv.slice(2)
const short = (f) => f.replace(/^.*[\\/](tests[\\/])/, '').replace(/\\/g, '/')

function rlsJson(p) {
  const j = JSON.parse(rd(p)); const m = new Map()
  for (const f of j.testResults) m.set(short(f.name), { file: (f.endTime - f.startTime) / 1000, tests: f.assertionResults.reduce((s, t) => s + (t.duration ?? 0), 0) / 1000, n: f.assertionResults.length })
  return m
}
function rlsLog(p) { // Zeilen wie "✓ |rls| tests/rls/x.test.ts (n tests) 1234ms"
  const m = new Map()
  for (const l of rd(p).split(/\r?\n/)) { const r = l.match(/\|rls\| (tests\/\S+) \((\d+) tests?[^)]*\)\s+(\d+)ms/); if (r) m.set(r[1].replace(/^tests\//, ''), Number(r[3]) / 1000) }
  return m
}
function e2eJson(p) {
  const j = JSON.parse(rd(p)); const m = new Map()
  const walk = (s, file) => {
    const f = s.file ?? file
    for (const sp of s.specs ?? []) for (const t of sp.tests ?? []) for (const r of t.results ?? []) m.set(short(sp.file ?? f), (m.get(short(sp.file ?? f)) ?? 0) + r.duration / 1000)
    for (const c of s.suites ?? []) walk(c, f)
  }
  for (const s of j.suites) walk(s, s.file)
  return m
}
const fmt = (x) => (x == null ? '   -  ' : x.toFixed(1).padStart(6))
const sum = (m, k) => [...m.values()].reduce((s, v) => s + (k ? v[k] : v), 0)

if (kind === 'rls') {
  const [aj, al, nj, nl] = a
  const A = rlsJson(aj), B = rlsJson(nj), AL = rlsLog(al), BL = rlsLog(nl)
  console.log('Datei | alt Datei s | neu Datei s | Faktor | alt Log s | neu Log s')
  const keys = [...new Set([...A.keys(), ...B.keys()])].sort((x, y) => (B.get(y)?.file ?? 0) - (B.get(x)?.file ?? 0))
  for (const k of keys) { const x = A.get(k)?.file, y = B.get(k)?.file; console.log(`${k} | ${fmt(x)} | ${fmt(y)} | ${x && y ? (y / x).toFixed(1) + 'x' : '-'} | ${fmt(AL.get(k))} | ${fmt(BL.get(k))}`) }
  console.log(`SUMME JSON-Dateidauer: alt ${sum(A, 'file').toFixed(0)} s, neu ${sum(B, 'file').toFixed(0)} s`)
  console.log(`SUMME JSON-Testdauer: alt ${sum(A, 'tests').toFixed(0)} s, neu ${sum(B, 'tests').toFixed(0)} s`)
  console.log(`SUMME Log-Dateidauer: alt ${sum(AL).toFixed(0)} s, neu ${sum(BL).toFixed(0)} s`)
  console.log(`Tests: alt ${[...A.values()].reduce((s, v) => s + v.n, 0)}, neu ${[...B.values()].reduce((s, v) => s + v.n, 0)}`)
} else {
  const [aj, nj] = a; const A = e2eJson(aj), B = e2eJson(nj)
  console.log('Datei | alt s | neu s | Faktor')
  for (const k of [...new Set([...A.keys(), ...B.keys()])].sort((x, y) => (B.get(y) ?? 0) - (B.get(x) ?? 0))) { const x = A.get(k), y = B.get(k); console.log(`${k} | ${fmt(x)} | ${fmt(y)} | ${x && y ? (y / x).toFixed(1) + 'x' : '-'}`) }
  console.log(`SUMME: alt ${sum(A).toFixed(0)} s, neu ${sum(B).toFixed(0)} s`)
}
