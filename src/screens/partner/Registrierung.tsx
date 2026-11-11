import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '../../components/Button'
import { Field, GroupedList, SelectField } from '../../components/Surfaces'
import { emptyForm, LEGAL_FORMS, PartnerError, partnerErrorText, registerPartner, toArgs, validate, type FieldKey, type PartnerForm } from '../../lib/partner'

const DISTRICTS = Array.from({ length: 23 }, (_, i) => i + 1)

const Hint = ({ id, text }: { id: string; text?: string }) => (
  <div aria-live="polite">
    {text && (
      <p id={id} className="m-0 px-4 pt-2 text-footnote text-pretty text-destructive">
        {text}
      </p>
    )}
  </div>
)

function Check({ checked, onChange, invalid, describedBy, children }: { checked: boolean; onChange: (v: boolean) => void; invalid?: boolean; describedBy?: string; children: ReactNode }) {
  return (
    <label className="flex min-h-12 items-center gap-3 px-4 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? describedBy : undefined}
        className="size-5 shrink-0 accent-[var(--accent)]"
      />
      <span className="text-body">{children}</span>
    </label>
  )
}

/**
 * Registrierung der Firma (`register_partner`, Konto bleibt Kunde, Firma startet `pending`). Fehler je Feld erst nach dem ersten Absenden,
 * danach live. Der Aufruf ist gegen Doppelklick gesperrt; `already_member` (Firma existiert, z. B. von einem anderen Gerät) lädt den Status neu.
 */
export function Registrierung({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState<PartnerForm>(emptyForm)
  const [submitted, setSubmitted] = useState(false)
  const [focusTick, setFocusTick] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<PartnerError | null>(null)
  const running = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const errors = submitted ? validate(form) : {}
  const set = <K extends keyof PartnerForm>(key: K, value: PartnerForm[K]) => setForm((f) => ({ ...f, [key]: value }))
  const text = (key: Exclude<FieldKey, 'districts' | 'terms'>, label: string, extra: object = {}) => (
    <Field label={label} name={key} value={form[key]} onChange={(e) => set(key, e.target.value)} hint={errors[key]} hintId={`partner-${key}-hint`} {...extra} />
  )

  // Nach einem Absenden mit Fehlern: Fokus auf das erste fehlerhafte Feld (WCAG 3.3.1)
  useEffect(() => {
    if (focusTick > 0) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [focusTick])

  async function send(e: FormEvent) {
    e.preventDefault()
    if (running.current) return
    setSubmitted(true)
    setError(null)
    if (Object.keys(validate(form)).length > 0) {
      setFocusTick((t) => t + 1)
      return
    }
    running.current = true
    setBusy(true)
    try {
      await registerPartner(toArgs(form))
      onDone()
    } catch (err) {
      const e2 = err instanceof PartnerError ? err : new PartnerError('unavailable')
      if (e2.kind === 'already_member') onDone()
      else setError(e2)
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <form ref={formRef} noValidate onSubmit={(e) => void send(e)} className="flex flex-col gap-5 px-5 pt-2 pb-8">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-title3">Firma registrieren</h2>
        <p className="m-0 text-body text-text-secondary">Wir prüfen deine Angaben, bevor du Aufträge siehst.</p>
      </div>

      <GroupedList title="Firma">
        {text('name', 'Firmenname', { autoComplete: 'organization' })}
        <SelectField label="Rechtsform" name="legalForm" value={form.legalForm} onChange={(e) => set('legalForm', e.target.value)}>
          {LEGAL_FORMS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </SelectField>
        <li className="not-first:border-t-[0.5px] not-first:border-separator">
          <Check checked={form.smallBusiness} onChange={(v) => set('smallBusiness', v)}>
            Kleinunternehmer (ohne Umsatzsteuer)
          </Check>
        </li>
        {text('uid', 'UID-Nummer', { autoComplete: 'off', placeholder: 'ATU12345678', autoCapitalize: 'characters' })}
      </GroupedList>

      <GroupedList title="Adresse">
        {text('street', 'Straße', { autoComplete: 'street-address', placeholder: 'mit Hausnummer' })}
        {text('postcode', 'PLZ', { autoComplete: 'postal-code', inputMode: 'numeric', maxLength: 4 })}
        {text('city', 'Ort', { autoComplete: 'address-level2' })}
      </GroupedList>

      <GroupedList title="Kontakt">
        {text('contactName', 'Kontaktperson', { autoComplete: 'name' })}
        {text('phone', 'Telefon', { type: 'tel', autoComplete: 'tel', inputMode: 'tel' })}
        {text('email', 'E-Mail', { type: 'email', autoComplete: 'email', inputMode: 'email' })}
      </GroupedList>

      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-2 px-4 text-section-header text-text-secondary">Bezirke</legend>
        <p className="m-0 px-4 text-footnote text-text-secondary">Wähle alle Wiener Bezirke, in denen du Aufträge annimmst.</p>
        <div className="grid grid-cols-6 gap-2">
          {DISTRICTS.map((n) => (
            <label
              key={n}
              className="relative flex h-12 items-center justify-center rounded-button-secondary bg-surface text-body tabular-nums shadow-card has-[:checked]:bg-primary has-[:checked]:font-semibold has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
            >
              <input
                type="checkbox"
                checked={form.districts.includes(n)}
                onChange={(e) => set('districts', e.target.checked ? [...form.districts, n] : form.districts.filter((d) => d !== n))}
                aria-invalid={n === 1 && errors.districts ? true : undefined}
                aria-describedby={n === 1 && errors.districts ? 'partner-districts-hint' : undefined}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
              <span className="sr-only">Bezirk </span>
              {n}
            </label>
          ))}
        </div>
        <Hint id="partner-districts-hint" text={errors.districts} />
      </fieldset>

      <section className="flex flex-col gap-2">
        <div className="overflow-hidden rounded-grouped-list bg-surface shadow-card">
          <Check checked={form.terms} onChange={(v) => set('terms', v)} invalid={!!errors.terms} describedBy="partner-terms-hint">
            Ich akzeptiere die Partnerbedingungen.
          </Check>
        </div>
        <Hint id="partner-terms-hint" text={errors.terms} />
        <p className="m-0 px-4 text-footnote text-text-secondary">Die Partnerbedingungen sind ein Entwurf und werden vor dem Start verbindlich festgelegt.</p>
      </section>

      <p className="m-0 px-4 text-footnote text-text-secondary">Nach dem Absenden kannst du die Registrierung nicht zurückziehen. Eine abgelehnte Registrierung ist endgültig.</p>

      {error && (
        <p role="alert" className="m-0 px-1 text-body text-destructive">
          {partnerErrorText[error.kind]}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        Registrierung senden
      </Button>
    </form>
  )
}
