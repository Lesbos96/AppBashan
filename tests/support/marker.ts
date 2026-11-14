// Marker der Testdaten, an denen `sweepTestResidue` (tests/support/sweep.ts) löscht. Eigene Datei, weil die Lösch-Freigabe (docs/freigaben) sie an sweep.ts bindet:
// Wer das Muster weitet, löscht mehr und braucht eine neue Freigabe.

/**
 * Marker der Testfirmen: ihre Kontaktadresse. Die Domain .test ist reserviert (RFC 2606) und nie zustellbar, `pt-firma-` und die Lauf-ID
 * hängen nur Tests an. `sweepTestResidue` findet Testfirmen daran und nicht an der Mitgliedschaft (die geht mit dem Nutzer verloren).
 */
export const FIRM_MAIL_RE = '^pt-firma-[0-9a-f]{8}@movenow[.]test$' // PostgreSQL-Regex; [.] statt \. (Template-Literal)

/** Name der committeten Abdeckungsfirma: sie und ihre Mitglieder löscht sweep nie. */
export const COVER_FIRM = 'Testabdeckung GmbH'
