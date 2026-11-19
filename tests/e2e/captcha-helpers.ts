import type { Page } from '@playwright/test'

/**
 * Ersetzt das Cloudflare-Skript (der e2e-Lauf hat kein Netz) durch einen Stub mit derselben Schnittstelle.
 * - `pass`: jede Prüfung liefert sofort ein Token `stub-token-<n>` (Normalfall, unsichtbar).
 * - `interactive`: wie echt, wenn Cloudflare eine Eingabe verlangt: `before-interactive-callback`, eine Schaltfläche im Widget, nach dem Klick
 *   `after-interactive-callback` und das Token.
 * - `error`: Cloudflare meldet einen Fehler (`error-callback`).
 * Der Stub zählt in `window.__captcha`: Skriptladungen (`loads`), `renders`, `executes`, `resets` und die ausgegebenen Tokens.
 */
export type CaptchaMode = 'pass' | 'interactive' | 'error'

const installed = new WeakSet<Page>()

const stub = (mode: CaptchaMode) => `
(() => {
  const state = (window.__captcha = window.__captcha || { loads: 0, renders: 0, executes: 0, resets: 0, issued: [], sitekeys: [] })
  state.loads++
  let n = state.issued.length
  let options = {}
  let el = null
  window.turnstile = {
    render(host, o) { state.renders++; state.sitekeys.push(o.sitekey); options = o; el = host; return 'stub-widget' },
    execute() {
      state.executes++
      if (${JSON.stringify(mode)} === 'error') return setTimeout(() => options['error-callback'](), 0)
      const token = () => { const t = 'stub-token-' + (++n); state.issued.push(t); return t }
      if (${JSON.stringify(mode)} === 'pass') return setTimeout(() => options.callback(token()), 0)
      options['before-interactive-callback']()
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = 'Ich bin ein Mensch'
      b.style.cssText = 'min-height:44px;min-width:200px'
      b.onclick = () => { b.remove(); options['after-interactive-callback'](); options.callback(token()) }
      el.append(b)
    },
    reset() { state.resets++; el && el.replaceChildren() },
  }
})()
`

/** Installiert den Stub; ohne `mode` nur, wenn der Test noch keinen eigenen installiert hat (Standard `pass`). */
export async function mockCaptcha(page: Page, mode?: CaptchaMode): Promise<void> {
  if (!mode && installed.has(page)) return
  installed.add(page)
  await page.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({ contentType: 'application/javascript', body: stub(mode ?? 'pass') }))
}

export type CaptchaState = { loads: number; renders: number; executes: number; resets: number; issued: string[]; sitekeys: string[] }

/** Zustand des Stubs; vor der ersten Prüfung (Skript nie geladen) ein leerer Zustand. */
export const captchaState = (page: Page): Promise<CaptchaState> =>
  page.evaluate(() => (window as unknown as { __captcha?: CaptchaState }).__captcha ?? { loads: 0, renders: 0, executes: 0, resets: 0, issued: [], sitekeys: [] })
