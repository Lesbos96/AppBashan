// R3: Laufzeit von route_geo_facts mit der echten Routenlinie (Dev-Projekt).
// Start: npx dotenv -e .env.local -- node scripts/live-r3.mjs | tee tmp/proof/r3.log
// Die Linie kommt aus tmp/proof/ors.json (rohe Directions-Antwort, GeoJSON). Das Skript schreibt nur die SQL-Datei nach tmp/proof/.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const line = JSON.stringify({ type: 'LineString', coordinates: JSON.parse(readFileSync('tmp/proof/ors.json', 'utf8')).features[0].geometry.coordinates })
writeFileSync('tmp/proof/r3.sql', `explain analyze select * from public.route_geo_facts($q$${line}$q$, 48.208164, 16.373477, 47.0707, 15.4395);\n`)
const out = execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'db', 'query', '--linked', '-f', 'tmp/proof/r3.sql'], { encoding: 'utf8', maxBuffer: 1 << 24 })
const times = out.match(/(Planning|Execution) Time[^\n"]*/g) ?? []
console.log(`Punkte: ${JSON.parse(line).coordinates.length}`)
console.log(times.join('\n') || 'keine Zeiten in der Ausgabe')
const ms = Number(/Execution Time: ([\d.]+) ms/.exec(out)?.[1])
console.log(ms < 1000 ? `PASS R3: ${ms} ms (unter 1 s)` : `FAIL R3: ${ms} ms`)
process.exit(ms < 1000 ? 0 : 1)
