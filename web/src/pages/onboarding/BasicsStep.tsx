import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, Choice, ErrorText, Field, inputClass } from '../../components/ui'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { Gender, Seeking } from '../../lib/types'
import type { StepProps } from './Onboarding'

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
]

const PREFERENCE_LABELS: Record<Gender, string> = { woman: 'Women', man: 'Men', non_binary: 'Non-binary people' }

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function BasicsStep({ data, reload, onNext }: StepProps) {
  const p = data.profile
  const [firstName, setFirstName] = useState(p.first_name ?? '')
  const [dob, setDob] = useState(p.dob ?? '')
  const [gender, setGender] = useState<Gender | null>(p.gender)
  const [seeking, setSeeking] = useState<Seeking | null>(p.seeking)
  const [prefs, setPrefs] = useState<Gender[]>(p.gender_preference ?? [])
  const [consent, setConsent] = useState(!!p.consent_at)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const today = new Date()
  const maxDob = isoDate(new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()))

  function togglePref(g: Gender) {
    setPrefs((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!gender || !seeking) return setError("Please choose your gender and what you're looking for")
    if (!prefs.length) return setError("Please choose who you'd like to meet")
    setSaving(true)
    const { error } = await supabase.rpc('save_basics', {
      p_first_name: firstName,
      p_dob: dob,
      p_gender: gender,
      p_seeking: seeking,
      p_gender_preference: prefs,
      p_consent: consent,
    })
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
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Let's start with the basics</h1>
        <p className="mt-1 text-neutral-600">Only your first name and age are shown on your profile.</p>
      </div>

      <Field label="First name">
        <input
          required
          maxLength={50}
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Date of birth" hint="You must be 18 or older.">
        <input type="date" required max={maxDob} value={dob} onChange={(e) => setDob(e.target.value)} className={inputClass} />
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-neutral-800">I am a</legend>
        <div className="grid grid-cols-3 gap-2">
          {GENDERS.map((g) => (
            <Choice key={g.value} name="gender" checked={gender === g.value} onChange={() => setGender(g.value)}>
              {g.label}
            </Choice>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-neutral-800">I'm looking for</legend>
        <div className="grid grid-cols-2 gap-2">
          <Choice name="seeking" checked={seeking === 'partner'} onChange={() => setSeeking('partner')}>
            A Garba partner
          </Choice>
          <Choice name="seeking" checked={seeking === 'friend'} onChange={() => setSeeking('friend')}>
            A friend to go with
          </Choice>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-neutral-800">I'd like to meet</legend>
        <div className="grid grid-cols-3 gap-2">
          {GENDERS.map((g) => (
            <Choice key={g.value} type="checkbox" checked={prefs.includes(g.value)} onChange={() => togglePref(g.value)}>
              {PREFERENCE_LABELS[g.value]}
            </Choice>
          ))}
        </div>
      </fieldset>

      {!p.consent_at && (
        <label className="flex items-start gap-3 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-700">
          <input
            type="checkbox"
            required
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-5 w-5 accent-brand-600"
          />
          <span>
            I'm 18 or older and I agree to the{' '}
            <Link to="/terms" target="_blank" className="font-medium underline">
              Terms
            </Link>{' '}
            and{' '}
            <Link to="/privacy" target="_blank" className="font-medium underline">
              Privacy Policy
            </Link>
            , including Kollide collecting a short verification video of my face.
          </span>
        </label>
      )}

      <ErrorText>{error}</ErrorText>
      <Button type="submit" className="w-full" loading={saving}>
        Continue
      </Button>
    </form>
  )
}
