import { useState } from 'react'
import { Button, ErrorText } from '../../components/ui'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { StepProps } from './Onboarding'

export default function ActivitiesStep({ data, reload, onNext, onBack }: StepProps) {
  const garba = data.activities.find((a) => a.slug === 'garba')
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(data.selectedActivityIds.length ? data.selectedActivityIds : garba ? [garba.id] : []),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function finish() {
    setError('')
    if (!data.activities.some((a) => a.status === 'live' && selected.has(a.id))) {
      return setError('Pick at least one live activity to continue')
    }
    setSaving(true)
    const uid = data.profile.id
    const before = new Set(data.selectedActivityIds)
    const toAdd = [...selected].filter((id) => !before.has(id))
    const toRemove = [...before].filter((id) => !selected.has(id))

    const results = await Promise.all([
      toAdd.length
        ? supabase.from('user_activities').insert(toAdd.map((activity_id) => ({ user_id: uid, activity_id })))
        : null,
      toRemove.length
        ? supabase.from('user_activities').delete().eq('user_id', uid).in('activity_id', toRemove)
        : null,
    ])
    const failed = results.find((r) => r?.error)
    if (failed?.error) {
      setSaving(false)
      return setError(friendlyError(failed.error))
    }

    const { error } = await supabase.rpc('complete_onboarding')
    if (error) {
      await reload()
      setSaving(false)
      return setError(friendlyError(error))
    }
    await reload()
    setSaving(false)
    onNext()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">What are you up for?</h1>
        <p className="mt-1 text-neutral-600">
          Garba is live for Navratri. Tap the others to hear when they launch.
        </p>
      </div>

      <ul className="space-y-2">
        {data.activities.map((a) => {
          const on = selected.has(a.id)
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => toggle(a.id)}
                aria-pressed={on}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                  on ? 'border-brand-600 bg-brand-50' : 'border-neutral-200 bg-white hover:border-brand-300'
                }`}
              >
                <span className="font-medium text-neutral-900">{a.name}</span>
                <span className="flex items-center gap-2">
                  {a.status === 'coming_soon' && <span className="text-xs text-neutral-500">Coming soon</span>}
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border text-sm ${
                      on ? 'border-brand-600 bg-brand-600 text-white' : 'border-neutral-300'
                    }`}
                  >
                    {on ? '✓' : ''}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <ErrorText>{error}</ErrorText>
      <div className="flex gap-3">
        {onBack && (
          <Button variant="secondary" onClick={onBack} disabled={saving}>
            Back
          </Button>
        )}
        <Button className="flex-1" onClick={finish} loading={saving}>
          Continue
        </Button>
      </div>
    </div>
  )
}
