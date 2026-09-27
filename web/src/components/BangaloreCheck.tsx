import { useEffect, useState } from 'react'
import { cachedLocation, checkLocation, type LocationResult } from '../lib/location'

// Asks for location once per session and warns anyone outside Bangalore.
// Doesn't block anything: people can still sign up, e.g. before moving.
export default function BangaloreCheck() {
  const [result, setResult] = useState<LocationResult | 'checking'>(() => cachedLocation() ?? 'checking')
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (result !== 'checking') return
    let cancelled = false
    checkLocation().then((r) => !cancelled && setResult(r))
    return () => {
      cancelled = true
    }
  }, [result])

  if (dismissed || result === 'checking' || result === 'inside') return null

  if (result === 'outside') {
    return (
      <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
        <div className="flex items-start justify-between gap-3">
          <p>
            <strong>Looks like you're outside Bangalore.</strong> Kollide is only in Bangalore for now, so everyone you
            meet here and every group is in Bangalore.
          </p>
          <button type="button" onClick={() => setDismissed(true)} className="shrink-0 text-lg leading-none" aria-label="Dismiss">
            ×
          </button>
        </div>
      </div>
    )
  }

  // Location declined or unavailable: just the reminder.
  return (
    <p className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-neutral-100 px-4 py-2 text-xs text-neutral-600">
      <span>📍 Kollide is Bangalore-only for now.</span>
      <button type="button" onClick={() => setDismissed(true)} className="text-base leading-none" aria-label="Dismiss">
        ×
      </button>
    </p>
  )
}
