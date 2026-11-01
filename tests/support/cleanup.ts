/** Übersetzt den Fehler von `photo_cleanup()` bei fehlendem Vault (Migration 0014) in eine klare Anweisung; andere Fehler bleiben unberührt. */
export function vaultMissing(error: { message: string } | null): Error | null {
  return error?.message.includes('nicht eingerichtet') ? new Error('Vault-Secrets fehlen – npm run setup:photo-cleanup ausführen') : null
}
