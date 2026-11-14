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
    urteil: urteile.length === 1 ? urteile[0][1] : '',
    hoch: hoch.length === 1 ? Number(hoch[0][1]) : Number.NaN,
  }
}

export function pruefePush(offen, freigaben) {
  const gruende = []
  for (const m of offen) {
    const f = freigaben.find((x) => x.dateien.some((d) => d.sha === m.sha256 && d.pfad === m.pfad))
    if (!f) gruende.push(`${m.pfad}: keine Freigabe für Pfad und SHA256 ${m.sha256}`)
    else if (!f.modell.toLowerCase().includes('fable')) gruende.push(`${m.pfad}: Freigabe nicht von Fable (Modell: ${f.modell || 'fehlt'})`)
    else if (f.urteil !== 'frei') gruende.push(`${m.pfad}: Urteil ${f.urteil || 'fehlt oder mehrfach'}`)
    else if (f.hoch !== 0) gruende.push(`${m.pfad}: Offene Findings hoch ${Number.isNaN(f.hoch) ? 'fehlt oder mehrfach' : f.hoch}`)
  }
  return { ok: gruende.length === 0, gruende }
}
