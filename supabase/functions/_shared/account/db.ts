// Datenbank-Anbindung von delete-account (S9h-4). Läuft mit dem Secret Key (service_role); p_user stammt aus dem geprüften JWT.
import { getUser, type Db } from '../jobs/db.ts'
import { DbError } from '../jobs/handlers.ts'
import type { DeleteAccountDeps } from './handlers.ts'

export const accountDb = (db: Db): Pick<DeleteAccountDeps, 'getUser' | 'remove'> => ({
  getUser: (jwt) => getUser(db, jwt),
  async remove(userId) {
    // delete_account gibt void zurück (data = null): nur der Fehler zählt, `must` würde den Erfolg als no_data melden.
    // 40P01 (Deadlock gegen cancel_by_partner, OFFEN n15-1 N7): die Funktion ist zurückgerollt, nichts halb gelöscht; einmal wiederholen, dann `retry` (409).
    for (let attempt = 0; ; attempt++) {
      const { error } = await db.rpc('delete_account', { p_user: userId })
      if (!error) return
      if (error.code !== '40P01') throw new DbError(error.message)
      if (attempt === 1) throw new DbError('retry')
    }
  },
})
