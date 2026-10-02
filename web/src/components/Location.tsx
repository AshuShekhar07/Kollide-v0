import { LocateFixed, MapPin, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth-context'
import { friendlyError } from '../lib/errors'
import { RADIUS_KM, fetchCities, locateMe, markSynced, pickCity, shouldSync, type City } from '../lib/location'
import { Sheet } from './SafetyDialogs'
import { Button, EmptyState, ErrorText, inputClass } from './ui'

// Refreshes the user's location from the phone once per session (unless they
// picked a city). Renders nothing: pages show the city with LocationChip, and
// ChooseLocation when there's none yet.
export function LocationSync() {
  const { profile, refreshProfile } = useAuth()

  useEffect(() => {
    if (!shouldSync(profile)) return
    markSynced(profile.id)
    locateMe().then((r) => {
      if (r.ok) refreshProfile()
    })
  }, [profile, refreshProfile])

  return null
}

// "📍 Bengaluru", opening the picker.
export function LocationChip({ className = '' }: { className?: string }) {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex min-w-0 max-w-full items-center gap-1 text-xs font-semibold text-neutral-500 transition hover:text-neutral-900 ${className}`}
        aria-label={`Location: ${profile?.city ?? 'not set'}. Change`}
      >
        <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-500" strokeWidth={2.4} />
        <span className="truncate">{profile?.city ?? 'Choose your city'}</span>
      </button>
      {open && <LocationPicker onClose={() => setOpen(false)} />}
    </>
  )
}

// Shown instead of people or groups while the user has no location.
export function ChooseLocation() {
  const { refreshProfile } = useAuth()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function locate() {
    setBusy(true)
    setError('')
    const r = await locateMe()
    if (r.ok) await refreshProfile()
    else setError(r.message)
    setBusy(false)
  }

  return (
    <>
      <EmptyState
        icon={MapPin}
        title="Where are you?"
        action={
          <div className="flex flex-col items-center gap-3">
            <Button onClick={locate} loading={busy}>
              <LocateFixed className="h-4 w-4" /> Use my location
            </Button>
            <Button variant="secondary" onClick={() => setOpen(true)} disabled={busy}>
              Choose a city
            </Button>
            <ErrorText>{error}</ErrorText>
          </div>
        }
      >
        Kollide shows you people and groups within {RADIUS_KM} km. Nobody sees your exact location.
      </EmptyState>
      {open && <LocationPicker onClose={() => setOpen(false)} />}
    </>
  )
}

export function LocationPicker({ onClose }: { onClose: () => void }) {
  const { profile, refreshProfile } = useAuth()
  const [cities, setCities] = useState<City[] | null>(null)
  const [query, setQuery] = useState('')
  // A city slug, or 'gps', while saving.
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchCities()
      .then(setCities)
      .catch((e) => setError(friendlyError(e)))
  }, [])

  // `run` returns an error message, or null once saved.
  async function save(key: string, run: () => Promise<string | null>) {
    setBusy(key)
    setError('')
    const message = await run()
    if (message) {
      setError(message)
      return setBusy(null)
    }
    await refreshProfile()
    onClose()
  }

  const locate = () => save('gps', async () => {
    const r = await locateMe()
    return r.ok ? null : r.message
  })

  const q = query.trim().toLowerCase()
  const shown = cities?.filter((c) => (q ? c.name.toLowerCase().includes(q) : c.popular !== null)) ?? []
  const picked = profile?.location_source === 'city' ? profile.city : null

  return (
    <Sheet label="Choose your city" onClose={onClose}>
      <h2 className="text-lg font-bold text-neutral-900">Where do you want to meet people?</h2>
      <p className="mt-1 text-sm text-neutral-500">
        You'll see people and groups within {RADIUS_KM} km.
        {profile?.city && (
          <>
            {' '}
            Now: <span className="font-semibold text-neutral-800">{profile.city}</span>
          </>
        )}
      </p>

      <Button variant="secondary" className="mt-4 w-full" onClick={locate} loading={busy === 'gps'} disabled={!!busy}>
        <LocateFixed className="h-4 w-4" /> Use my current location
      </Button>

      <label className="relative mt-4 block">
        <span className="sr-only">Search cities</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cities"
          className={`${inputClass} pl-10`}
          autoComplete="off"
        />
      </label>

      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>

      {!q && <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">Popular</p>}
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Cities">
        {shown.map((c) => {
          const active = picked === c.name
          return (
            <button
              key={c.slug}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!!busy}
              onClick={() => save(c.slug, () => pickCity(c.slug))}
              className={`flex items-center justify-center gap-2 truncate rounded-2xl border px-3 py-3 text-sm font-bold transition active:scale-[0.97] disabled:opacity-60 ${
                active
                  ? 'border-transparent bg-marigold-400 text-maroon-950 shadow-md shadow-marigold-500/25'
                  : 'border-neutral-200 text-neutral-700 hover:border-neutral-900'
              }`}
            >
              {busy === c.slug && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {c.name}
            </button>
          )
        })}
      </div>
      {cities && q && shown.length === 0 && (
        <p className="mt-2 text-sm text-neutral-500">
          Kollide isn't in "{query.trim()}" yet. Pick the nearest city, or use your location.
        </p>
      )}
    </Sheet>
  )
}
