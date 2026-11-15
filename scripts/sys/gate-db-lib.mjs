// Reine Logik des Datenbank-Gates: keine DB, keine Dateizugriffe außer den übergebenen Pfaden.
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { sha256Datei } from './lib.mjs'

const norm = (p) => p.replace(/\\/g, '/')

// liste: Ausgabe von `supabase migration list -o json` ({ migrations: [{ local, remote }] }). Offen = lokal vorhanden, auf Remote nicht.
// Unerwartete Form wirft (fail-closed), nie "keine offenen Migrationen".
export function offeneMigrationen(liste, dir) {
  const eintraege = Array.isArray(liste) ? liste : liste?.migrations
  if (!Array.isArray(eintraege)) throw new Error('Unerwartete Form der Migrationsliste (erwartet { migrations: [...] })')
  if (eintraege.some((e) => typeof e?.local !== 'string' || !['string', 'undefined'].includes(typeof e?.remote))) {
    throw new Error('Unerwartete Form eines Listeneintrags (erwartet Zeichenketten local und remote)')
  }
  const dateien = existsSync(dir) ? readdirSync(dir) : []
  // Gegenprobe: jede lokale Migrationsdatei muss in der Liste stehen, sonst ist die Liste unvollständig (z. B. leer) und nicht verlässlich.
  const bekannt = new Set(eintraege.map((e) => e.local))
  for (const d of dateien.filter((x) => x.endsWith('.sql'))) {
    const v = /^(\d+)_/.exec(d)?.[1]
    if (v && !bekannt.has(v)) throw new Error(`Migrationsdatei ${d} fehlt in der Liste (Liste unvollständig)`)
  }
  return eintraege
    .filter((m) => m.local && !m.remote)
    .map((m) => {
      const name = dateien.find((d) => d.startsWith(`${m.local}_`) && d.endsWith('.sql'))
      if (!name) throw new Error(`Migration ${m.local} ist offen, aber die Datei fehlt in ${dir}`)
      const pfad = norm(join(dir, name))
      return { version: m.local, pfad, sha256: sha256Datei(pfad) }
    })
}

// Bericht des Beraters, streng zeilenverankert:
//   Modell: <id>                       genau eine Zeile (die erste zählt)
//   SHA256: <64 hex> <pfad>            je geprüfter Datei eine Zeile
//   Geloescht: <pfad>                  je ausdrücklich gebilligter Löschung einer Datei der Mindestmenge (fertig.mjs, N22)
//   Urteil: frei|gesperrt              genau eine Zeile (sonst Urteil '')
//   Offene Findings hoch: N            genau eine Zeile (sonst NaN)
export function parseFreigabe(text) {
  const zeilen = text.split(/\r?\n/).map((z) => z.trim())
  const alle = (re) => zeilen.map((z) => re.exec(z)).filter(Boolean)
  const urteile = alle(/^Urteil:\s*(\S+)\s*$/)
  const hoch = alle(/^Offene Findings hoch:\s*(\d+)\s*$/)
  return {
    modell: alle(/^Modell:\s*(\S+)/)[0]?.[1] ?? '',
    dateien: alle(/^SHA256:\s*([0-9a-fA-F]{64})\s+(\S+)\s*$/).map((m) => ({ sha: m[1].toLowerCase(), pfad: norm(m[2]) })),
    geloescht: alle(/^Geloescht:\s*(\S+)\s*$/).map((m) => norm(m[1])), // gelöschte Dateien der Mindestmenge, die die Abnahme ausdrücklich nennt
    urteil: urteile.length === 1 ? urteile[0][1] : '',
    hoch: hoch.length === 1 ? Number(hoch[0][1]) : Number.NaN,
  }
}

// Alle Freigaben zu Pfad und SHA-256 müssen in Ordnung sein: ein „gesperrt“ neben einem „frei“ für dieselbe Datei blockiert.
export function pruefePush(offen, freigaben) {
  const gruende = []
  for (const m of offen) {
    const treffer = freigaben.filter((x) => x.dateien.some((d) => d.sha === m.sha256 && d.pfad === m.pfad))
    if (treffer.length === 0) gruende.push(`${m.pfad}: keine Freigabe für Pfad und SHA256 ${m.sha256}`)
    for (const f of treffer) {
      if (!f.modell.toLowerCase().includes('fable')) gruende.push(`${m.pfad}: Freigabe nicht von Fable (Modell: ${f.modell || 'fehlt'})`)
      else if (f.urteil !== 'frei') gruende.push(`${m.pfad}: Urteil ${f.urteil || 'fehlt oder mehrfach'}`)
      else if (f.hoch !== 0) gruende.push(`${m.pfad}: Offene Findings hoch ${Number.isNaN(f.hoch) ? 'fehlt oder mehrfach' : f.hoch}`)
    }
  }
  return { ok: gruende.length === 0, gruende }
}

