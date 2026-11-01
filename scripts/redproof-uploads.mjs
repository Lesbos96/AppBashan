// Rot-Beweis (nur Dev-Projekt): lockert die Foto-Policies, lässt die Verweigerungstests laufen (müssen rot werden) und stellt
// die Policies im finally wieder her. Beleg: die Policy-Definitionen vorher und nachher sind identisch.
// Start: npx dotenv -e .env.local -- node scripts/redproof-uploads.mjs | tee tmp/proof/s8b3-redproof.log
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const cli = (...args) => execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
const sql = (q) => cli('db', 'query', '--linked', q)
// Die Ausgabe enthält eine zufällige Begrenzung (Warnung zu fremden Daten): nur die Zeilen vergleichen.
const rowsOf = (out) => JSON.stringify(JSON.parse(out).rows)
const snapshot = () =>
  rowsOf(sql(`select schemaname, tablename, policyname, cmd, roles, qual, with_check from pg_policies where (schemaname = 'storage' and tablename = 'objects' and policyname like 'request_photos%') or (schemaname = 'public' and tablename = 'request_photos') order by 1, 2, 3;`))

const before = snapshot()
const loosen = [
  ['Storage lesen für alle Angemeldeten', `alter policy request_photos_objects_select on storage.objects using (bucket_id = 'request-photos');`],
  ['Storage hochladen ohne Zeile und Ordner', `alter policy request_photos_objects_insert on storage.objects with check (bucket_id = 'request-photos');`],
  ['Storage löschen für alle Angemeldeten', `alter policy request_photos_objects_delete on storage.objects using (bucket_id = 'request-photos');`],
  ['Foto-Zeilen in fremde Anfragen', `alter policy request_photos_insert on public.request_photos with check (true);`],
]
let red = 0
try {
  for (const [name, statement] of loosen) {
    sql(statement)
    spawnSync('npx', ['vitest', 'run', '--project', 'rls', 'tests/rls/uploads.test.ts', '--reporter=json', '--outputFile=tmp/reports/redproof.json'], { encoding: 'utf8', env: process.env, shell: true })
    const json = JSON.parse(readFileSync('tmp/reports/redproof.json', 'utf8'))
    const names = json.testResults.flatMap((f) => f.assertionResults.filter((t) => t.status === 'failed').map((t) => t.title))
    console.log(`${names.length > 0 ? 'ROT (gewollt)' : 'GRÜN (Lücke im Test!)'} ${name}: ${names.length} Tests rot`)
    names.forEach((n) => console.log(`   - ${n.slice(0, 110)}`))
    if (names.length > 0) red++
    // zurück, bevor die nächste Policy gelockert wird
    restore()
  }
} finally {
  restore()
  const after = snapshot()
  console.log(before === after ? 'Policies vorher und nachher identisch.' : 'ACHTUNG: Policies weichen ab!')
  console.log(red === loosen.length && before === after ? 'REDPROOF BESTANDEN' : 'REDPROOF FEHLGESCHLAGEN')
  process.exitCode = red === loosen.length && before === after ? 0 : 1
}

function restore() {
  sql(`alter policy request_photos_objects_select on storage.objects using (bucket_id = 'request-photos' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.my_role()) = 'admin'));`)
  sql(`alter policy request_photos_objects_insert on storage.objects with check (bucket_id = 'request-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.request_photos p join public.service_requests r on r.id = p.request_id where p.storage_path = name and r.customer_id = (select auth.uid()) and r.status in ('requested', 'inspection_requested')));`)
  sql(`alter policy request_photos_objects_delete on storage.objects using (bucket_id = 'request-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.service_requests r where r.id::text = (storage.foldername(name))[2] and r.customer_id = (select auth.uid()) and r.status in ('requested', 'inspection_requested')));`)
  sql(`alter policy request_photos_insert on public.request_photos with check (exists (select 1 from public.service_requests r where r.id = request_id and r.customer_id = (select auth.uid()) and r.status in ('requested', 'inspection_requested')) and starts_with(storage_path, (select auth.uid())::text || '/' || request_id::text || '/'));`)
}
