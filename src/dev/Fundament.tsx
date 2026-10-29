import type { ReactNode } from 'react'
import tokens from '../../docs/reference/design/tokens.json'
import { Icon } from '../components/Icon'
import { Illustration } from '../components/Illustration'
import { formatEuro } from '../lib/money'
import { Komponenten } from './Komponenten'

const names = (glob: Record<string, unknown>) => Object.keys(glob).map((path) => path.slice(path.lastIndexOf('/') + 1, -4))
const iconNames = names(import.meta.glob('../assets/icons/*.svg'))
const illustrationNames = names(import.meta.glob('../assets/illustrations/*.svg')).filter((name) => !name.endsWith('.dark'))


const { light, dark } = tokens.color
const lightSwatches = [
  ['Petrol', light.primary],
  ['Tief', light.primaryDeep],
  ['Tinte', light.text],
  ['Mint', light.accentMint],
  ['Champagner', light.accentChampagne],
  ['Fläche', light.background],
  ['Karte', light.surface],
  ['Text 2', light.textSecondary],
  ['Tint', light.tint, 'Petrol 10 %'],
  ['Haarlinie', light.hairline, 'Tinte 8 %'],
]
const darkSwatches = [
  ['Grund', dark.background],
  ['Karte', dark.surface],
  ['Erhöht', dark.surfaceElevated],
  ['Petrol', dark.primary],
  ['Akzent', dark.accent],
  ['Text', dark.text],
]

const type = [
  ['text-large-title', 'Large Title', '34 / 41 · Bold'],
  ['text-title2', 'Titel', '22 / 28 · Bold'],
  ['text-headline', 'Headline', '17 / 22 · Semibold'],
  ['text-body', 'Fließtext, ruhig und präzise', '17 / 22 · Regular'],
  ['text-subhead text-text-secondary', 'Unterzeile und Beschreibung', '15 / 20'],
  ['text-footnote text-text-secondary', 'Fußnote für Hinweise', '13 / 18'],
] as const

const filled = (name: string) => name.endsWith('-filled')

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-hero-card bg-surface p-6 shadow-card-raised">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-section-header font-semibold uppercase tracking-[0.8px] text-text-secondary">{title}</h2>
        {note && <span className="text-footnote text-text-secondary">{note}</span>}
      </div>
      {children}
    </section>
  )
}

export function Fundament() {
  return (
    <main className="mx-auto flex max-w-[520px] flex-col gap-6 px-5 pb-12 pt-safe">
      <header className="flex items-center gap-4 pt-8">
        <img src="/favicon.svg" alt="" width={52} height={52} className="rounded-[12px]" />
        <div>
          <h1 className="m-0 text-title1">MoveNow</h1>
          <p className="m-0 text-subhead text-text-secondary">Designsprache · Light und Dark</p>
        </div>
      </header>

      <Card title="App-Icon">
        <div className="flex items-end gap-4">
          <img src="/icon.svg" alt="App-Icon MoveNow" width={150} height={150} className="rounded-[34px] shadow-card-raised" />
          <div className="flex flex-col gap-3">
            <img src="/icon-dark.svg" alt="App-Icon im Dark Mode" width={76} height={76} />
            <img src="/favicon.svg" alt="Favicon" width={40} height={40} />
          </div>
        </div>
      </Card>

      <Card title="Farben · Light">
        <div className="grid grid-cols-5 gap-3">
          {lightSwatches.map(([name, hex, label = hex]) => (
            <div key={name} className="flex min-w-0 flex-col gap-1">
              <span className="h-12 rounded-[14px] shadow-[inset_0_0_0_1px_var(--hairline)]" style={{ background: hex }} />
              <span className="text-footnote font-semibold">{name}</span>
              <span className="break-all text-eyebrow tracking-normal text-text-secondary">{label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Farben · Dark">
        <div className="grid grid-cols-3 gap-3 rounded-[20px] p-3" style={{ background: dark.background }}>
          {darkSwatches.map(([name, hex]) => (
            <div key={name} className="flex min-w-0 flex-col gap-1">
              <span className="h-12 rounded-[14px] shadow-[inset_0_0_0_1px_rgba(236,243,243,0.12)]" style={{ background: hex }} />
              <span className="text-footnote font-semibold" style={{ color: dark.text }}>{name}</span>
              <span className="text-eyebrow tracking-normal" style={{ color: dark.textSecondary }}>{hex}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Typografie · Systemschrift">
        <div className="flex flex-col gap-3">
          {type.map(([cls, sample, spec]) => (
            <div key={sample} className="flex items-baseline justify-between gap-3">
              <span className={cls}>{sample}</span>
              <span className="shrink-0 text-footnote text-text-secondary">{spec}</span>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3 border-t border-separator pt-3">
            <span className="whitespace-nowrap text-price-hero">{formatEuro(68961)}</span>
            <span className="text-footnote text-text-secondary">tabular-nums</span>
          </div>
        </div>
      </Card>

      <Card title="Icon-Set" note="24-px-Raster · 1,6 px Strich">
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-x-1.5 gap-y-3 p-0 text-accent">
          {iconNames.map((name) => (
            <li key={name} className="flex min-w-0 flex-col items-center gap-1">
              <span
                className={`flex size-11 items-center justify-center rounded-[12px] ${filled(name) ? 'bg-primary text-white [--icon-cutout:var(--primary)]' : 'bg-tint'}`}
              >
                <Icon name={name} />
              </span>
              <span className="max-w-full break-words text-center text-eyebrow normal-case tracking-normal text-text-secondary">{name}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Illustrationen" note="Light und Dark nach System">
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0">
          {illustrationNames.map((name) => (
            <li key={name} className="flex min-w-0 flex-col gap-1">
              <span className="flex h-[120px] items-center justify-center overflow-hidden rounded-illustration-panel" style={{ background: 'var(--illustration-panel)' }}>
                <Illustration name={name} className="h-auto max-h-full max-w-full" />
              </span>
              <span className="text-eyebrow normal-case tracking-normal text-text-secondary">{name}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Komponenten />
    </main>
  )
}
