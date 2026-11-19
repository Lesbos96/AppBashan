// Cloudflare Turnstile (Captcha) für die Wege ohne Login: `signInWithOtp` (Anmeldung) und die Function `route` (Adresssuche, Strecke).
// Ein einziges Widget für die ganze App (Host in der Shell, `CaptchaHost`). `getCaptchaToken()` liefert je Aufruf ein frisches Token:
// Tokens gelten einmal, deshalb nie zwischenspeichern, nie wiederverwenden. Aufrufe laufen strikt nacheinander (ein Widget, eine Prüfung zur Zeit).
// Das Cloudflare-Skript lädt erst beim ersten Aufruf, also nach der Nutzeraktion (Absenden, Einwilligung), nie beim Start der App.

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
// Reicht für eine Prüfung mit Interaktion; danach gilt sie als nicht verfügbar.
const TIMEOUT_MS = 60_000

type Api = {
  render(el: HTMLElement, options: Record<string, unknown>): string
  execute(id: string): void
  reset(id: string): void
}
declare global {
  interface Window {
    turnstile?: Api
  }
}

/** `offline`: Skript nicht ladbar. `failed`: Prüfung fehlgeschlagen oder abgebrochen. `unavailable`: nicht eingerichtet, Zeitüberschreitung, Widget-Fehler. */
export class CaptchaError extends Error {
  constructor(readonly kind: 'offline' | 'failed' | 'unavailable') {
    super(kind)
  }
}

let host: HTMLElement | null = null
let widgetId: string | null = null
let script: Promise<Api> | null = null
let queue: Promise<unknown> = Promise.resolve()
let pending: { resolve(token: string): void; reject(error: CaptchaError): void } | null = null
let interactive = false
const listeners = new Set<() => void>()

const setInteractive = (value: boolean) => {
  interactive = value
  listeners.forEach((listener) => listener())
}

/** Für `useSyncExternalStore`: ist die Prüfung gerade sichtbar (Cloudflare verlangt eine Eingabe)? */
export const subscribeCaptcha = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
export const captchaInteractive = () => interactive

/** Die Shell meldet das Element, in dem das Widget lebt. */
export function attachCaptchaHost(el: HTMLElement | null): void {
  host = el
  if (!el) widgetId = null // das Element ist weg, das Widget mit ihm
}

/** Bricht eine laufende Prüfung ab (Schaltfläche in der Abfrage); der Aufrufer sieht `failed`. */
export function cancelCaptcha(): void {
  pending?.reject(new CaptchaError('failed'))
}

function loadScript(): Promise<Api> {
  script ??= new Promise<Api>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = SCRIPT_URL
    el.async = true
    el.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new CaptchaError('unavailable')))
    el.onerror = () => {
      el.remove()
      reject(new CaptchaError('offline'))
    }
    document.head.append(el)
  })
  // Ein Ladefehler soll beim nächsten Versuch neu laden (z. B. nach kurzem Verbindungsverlust)
  script.catch(() => void (script = null))
  return script
}

async function issue(): Promise<string> {
  const siteKey = import.meta.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  if (!siteKey || !host) throw new CaptchaError('unavailable')
  const api = await loadScript()
  const settled = (action: () => void) => {
    pending = null
    clearTimeout(timer)
    setInteractive(false)
    if (widgetId) api.reset(widgetId) // das nächste Token braucht eine frische Prüfung
    action()
  }
  let timer: ReturnType<typeof setTimeout>
  return new Promise<string>((resolve, reject) => {
    pending = { resolve: (token) => settled(() => resolve(token)), reject: (error) => settled(() => reject(error)) }
    timer = setTimeout(() => pending?.reject(new CaptchaError('unavailable')), TIMEOUT_MS)
    try {
      widgetId ??= api.render(host!, {
        sitekey: siteKey,
        execution: 'execute',
        appearance: 'interaction-only',
        language: 'de',
        theme: 'auto',
        callback: (token: string) => pending?.resolve(token),
        'error-callback': () => pending?.reject(new CaptchaError('failed')),
        'expired-callback': () => pending?.reject(new CaptchaError('failed')),
        'timeout-callback': () => pending?.reject(new CaptchaError('failed')),
        'before-interactive-callback': () => setInteractive(true),
        'after-interactive-callback': () => setInteractive(false),
      })
      api.execute(widgetId)
    } catch {
      pending?.reject(new CaptchaError('unavailable'))
    }
  })
}

/** Ein frisches Captcha-Token (einmalig verwendbar). Wirft `CaptchaError`. */
export function getCaptchaToken(): Promise<string> {
  const next = queue.then(issue, issue)
  queue = next.catch(() => undefined)
  return next
}
