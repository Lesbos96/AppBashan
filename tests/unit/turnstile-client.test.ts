import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Fake von Cloudflare: `execute` liefert asynchron ein Token mit laufender Nummer; `running` zählt gleichzeitige Prüfungen.
type Options = Record<string, (...a: unknown[]) => unknown>
function setup(behaviour: 'token' | 'silent' = 'token') {
  let options: Options = {}
  let issued = 0
  const state = { running: 0, maxRunning: 0, resets: 0, renders: 0, loads: 0, failLoad: 0 }
  const api = {
    render: vi.fn((_el: unknown, o: Options) => ((options = o), state.renders++, 'w1')),
    execute: vi.fn(() => {
      state.running++
      state.maxRunning = Math.max(state.maxRunning, state.running)
      if (behaviour === 'token') setTimeout(() => ((options.callback as (t: string) => void)(`tok-${++issued}`)), 0)
    }),
    reset: vi.fn(() => void (state.resets++, state.running--)),
  }
  const win: { turnstile?: typeof api } = {}
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', {
    createElement: () => ({ remove: () => undefined }),
    head: {
      append: (el: { onload?: () => void; onerror?: () => void }) => {
        state.loads++
        setTimeout(() => {
          if (state.failLoad > 0) return void (state.failLoad--, el.onerror?.())
          win.turnstile = api
          el.onload?.()
        }, 0)
      },
    },
  })
  return { api, state, options: () => options }
}

async function load(siteKey = 'site-key') {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', siteKey)
  const lib = await import('../../src/lib/turnstile.ts')
  lib.attachCaptchaHost({} as HTMLElement)
  return lib
}

beforeEach(() => vi.useRealTimers())
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('getCaptchaToken', () => {
  it('lädt das Skript erst beim ersten Aufruf, nicht beim Einbinden', async () => {
    const { state } = setup()
    const lib = await load()
    expect(state.loads).toBe(0)
    await lib.getCaptchaToken()
    await lib.getCaptchaToken()
    expect(state.loads).toBe(1)
    expect(state.renders).toBe(1)
  })

  it('liefert je Aufruf ein frisches Token, strikt nacheinander, mit Reset nach jeder Ausgabe', async () => {
    const { state, api } = setup()
    const lib = await load()
    const tokens = await Promise.all([lib.getCaptchaToken(), lib.getCaptchaToken(), lib.getCaptchaToken()])
    expect(tokens).toEqual(['tok-1', 'tok-2', 'tok-3'])
    expect(state.maxRunning).toBe(1)
    expect(state.resets).toBe(3)
    expect(api.execute).toHaveBeenCalledTimes(3)
  })

  it('Widget: nur bei Bedarf sichtbar, Interaktion „interaction-only“, deutsch', async () => {
    const { options } = setup('silent')
    const lib = await load()
    const pending = lib.getCaptchaToken()
    await vi.waitFor(() => expect(options().sitekey).toBe('site-key'))
    expect(options()).toMatchObject({ appearance: 'interaction-only', execution: 'execute', language: 'de' })
    expect(lib.captchaInteractive()).toBe(false)
    const seen: boolean[] = []
    lib.subscribeCaptcha(() => seen.push(lib.captchaInteractive()))
    options()['before-interactive-callback']!()
    expect(lib.captchaInteractive()).toBe(true)
    options().callback!('tok-x')
    await expect(pending).resolves.toBe('tok-x')
    expect(lib.captchaInteractive()).toBe(false)
    expect(seen).toEqual([true, false])
  })

  it('ohne Site Key oder ohne Host: unavailable, nichts wird geladen', async () => {
    const { state } = setup()
    const lib = await load('')
    await expect(lib.getCaptchaToken()).rejects.toMatchObject({ kind: 'unavailable' })
    const lib2 = await load()
    lib2.attachCaptchaHost(null)
    await expect(lib2.getCaptchaToken()).rejects.toMatchObject({ kind: 'unavailable' })
    expect(state.loads).toBe(0)
  })

  it('Ladefehler des Skripts: offline, der nächste Versuch lädt neu', async () => {
    const { state } = setup()
    state.failLoad = 1
    const lib = await load()
    await expect(lib.getCaptchaToken()).rejects.toMatchObject({ kind: 'offline' })
    await expect(lib.getCaptchaToken()).resolves.toBe('tok-1')
    expect(state.loads).toBe(2)
  })

  it('Fehler, Ablauf und Abbruch heißen failed; danach geht die nächste Prüfung wieder', async () => {
    const { options, state } = setup('silent')
    const lib = await load()
    for (const trigger of [() => options()['error-callback']!(), () => options()['expired-callback']!(), () => lib.cancelCaptcha()]) {
      const pending = lib.getCaptchaToken()
      await vi.waitFor(() => expect(options().sitekey).toBe('site-key'))
      await vi.waitFor(() => expect(state.running).toBeGreaterThan(0))
      trigger()
      await expect(pending).rejects.toMatchObject({ kind: 'failed' })
      expect(state.running).toBe(0)
    }
  })

  it('ein Token, das nach dem Ende ankommt, wird ignoriert', async () => {
    const { options, state } = setup('silent')
    const lib = await load()
    const first = lib.getCaptchaToken()
    await vi.waitFor(() => expect(state.running).toBe(1))
    options().callback!('tok-a')
    await expect(first).resolves.toBe('tok-a')
    options().callback!('tok-spaet') // kein wartender Aufruf mehr
    const second = lib.getCaptchaToken()
    await vi.waitFor(() => expect(state.running).toBe(1))
    options().callback!('tok-b')
    await expect(second).resolves.toBe('tok-b')
  })

  it('Zeitüberschreitung: unavailable', async () => {
    const { state } = setup('silent')
    const lib = await load()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const pending = lib.getCaptchaToken()
    const assertion = expect(pending).rejects.toMatchObject({ kind: 'unavailable' })
    await vi.advanceTimersByTimeAsync(61_000)
    await assertion
    expect(state.running).toBe(0)
  })
})
