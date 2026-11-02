import './dev-guard.mjs'
// Importiert die 23 Wiener Bezirksgrenzen nach geo_districts (S9a-3).
// Start: npm run geo:districts (Werte per dotenv-cli). Schreibt über die service_role; die DB repariert und prüft die Geometrie.
// Quelle: Stadt Wien – data.wien.gv.at, Bezirksgrenzen (BEZIRKSGRENZEOGD), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/deed.de).
import { createClient } from '@supabase/supabase-js'

const URL =
  'https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=1.1.0&typeName=ogdwien:BEZIRKSGRENZEOGD&srsName=EPSG:4326&outputFormat=json'
const SOURCE = 'Stadt Wien – data.wien.gv.at, Bezirksgrenzen, CC BY 4.0'
// Plausibilität wie bei der Stadtgrenze: die Ausdehnung muss in Wien liegen.
const BBOX = [16.1, 48.1, 16.65, 48.35]

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SECRET_KEY fehlt. Über npm run geo:districts starten.')
const db = createClient(url, key, { auth: { persistSession: false } })

const res = await fetch(URL, { headers: { 'User-Agent': 'MoveNow-district-import/1.0' } })
if (!res.ok) throw new Error(`Stadt Wien WFS ${res.status}`)
const features = (await res.json()).features ?? []

const byDistrict = new Map()
for (const f of features) {
  // Die Bezirksnummer steht je nach Export in BEZNR oder BEZ; 1–23, sonst Abbruch.
  const n = Number(f.properties?.BEZNR ?? f.properties?.BEZ)
  const g = f.geometry
  if (!Number.isInteger(n) || n < 1 || n > 23) throw new Error(`Bezirksnummer nicht lesbar: ${JSON.stringify(Object.keys(f.properties ?? {}))}`)
  if (g?.type !== 'Polygon' && g?.type !== 'MultiPolygon') throw new Error(`${n}: keine Polygon-Geometrie`)
  const geom = g.type === 'Polygon' ? { type: 'MultiPolygon', coordinates: [g.coordinates] } : g
  const ext = geom.coordinates.flat(2).reduce((e, [lon, lat]) => [Math.min(e[0], lon), Math.min(e[1], lat), Math.max(e[2], lon), Math.max(e[3], lat)], [180, 90, -180, -90])
  if (ext[0] < BBOX[0] || ext[1] < BBOX[1] || ext[2] > BBOX[2] || ext[3] > BBOX[3]) throw new Error(`${n}: Ausdehnung liegt nicht in Wien`)
  byDistrict.set(n, geom)
}
if (byDistrict.size !== 23) throw new Error(`erwartet 23 Bezirke, gefunden ${byDistrict.size}`)

for (const [n, geom] of byDistrict) {
  const { error } = await db.from('geo_districts').upsert({ district: n, name: `${n}. Bezirk`, geom, source: SOURCE, imported_at: new Date().toISOString() })
  if (error) throw new Error(`${n}: ${error.message}`)
}
console.log('23 Bezirke importiert')
