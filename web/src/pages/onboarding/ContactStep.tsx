import { ChevronLeft, Lock } from 'lucide-react'
import StepHeader from '../../components/StepHeader'
import { useState, type FormEvent } from 'react'
import { Button, ErrorText, Field, inputClass } from '../../components/ui'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { StepProps } from './Onboarding'

const SOCIALS = [
  { key: 'instagram', label: 'Instagram', placeholder: 'username' },
  { key: 'snapchat', label: 'Snapchat', placeholder: 'username' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: '10-digit number' },
  { key: 'telegram', label: 'Telegram', placeholder: 'username' },
] as const

const stripCountryCode = (v: string | null | undefined) => (v ?? '').replace(/^\+91/, '')

export default function ContactStep({ data, reload, onNext, onBack }: StepProps) {
  const saved = (data.contact?.socials ?? {}) as Record<string, string>
  const [phone, setPhone] = useState(stripCountryCode(data.contact?.phone))
  const [socials, setSocials] = useState<Record<string, string>>({
    instagram: saved.instagram ?? '',
    snapchat: saved.snapchat ?? '',
    whatsapp: stripCountryCode(saved.whatsapp),
    telegram: saved.telegram ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const { error } = await supabase.rpc('save_contact', { p_phone: phone, p_socials: socials })
    if (error) {
      setSaving(false)
      return setError(friendlyError(error))
    }
    await reload()
    setSaving(false)
    onNext()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <StepHeader icon={Lock} title="How can matches reach you?">
        These stay private. They're only shown to someone after you match with them or join the same group.
      </StepHeader>

      <Field label="Phone number">
        <div className="flex">
          <span className="flex items-center rounded-l-2xl border border-r-0 border-neutral-200 bg-neutral-100 px-3.5 font-semibold text-neutral-700">
            +91
          </span>
          <input
            type="tel"
            required
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={`${inputClass} rounded-l-none`}
          />
        </div>
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-neutral-800">
          Social handles <span className="font-normal text-neutral-500">(at least one)</span>
        </legend>
        {SOCIALS.map((s) => (
          <label key={s.key} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm font-medium text-neutral-700">{s.label}</span>
            <input
              value={socials[s.key]}
              inputMode={s.key === 'whatsapp' ? 'numeric' : 'text'}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder={s.placeholder}
              onChange={(e) => setSocials((cur) => ({ ...cur, [s.key]: e.target.value }))}
              className={inputClass}
            />
          </label>
        ))}
      </fieldset>

      <ErrorText>{error}</ErrorText>
      <div className="flex gap-3">
        {onBack && (
          <Button type="button" variant="secondary" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
        )}
        <Button type="submit" className="flex-1" loading={saving}>
          Continue
        </Button>
      </div>
    </form>
  )
}
