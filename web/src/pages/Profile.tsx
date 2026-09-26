import { useState, type FormEvent } from 'react'
import { Button, Choice, ErrorText } from '../components/ui'
import { useAuth } from '../lib/auth-context'
import { friendlyError } from '../lib/errors'
import { GENDERS, PREFERENCE_LABELS, SEEKING_OPTIONS } from '../lib/profile-options'
import { supabase } from '../lib/supabase'
import type { Gender, Seeking } from '../lib/types'

const STATUS_COPY: Record<string, { label: string; className: string }> = {
  approved: { label: 'Verified', className: 'bg-green-100 text-green-800' },
  pending: { label: 'Verification pending', className: 'bg-amber-100 text-amber-800' },
}

export default function Profile() {
  const { profile, refreshProfile, signOut } = useAuth()
  const [seeking, setSeeking] = useState<Seeking | null>(profile?.seeking ?? null)
  const [prefs, setPrefs] = useState<Gender[]>(profile?.gender_preference ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  if (!profile) return null
  const status = STATUS_COPY[profile.verification_status]
  const dirty =
    seeking !== profile.seeking || [...prefs].sort().join() !== [...(profile.gender_preference ?? [])].sort().join()

  function togglePref(g: Gender) {
    setSaved(false)
    setPrefs((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]))
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!seeking) return setError("Please choose what you're looking for.")
    if (!prefs.length) return setError("Please choose who you'd like to meet.")
    setSaving(true)
    const { error } = await supabase.rpc('update_preferences', { p_seeking: seeking, p_gender_preference: prefs })
    if (!error) await refreshProfile()
    setSaving(false)
    if (error) return setError(friendlyError(error))
    setSaved(true)
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-neutral-900">{profile.first_name}</h1>
          <p className="font-mono text-sm text-neutral-500">{profile.public_code}</p>
        </div>
        {status && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>}
      </div>

      <form onSubmit={save} className="mt-6 space-y-6">
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-neutral-800">I'm looking for</legend>
          <p className="mb-2 text-xs text-neutral-500">You'll see people who picked the same option.</p>
          <div className="grid grid-cols-2 gap-2">
            {SEEKING_OPTIONS.map((o) => (
              <Choice
                key={o.value}
                name="seeking"
                checked={seeking === o.value}
                onChange={() => {
                  setSaved(false)
                  setSeeking(o.value)
                }}
              >
                {o.label}
              </Choice>
            ))}
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

        <ErrorText>{error}</ErrorText>
        <Button type="submit" className="w-full" loading={saving} disabled={!dirty}>
          {saved && !dirty ? 'Saved' : 'Save changes'}
        </Button>
      </form>

      <Button variant="ghost" className="mx-auto mt-10 flex" onClick={signOut}>
        Sign out
      </Button>
    </>
  )
}
