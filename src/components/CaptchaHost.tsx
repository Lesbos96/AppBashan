import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { attachCaptchaHost, cancelCaptcha, captchaInteractive, subscribeCaptcha } from '../lib/turnstile'
import { Button } from './Button'

/**
 * Heimat des Turnstile-Widgets (einmal in der Shell). Ein natives `<dialog>`, das im Ruhezustand geschlossen, aber per CSS als unsichtbarer,
 * nicht bedienbarer Punkt dargestellt wird (der iframe bleibt dabei im Dokument und lädt nie neu; es zählt nicht als offener Dialog).
 * Verlangt Cloudflare eine Eingabe, wird dasselbe Element modal als Karte am unteren Rand gezeigt; als Modal liegt es auch über offenen
 * Sheets (Adresssuche). Fokusfalle, Esc („Abbrechen“) und Fokus zurück zum Auslöser kommen vom Browser.
 */
export function CaptchaHost() {
  const open = useSyncExternalStore(subscribeCaptcha, captchaInteractive)
  const dialog = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const el = dialog.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      inert={!open}
      aria-label="Sicherheitsprüfung"
      onCancel={(e) => {
        e.preventDefault()
        cancelCaptcha()
      }}
      className={
        open
          ? 'fixed inset-x-0 top-auto bottom-0 mx-auto my-0 flex w-full max-w-(--content-max-width) flex-col items-center gap-3 rounded-t-sheet-top border-t-[0.5px] border-text/30 bg-background px-4 pt-6 pb-[max(var(--safe-bottom),16px)] text-text shadow-sheet backdrop:bg-sheet-dim'
          : 'pointer-events-none fixed top-0 left-0 m-0 block size-px overflow-hidden border-0 bg-transparent p-0 opacity-0'
      }
    >
      {open && <p className="m-0 text-balance text-center text-body text-text-secondary">Kurze Sicherheitsprüfung, damit nur Menschen anfragen können.</p>}
      <div ref={attachCaptchaHost} />
      {open && (
        <Button variant="plain" onClick={cancelCaptcha}>
          Abbrechen
        </Button>
      )}
    </dialog>
  )
}