// Startmarke, die vor dem CLI-Start in runs.jsonl geschrieben wird (AM5): freigegebene Version, Pfad und SHA-256. Gelingt der Push, aber nicht das Schreiben der Marken
// (Liste nicht lesbar, Absturz), holt `nachtrag` sie aus der Startmarke nach; sonst bliebe `fertig` für diese Migration dauerhaft blockiert.
export const startMarke = (offen, start = new Date().toISOString()) => ({ ziel: 'db-push-start', start, migrationen: offen.map(({ version, pfad, sha256 }) => ({ version, pfad, sha256 })) })

// zeilen: geparste Zeilen von runs.jsonl. Migrationen aus Startmarken, für die es keine Marke `db-push` mit gleichem Pfad und SHA-256 gibt.
export function unmarkierteStarts(zeilen) {
  const markiert = new Set(zeilen.filter((z) => z.ziel === 'db-push').flatMap((z) => (z.migrationen ?? []).map((m) => `${m.pfad}\0${m.sha256}`)))
  // Je Pfad zählt nur die jüngste Startmarke (Reihenfolge der Datei): eine überholte (Push scheiterte, Datei korrigiert, zweiter Push markiert) soll den Nachtrag nicht dauerhaft blockieren.
  const jüngste = new Map()
  for (const z of zeilen.filter((x) => x.ziel === 'db-push-start')) for (const m of z.migrationen ?? []) jüngste.set(m.pfad, { ...m, start: z.start })
  return [...jüngste.values()].filter((m) => !markiert.has(`${m.pfad}\0${m.sha256}`))
}

// Nachtrag: Marke nur mit positivem Beleg (die Version steht in der Liste mit `remote`) und unverändertem SHA-256. Noch nicht angewendete Migrationen bleiben stumm offen;
// eine fehlende oder geänderte Datei ergibt keine Marke, sondern einen Grund (fail closed).
export function nachtragMarken(vorher, liste, shaJetzt) {
  const eintraege = Array.isArray(liste) ? liste : liste?.migrations
  if (!Array.isArray(eintraege)) throw new Error('Unerwartete Form der Migrationsliste (erwartet { migrations: [...] })')
  const angewendet = new Set(eintraege.filter((e) => e?.remote).map((e) => e.local))
  const marken = []
  const gruende = []
  const offen = []
  for (const m of vorher) {
    if (!angewendet.has(m.version)) {
      offen.push(m)
      continue
    }
    let sha
    try {
      sha = shaJetzt(m.pfad)
    } catch {
      gruende.push(`${m.pfad}: Datei nicht lesbar, keine Marke`)
      continue
    }
    if (sha === m.sha256) marken.push({ pfad: m.pfad, sha256: m.sha256, start: m.start })
    else gruende.push(`${m.pfad}: Inhalt hat sich seit der Freigabe geändert (SHA256 ${m.sha256} freigegeben), keine Marke`)
  }
  return { marken, gruende, offen }
}

// Marken nach einem Push (auch einem teilweisen): je tatsächlich angewendeter Migration (vorher offen, nachher nicht mehr) { pfad, sha256 } mit dem SHA,
// der vor dem Push freigegeben war. Weicht der SHA der Datei nach dem Push ab, gibt es für sie keine Marke und einen Grund.
export function marken(vorher, nachher, shaJetzt) {
  const noch = new Set(nachher.map((m) => m.version))
  const marken = []
  const gruende = []
  for (const m of vorher.filter((x) => !noch.has(x.version))) {
    if (shaJetzt(m.pfad) === m.sha256) marken.push({ pfad: m.pfad, sha256: m.sha256 })
    else gruende.push(`${m.pfad}: Inhalt hat sich seit der Freigabe geändert (SHA256 ${m.sha256} freigegeben), keine Marke`)
  }
  return { marken, gruende }
}
