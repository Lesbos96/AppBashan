import { LIMITS, type Tariffs, num } from '@pricing'
import type { ReactNode } from 'react'
import { Segmented } from '../../components/Controls'
import { GroupedList, StepRow } from '../../components/Surfaces'
import type { AssemblyDraft } from '../../lib/flow'
import { formatEuro } from '../../lib/money'
import { lmText } from '../../lib/preview'

const cabinets = [
  { key: 'lm', label: 'Unterschränke', rate: 'kitchen.lower_per_lfm', dot: 'bg-cabinet-lower' },
  { key: 'upper', label: 'Oberschränke', rate: 'kitchen.upper_per_lfm', dot: 'bg-cabinet-upper ring-1 ring-text/15 ring-inset' },
  { key: 'tall', label: 'Hochschränke', rate: 'kitchen.tall_per_lfm', dot: 'bg-cabinet-tall' },
] as const

/** Montage: Standardmöbel nach Laufmetern oder Küche nach Unter-, Ober- und Hochschränken. Der Preis kommt aus dem Preismodul, hier stehen nur Eingaben und Tarifhinweise. `visual` steht zwischen Möbelart und Eingaben (Montage-Seite: Illustration). */
export function AssemblyEditor({ draft, onChange, tariffs, visual }: { draft: AssemblyDraft; onChange: (draft: AssemblyDraft) => void; tariffs: Tariffs; visual?: ReactNode }) {
  const minLm = num(tariffs, 'assembly.min_lfm')
  const max = LIMITS.assemblyLm[1]
  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Möbelart"
        value={draft.kind}
        onChange={(kind) => onChange({ ...draft, kind: kind as AssemblyDraft['kind'] })}
        options={[
          { value: 'standard', label: 'Standardmöbel' },
          { value: 'kitchen', label: 'Küche' },
        ]}
      />
      {visual}
      {draft.kind === 'standard' ? (
        <>
          <GroupedList>
            <StepRow
              label="Möbelbreite gesamt"
              sub="Laufmeter"
              value={Math.max(draft.lm, minLm)}
              min={minLm}
              max={max}
              step={0.5}
              display={lmText(Math.max(draft.lm, minLm))}
              onChange={(lm) => onChange({ ...draft, lm })}
              labelDown="Laufmeter verringern"
              labelUp="Laufmeter erhöhen"
            />
          </GroupedList>
          <p className="m-0 px-1 text-footnote text-text-secondary">
            {formatEuro(num(tariffs, 'assembly.rate_per_lfm'))} je Laufmeter, mindestens {lmText(minLm)}. Ein Laufmeter entspricht 1 m Möbelbreite. Ein Arbeitsgang: Aufbau oder Abbau.
          </p>
        </>
      ) : (
        <>
          <GroupedList>
            {cabinets.map((c) => (
              <StepRow
                key={c.key}
                label={c.label}
                sub={`${formatEuro(num(tariffs, c.rate))} je lfm`}
                dotClassName={c.dot}
                value={draft[c.key]}
                min={0}
                max={max}
                step={0.1}
                display={lmText(draft[c.key])}
                onChange={(v) => onChange({ ...draft, [c.key]: v })}
                labelDown={`${c.label} verringern`}
                labelUp={`${c.label} erhöhen`}
              />
            ))}
          </GroupedList>
          <p className="m-0 px-1 text-footnote text-text-secondary">
            Dazu {formatEuro(num(tariffs, 'kitchen.base'))} Grundbetrag. Ein Laufmeter entspricht 1 m Möbelbreite. Ein Arbeitsgang: Aufbau oder Abbau. Ohne Elektro-, Gas- und Wasseranschlüsse.
          </p>
        </>
      )}
    </div>
  )
}
