// Purge-Probe R1-B1: sendet tmp/proof/r1-purge-probe.sql, nur wenn der Text mit begin beginnt und mit rollback endet.
import '../../scripts/dev-guard.mjs'
import { readFileSync } from 'node:fs'
import { realDeps } from '../../scripts/redproof-lib.mjs'
const sql = readFileSync('tmp/proof/r1-purge-probe.sql', 'utf8').trim()
if (!/^begin;/i.test(sql) || !/rollback;$/i.test(sql)) throw new Error('Text beginnt nicht mit begin oder endet nicht mit rollback')
console.log(JSON.stringify(realDeps().exec(sql)))
