// Importiert die Grenzen von Wien und Österreich nach geo_boundaries (S5).
// Start: npm run geo:import (Werte per dotenv-cli). Schreibt über die service_role; die DB repariert und prüft die Geometrie.
// Quelle: OpenStreetMap-Mitwirkende, ODbL (https://www.openstreetmap.org/copyright), über Nominatim lookup (einmalig, nicht aus der App).
// Wien: OSM-Relation 109166, Österreich: 16239.
import { createClient } from '@supabase/supabase-js'

// bbox = [minLon, minLat, maxLon, maxLat]: grobe Plausibilitätsprüfung, damit eine falsche Relation den Preis nicht still verfälscht.
const BOUNDARIES = [
  { slug: 'vienna', name: 'Wien', relation: 109166, bbox: [16.1, 48.1, 16.65, 48.35] },
  { slug: 'austria', name: 'Österreich', relation: 16239, bbox: [9.4, 46.3, 17.3, 49.1] },
]
const SOURCE = '© OpenStreetMap-Mitwirkende, ODbL'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SECRET_KEY fehlt. Über npm run geo:import starten.')
const db = createClient(url, key, { auth: { persistSession: false } })

for (const b of BOUNDARIES) {
  const res = await fetch(`https://nominatim.openstreetmap.org/lookup?osm_ids=R${b.relation}&format=geojson&polygon_geojson=1`, {
    headers: { 'User-Agent': 'MoveNow-boundary-import/1.0', 'Accept-Language': 'de' },
  })
  if (!res.ok) throw new Error(`${b.slug}: Nominatim ${res.status}`)
  const geometry = (await res.json()).features?.[0]?.geometry
  if (geometry?.type !== 'Polygon' && geometry?.type !== 'MultiPolygon') throw new Error(`${b.slug}: keine Polygon-Geometrie`)
  const geom = geometry.type === 'Polygon' ? { type: 'MultiPolygon', coordinates: [geometry.coordinates] } : geometry
  const [minLon, minLat, maxLon, maxLat] = b.bbox
  const ext = geom.coordinates.flat(2).reduce((e, [lon, lat]) => [Math.min(e[0], lon), Math.min(e[1], lat), Math.max(e[2], lon), Math.max(e[3], lat)], [180, 90, -180, -90])
  // Die Ausdehnung muss in der Box liegen und mindestens die halbe Breite füllen (fängt zu große und zu kleine Relationen).
  if (ext[0] < minLon || ext[1] < minLat || ext[2] > maxLon || ext[3] > maxLat || ext[2] - ext[0] < (maxLon - minLon) / 2) {
    throw new Error(`${b.slug}: Ausdehnung ${ext.map((v) => v.toFixed(2))} passt nicht zur erwarteten Grenze`)
  }
  const { error } = await db.from('geo_boundaries').upsert({ slug: b.slug, name: b.name, geom, source: SOURCE, imported_at: new Date().toISOString() })
  if (error) throw new Error(`${b.slug}: ${error.message}`)
  console.log(`${b.slug}: ${geom.coordinates.length} Polygon(e) importiert`)
  await new Promise((r) => setTimeout(r, 1500)) // Nominatim-Nutzungsrichtlinie: höchstens 1 Anfrage/s
}
