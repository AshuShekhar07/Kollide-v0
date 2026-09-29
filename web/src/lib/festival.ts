import { useEffect, useState } from 'react'

// Where we are in the festival, by Bangalore time. The app changes with it:
// a countdown before Navratri, the night's number and colour during it, the
// darker "garba night" look after 6pm, and a thank-you once it's over.

const IST_MS = 5.5 * 3_600_000
const DAY = 86_400_000
// The date (IST) of the first night. Night 1 is the night of Oct 11, 2026.
const FIRST_NIGHT = Date.UTC(2026, 9, 11)
// Garba runs from 6pm into the small hours; before 5am still counts as the
// night before.
const NIGHT_STARTS = 18
const NIGHT_ENDS = 5

// Each night of Navratri has its own colour to wear, and its own form of the
// goddess. The colours follow the weekday the festival starts on (Sunday in
// 2026, so orange first).
export const NIGHTS = [
  { colour: 'Orange', hex: '#e0661a', on: '#fff4e4', devi: 'Shailaputri' },
  { colour: 'White', hex: '#f4ede2', on: '#2a0e1b', devi: 'Brahmacharini' },
  { colour: 'Red', hex: '#c8102e', on: '#fff4e4', devi: 'Chandraghanta' },
  { colour: 'Royal blue', hex: '#2a4bb8', on: '#fff4e4', devi: 'Kushmanda' },
  { colour: 'Yellow', hex: '#f6c33b', on: '#2a0e1b', devi: 'Skandamata' },
  { colour: 'Green', hex: '#3e7c2b', on: '#fff4e4', devi: 'Katyayani' },
  { colour: 'Grey', hex: '#8a8390', on: '#fff4e4', devi: 'Kalaratri' },
  { colour: 'Purple', hex: '#6b2fa0', on: '#fff4e4', devi: 'Mahagauri' },
  { colour: 'Peacock green', hex: '#0b7a7a', on: '#fff4e4', devi: 'Siddhidatri' },
] as const

export type NightInfo = (typeof NIGHTS)[number]

export type Festival =
  // Days until the first night.
  | { phase: 'before'; days: number; isNight: boolean }
  // `night` is tonight's number (1-9): the one that's on now, or the one
  // starting at 6pm today.
  | { phase: 'during'; night: number; info: NightInfo; isNight: boolean }
  // `dussehra` is the day after the ninth night.
  | { phase: 'after'; dussehra: boolean; isNight: boolean }

// Previews can pretend it's another moment: ?festival-at=2026-10-13T20:00
// (Bangalore time) sticks for the tab; ?festival-at=off goes back to now.
const AT_KEY = 'kollide:festival-at'
let override: number | null | undefined

function pretendNow(): number | null {
  if (override !== undefined) return override
  override = null
  try {
    const param = new URLSearchParams(window.location.search).get('festival-at')
    if (param === 'off') sessionStorage.removeItem(AT_KEY)
    else if (param) sessionStorage.setItem(AT_KEY, param)
    const saved = sessionStorage.getItem(AT_KEY)
    if (saved) {
      const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(saved) ? saved : `${saved}+05:30`)
      if (!Number.isNaN(t)) override = t
    }
  } catch {
    // Storage blocked: just use the real time.
  }
  return override
}

export function festivalNow(): number {
  return pretendNow() ?? Date.now()
}

export function festivalAt(now = festivalNow()): Festival {
  const ist = new Date(now + IST_MS)
  const hour = ist.getUTCHours()
  const isNight = hour >= NIGHT_STARTS || hour < NIGHT_ENDS
  // The calendar date whose night this is.
  const nightDate = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - (hour < NIGHT_ENDS ? DAY : 0)
  const night = Math.round((nightDate - FIRST_NIGHT) / DAY) + 1
  if (night < 1) return { phase: 'before', days: 1 - night, isNight }
  if (night <= NIGHTS.length) return { phase: 'during', night, info: NIGHTS[night - 1], isNight }
  return { phase: 'after', dussehra: night === NIGHTS.length + 1, isNight }
}

// Re-checked every minute, so the app turns to night at 6pm without a reload.
export function useFestival(): Festival {
  const [festival, setFestival] = useState(() => festivalAt())
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = festivalAt()
      setFestival((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])
  return festival
}
