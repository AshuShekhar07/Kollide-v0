// Where you meet people: your phone's position, refreshed once a session, or a
// city you picked. The server keeps the position rounded to about 1 km, labels
// it with the nearest city, and shows people and groups within RADIUS_KM.
// Nobody else ever sees it.

import { friendlyError } from './errors'
import { supabase } from './supabase'
import type { Profile } from './types'

// Must match private.within_reach() (migration 20261016000001).
export const RADIUS_KM = 80

export type City = { slug: string; name: string; popular: number | null }

let cities: Promise<City[]> | null = null

// The picker's list; fetched once per page load.
export function fetchCities(): Promise<City[]> {
  cities ??= Promise.resolve(
    supabase
      .from('cities')
      .select('slug, name, popular')
      .order('popular', { ascending: true, nullsFirst: false })
      .order('name'),
  ).then(({ data, error }) => {
    if (error) {
      cities = null
      throw error
    }
    return data
  })
  return cities
}

export function hasLocation(profile: Profile | null) {
  return profile?.lat != null && profile.lng != null
}

type Position = { lat: number; lng: number } | 'denied' | 'unavailable'

// Asks the browser for the position (it shows its own permission prompt).
function currentPosition(): Promise<Position> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve('unavailable')
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => resolve(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60 * 60 * 1000 },
    )
  })
}

export type LocateResult = { ok: true; city: string } | { ok: false; message: string }

// Saves the phone's position as the user's location.
export async function locateMe(): Promise<LocateResult> {
  const pos = await currentPosition()
  if (pos === 'denied') {
    return { ok: false, message: 'Location is off for Kollide. Allow it in your browser settings, or pick a city.' }
  }
  if (pos === 'unavailable') return { ok: false, message: "We couldn't find your location. Pick a city instead." }
  const { data, error } = await supabase.rpc('set_my_position', { p_lat: pos.lat, p_lng: pos.lng })
  if (error) return { ok: false, message: friendlyError(error) }
  return { ok: true, city: (data as { city: string }).city }
}

// Returns an error message, or null once saved.
export async function pickCity(slug: string): Promise<string | null> {
  const { error } = await supabase.rpc('set_my_city', { p_city: slug })
  return error ? friendlyError(error) : null
}

const SYNC_KEY = 'kollide:location-synced'

// Refresh from the phone once per session, unless the user picked a city.
export function shouldSync(profile: Profile | null): profile is Profile {
  if (!profile || profile.location_source === 'city') return false
  try {
    return sessionStorage.getItem(SYNC_KEY) !== profile.id
  } catch {
    return true
  }
}

export function markSynced(uid: string) {
  try {
    sessionStorage.setItem(SYNC_KEY, uid)
  } catch {
    /* fine: we just ask again next time */
  }
}
