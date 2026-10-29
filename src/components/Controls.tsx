import { motion } from 'motion/react'
import { useId } from 'react'
import { spring } from '../lib/motion'
import { Icon } from './Icon'

type Option = { value: string; label: string }

/** Segmented Control als native Radiogruppe: Pfeiltasten und Fokus kommen vom Browser. */
export function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Option[]
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid h-9 gap-0.5 rounded-segmented bg-fill p-0.5"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <label
          key={o.value}
          className="relative flex min-w-0 cursor-pointer items-center justify-center rounded-segment text-[13px] has-[:checked]:font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent/45"
        >
          <input
            type="radio"
            name={id}
            value={o.value}
            checked={o.value === value}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.value === value && (
            <motion.span
              layoutId={id}
              transition={spring}
              className="absolute inset-0 rounded-segment bg-surface-elevated dark:bg-text/15 shadow-[0_1px_3px_rgba(16,47,53,0.12),0_0_0_0.5px_rgba(16,47,53,0.06)]"
            />
          )}
          <span className="relative truncate px-1">{o.label}</span>
        </label>
      ))}
    </div>
  )
}

export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  // Die Pille ist 36 px hoch, die Tasten reichen mit 44 px Touch-Ziel darüber hinaus.
  const button = 'press -my-1 flex h-11 w-11 items-center justify-center text-accent disabled:opacity-40'
  return (
    <div role="group" aria-label={label} className="flex h-9 items-center gap-0.5 rounded-full bg-fill px-0.5">
      <button type="button" aria-label="Weniger" disabled={value <= min} onClick={() => onChange(value - 1)} className={button}>
        <Icon name="minus" width={18} height={18} />
      </button>
      <output aria-live="polite" className="min-w-7 text-center text-headline">
        {value}
      </output>
      <button type="button" aria-label="Mehr" disabled={value >= max} onClick={() => onChange(value + 1)} className={button}>
        <Icon name="plus" width={18} height={18} />
      </button>
    </div>
  )
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex h-11 w-[51px] shrink-0 items-center"
    >
      <span className={`relative h-[31px] w-full rounded-2xl transition-colors ${checked ? 'bg-switch-on' : 'bg-switch-off'}`}>
        <motion.span
          initial={false}
          animate={{ x: checked ? 22 : 2 }}
          transition={spring}
          className="absolute top-0.5 left-0 size-[27px] rounded-full bg-white shadow-switch-knob"
        />
      </span>
    </button>
  )
}

const chips = {
  requested: 'bg-status-requested-bg text-status-requested-text',
  review: 'bg-status-review-bg text-status-review-text',
  confirmed: 'bg-status-confirmed-bg text-status-confirmed-text',
  done: 'bg-status-done-bg text-status-done-text',
}

export function StatusChip({ status, children }: { status: keyof typeof chips; children: string }) {
  return (
    <span className={`inline-flex h-[26px] items-center whitespace-nowrap rounded-chip px-2.5 text-[12.5px] font-semibold ${chips[status]}`}>
      {children}
    </span>
  )
}
