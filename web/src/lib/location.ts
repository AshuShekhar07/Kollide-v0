// "Bangalore only" check (pilot). Runs entirely on the device: the position
// is compared with central Bangalore and never sent anywhere or stored.

const CENTER = { lat: 12.9716, lng: 77.5946 }
// Covers the city and its edges (Whitefield, Electronic City, the airport).
export const RADIUS_KM = 50

export type LocationResult = 'inside' | 'outside' | 'denied' | 'unavailable'

const CACHE_KEY = 'kollide:location'

export function distanceKm(lat: number, lng: number) {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(lat - CENTER.lat)
  const dLng = rad(lng - CENTER.lng)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(CENTER.lat)) * Math.cos(rad(lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}

export function cachedLocation(): LocationResult | null {
  try {
    return (sessionStorage.getItem(CACHE_KEY) as LocationResult | null) ?? null
  } catch {
    return null
  }
}

function remember(r: LocationResult) {
  try {
    sessionStorage.setItem(CACHE_KEY, r)
  } catch {
    /* fine: we just ask again next time */
  }
}

// Asks the browser for the position (it shows its own permission prompt).
export function checkLocation(): Promise<LocationResult> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve('unavailable')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const r = distanceKm(pos.coords.latitude, pos.coords.longitude) <= RADIUS_KM ? 'inside' : 'outside'
        remember(r)
        resolve(r)
      },
      (err) => {
        const r = err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'
        remember(r)
        resolve(r)
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60 * 60 * 1000 },
    )
  })
}
