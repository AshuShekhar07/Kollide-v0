import { MapPin, MapPinOff, X } from 'lucide-react'
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
      <div className="mb-3 animate-rise rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
        <div className="flex items-start gap-3">
          <MapPinOff className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1">
            <strong>Looks like you're outside Bangalore.</strong> Kollide is only in Bangalore for now, so everyone you
            meet here and every group is in Bangalore.
          </p>
          <button type="button" onClick={() => setDismissed(true)} className="-m-1 shrink-0 rounded-full p-1 hover:bg-amber-100" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  // Location declined or unavailable: just the reminder.
  return (
    <p className="mb-3 flex items-center gap-2 rounded-2xl bg-neutral-100 px-4 py-2 text-xs font-medium text-neutral-600">
      <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-600" />
      <span className="flex-1">Kollide is Bangalore-only for now.</span>
      <button type="button" onClick={() => setDismissed(true)} className="-m-1 rounded-full p-1 hover:bg-neutral-200" aria-label="Dismiss">
        <X className="h-3.5 w-3.5" />
      </button>
    </p>
  )
}
